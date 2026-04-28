import { create } from "zustand";

import { extractHeadings } from "@/lib/markdown";
import { getInitialSession, readMarkdownFile, refreshSession, type ScanProgressPayload } from "@/lib/tauri";
import type { HeadingItem, MarkdownFileMetadata, ScanStatus } from "@/types/content";

type BootstrapState = "idle" | "loading" | "ready" | "error";
type DocumentState = "idle" | "loading" | "ready" | "error";

interface AppStore {
  bootstrapState: BootstrapState;
  error: string | null;
  rootDir: string | null;
  files: string[];
  fileMetadata: Record<string, MarkdownFileMetadata>;
  fileSet: ReadonlySet<string>;
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
  fileMetadata: {},
  fileSet: new Set(),
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
      fileMetadata: mergeFileMetadata(state.fileMetadata, payload.fileMetadata),
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
      set({
        bootstrapState: "ready",
        rootDir: session.rootDir,
        files,
        fileMetadata: mergeFileMetadata({}, session.fileMetadata),
        fileSet,
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

      set({
        selectedFile: document.relativePath,
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
      set({
        rootDir: session.rootDir,
        files,
        fileMetadata: mergeFileMetadata({}, session.fileMetadata),
        fileSet,
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

export function mergeFileMetadata(
  current: Record<string, MarkdownFileMetadata>,
  incoming: MarkdownFileMetadata[],
): Record<string, MarkdownFileMetadata> {
  if (incoming.length === 0) {
    return current;
  }

  const next = { ...current };
  for (const metadata of incoming) {
    next[metadata.relativePath] = metadata;
  }
  return next;
}
