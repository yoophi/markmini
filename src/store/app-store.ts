import { create } from "zustand";

import { extractHeadings } from "@/lib/markdown";
import { getInitialSession, readMarkdownFile, refreshSession, type ScanProgressPayload } from "@/lib/tauri";
import type { HeadingItem, ScanStatus } from "@/types/content";

export const RECENT_DOCUMENTS_STORAGE_KEY_PREFIX = "markmini.recentDocuments";

type BootstrapState = "idle" | "loading" | "ready" | "error";
type DocumentState = "idle" | "loading" | "ready" | "error";

interface AppStore {
  bootstrapState: BootstrapState;
  error: string | null;
  rootDir: string | null;
  files: string[];
  fileSet: ReadonlySet<string>;
  recentDocuments: string[];
  scanState: ScanStatus;
  scanSkippedPaths: string[];
  scanSkippedPathSet: ReadonlySet<string>;
  scanError: string | null;
  selectedFile: string | null;
  documentLoadToken: number;
  isSidebarOpen: boolean;
  document: {
    state: DocumentState;
    content: string;
    headings: HeadingItem[];
    error: string | null;
  };
  setSidebarOpen: (open: boolean) => void;
  applyScanProgress: (payload: ScanProgressPayload) => Promise<void>;
  bootstrap: () => Promise<void>;
  openDocument: (relativePath: string) => Promise<void>;
  reloadCurrentDocument: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  bootstrapState: "idle",
  error: null,
  rootDir: null,
  files: [],
  fileSet: new Set(),
  recentDocuments: [],
  scanState: "idle",
  scanSkippedPaths: [],
  scanSkippedPathSet: new Set(),
  scanError: null,
  selectedFile: null,
  documentLoadToken: 0,
  isSidebarOpen: false,
  document: createEmptyDocument(),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  applyScanProgress: async (payload) => {
    const state = get();
    const { values: files, valueSet: fileSet } = mergeSortedUnique(
      state.files,
      state.fileSet,
      payload.files,
    );
    const { values: scanSkippedPaths, valueSet: scanSkippedPathSet } = mergeSortedUnique(
      state.scanSkippedPaths,
      state.scanSkippedPathSet,
      payload.skippedPaths,
    );
    const shouldOpenSelectedFile =
      payload.selectedFile &&
      payload.selectedFile !== state.selectedFile &&
      (!state.selectedFile || state.document.state === "idle");

    set({
      bootstrapState: state.bootstrapState === "loading" ? "ready" : state.bootstrapState,
      files,
      fileSet,
      scanState: payload.status,
      scanSkippedPaths,
      scanSkippedPathSet,
      scanError: payload.error,
      selectedFile: shouldOpenSelectedFile ? payload.selectedFile : state.selectedFile,
    });

    if (shouldOpenSelectedFile && payload.selectedFile) {
      await get().openDocument(payload.selectedFile);
    }
  },
  bootstrap: async () => {
    set({
      bootstrapState: "loading",
      error: null,
      scanState: "scanning",
      scanSkippedPaths: [],
      scanSkippedPathSet: new Set(),
      scanError: null,
      document: createEmptyDocument(),
    });

    try {
      const session = await getInitialSession();
      const { values: files, valueSet: fileSet } = mergeSortedUnique([], new Set(), session.files);
      const recentDocuments = pruneDocumentList(readStoredRecentDocuments(session.rootDir), fileSet);
      set({
        bootstrapState: "ready",
        rootDir: session.rootDir,
        files,
        fileSet,
        recentDocuments,
        selectedFile: session.selectedFile,
      });

      if (session.selectedFile) {
        await get().openDocument(session.selectedFile);
      }
    } catch (error) {
      set({
        bootstrapState: "error",
        error: error instanceof Error ? error.message : "세션을 초기화하지 못했습니다.",
      });
    }
  },
  openDocument: async (relativePath) => {
    const loadToken = get().documentLoadToken + 1;
    set({
      selectedFile: relativePath,
      documentLoadToken: loadToken,
      document: createLoadingDocument(),
    });

    try {
      const document = await readMarkdownFile(relativePath);
      if (!isCurrentDocumentLoad(get(), relativePath, loadToken)) {
        return;
      }

      const recentDocuments = addRecentDocument(get().recentDocuments, document.relativePath, get().fileSet);
      writeStoredRecentDocuments(get().rootDir, recentDocuments);

      set({
        selectedFile: document.relativePath,
        recentDocuments,
        document: createReadyDocument(document.content, document.headings),
      });
    } catch (error) {
      if (!isCurrentDocumentLoad(get(), relativePath, loadToken)) {
        return;
      }

      set({
        document: createErrorDocument(error instanceof Error ? error.message : "문서를 열지 못했습니다."),
      });
    }
  },
  reloadCurrentDocument: async () => {
    const current = get().selectedFile;
    if (!current) {
      return;
    }

    const loadToken = get().documentLoadToken + 1;
    set({ documentLoadToken: loadToken });

    try {
      const document = await readMarkdownFile(current);
      if (!isCurrentDocumentLoad(get(), current, loadToken)) {
        return;
      }

      set({
        selectedFile: document.relativePath,
        document: createReadyDocument(document.content, document.headings),
      });
    } catch (error) {
      if (!isCurrentDocumentLoad(get(), current, loadToken)) {
        return;
      }

      set({
        document: createErrorDocument(error instanceof Error ? error.message : "문서를 다시 불러오지 못했습니다."),
      });
    }
  },
  refresh: async () => {
    const previousState = get();
    set({ scanState: "scanning", scanError: null });

    try {
      const session = await refreshSession();
      const { values: files, valueSet: fileSet } = mergeSortedUnique([], new Set(), session.files);
      const selectedFile = session.selectedFile;
      const recentDocuments = pruneDocumentList(previousState.recentDocuments, fileSet);
      writeStoredRecentDocuments(session.rootDir, recentDocuments);
      set({
        rootDir: session.rootDir,
        files,
        fileSet,
        recentDocuments,
        selectedFile,
        scanState: "completed",
      });

      if (selectedFile && selectedFile !== previousState.selectedFile) {
        await get().openDocument(selectedFile);
      } else if (selectedFile) {
        await get().reloadCurrentDocument();
      } else {
        set({ document: createEmptyDocument() });
      }
    } catch (error) {
      set({
        scanState: "error",
        scanError: error instanceof Error ? error.message : "문서 목록을 새로고침하지 못했습니다.",
      });
    }
  },
}));

function createEmptyDocument(): AppStore["document"] {
  return {
    state: "idle",
    content: "",
    headings: [],
    error: null,
  };
}

function createLoadingDocument(): AppStore["document"] {
  return {
    state: "loading",
    content: "",
    headings: [],
    error: null,
  };
}

function createReadyDocument(content: string, headings: HeadingItem[]): AppStore["document"] {
  return {
    state: "ready",
    content,
    headings: headings.length > 0 ? headings : extractHeadings(content),
    error: null,
  };
}

function createErrorDocument(message: string): AppStore["document"] {
  return {
    state: "error",
    content: "",
    headings: [],
    error: message,
  };
}

function isCurrentDocumentLoad(state: AppStore, requestPath: string, loadToken: number) {
  return state.selectedFile === requestPath && state.documentLoadToken === loadToken;
}

function mergeSortedUnique(current: string[], currentSet: ReadonlySet<string>, incoming: string[]) {
  let hasNewValue = false;
  const next = new Set(currentSet);

  for (const value of incoming) {
    if (!next.has(value)) {
      next.add(value);
      hasNewValue = true;
    }
  }

  if (!hasNewValue && next.size === current.length) {
    return { values: current, valueSet: currentSet };
  }

  return { values: [...next].sort(), valueSet: next };
}

export function addRecentDocument(current: string[], documentPath: string, availableFiles: ReadonlySet<string>, limit = 5) {
  if (!availableFiles.has(documentPath)) {
    return current;
  }

  return [documentPath, ...current.filter((path) => path !== documentPath && availableFiles.has(path))].slice(0, limit);
}

export function pruneDocumentList(paths: string[], availableFiles: ReadonlySet<string>, limit = 5) {
  return paths.filter((path, index) => index === paths.indexOf(path) && availableFiles.has(path)).slice(0, limit);
}

export function readStoredRecentDocuments(rootDir: string | null) {
  if (!rootDir || typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(recentDocumentsStorageKey(rootDir)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function writeStoredRecentDocuments(rootDir: string | null, recentDocuments: string[]) {
  if (!rootDir || typeof window === "undefined") {
    return;
  }

  try {
    const key = recentDocumentsStorageKey(rootDir);
    if (recentDocuments.length > 0) {
      window.localStorage.setItem(key, JSON.stringify(recentDocuments));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage failures; recents still work for the current window state.
  }
}

export function recentDocumentsStorageKey(rootDir: string) {
  return `${RECENT_DOCUMENTS_STORAGE_KEY_PREFIX}:${rootDir}`;
}
