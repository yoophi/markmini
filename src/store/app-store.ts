import { create } from "zustand";

import { extractHeadings } from "@/lib/markdown";
import {
  getInitialSession,
  readMarkdownFile,
  refreshSession,
  writeMarkdownFile,
  type ScanProgressPayload,
} from "@/lib/tauri";
import type { HeadingItem, ScanStatus } from "@/types/content";

type BootstrapState = "idle" | "loading" | "ready" | "error";
type DocumentState = "idle" | "loading" | "ready" | "error";
type DocumentMode = "preview" | "edit";

interface AppStore {
  bootstrapState: BootstrapState;
  error: string | null;
  rootDir: string | null;
  files: string[];
  fileSet: ReadonlySet<string>;
  scanState: ScanStatus;
  scanSkippedPaths: string[];
  scanSkippedPathSet: ReadonlySet<string>;
  scanError: string | null;
  selectedFile: string | null;
  isSidebarOpen: boolean;
  document: {
    state: DocumentState;
    content: string;
    savedContent: string;
    draftContent: string;
    headings: HeadingItem[];
    error: string | null;
    mode: DocumentMode;
    isDirty: boolean;
    isSaving: boolean;
    lastSavedAt: string | null;
    externalChangeDetected: boolean;
  };
  setSidebarOpen: (open: boolean) => void;
  applyScanProgress: (payload: ScanProgressPayload) => Promise<void>;
  bootstrap: () => Promise<void>;
  openDocument: (relativePath: string) => Promise<void>;
  setDocumentMode: (mode: DocumentMode) => void;
  updateDraftContent: (content: string) => void;
  saveCurrentDocument: () => Promise<void>;
  reloadCurrentDocument: (force?: boolean) => Promise<void>;
  keepDraftAfterExternalChange: () => void;
  refresh: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  bootstrapState: "idle",
  error: null,
  rootDir: null,
  files: [],
  fileSet: new Set(),
  scanState: "idle",
  scanSkippedPaths: [],
  scanSkippedPathSet: new Set(),
  scanError: null,
  selectedFile: null,
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
      set({
        bootstrapState: "ready",
        rootDir: session.rootDir,
        files,
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
    const current = get();
    if (current.document.isDirty && !confirmDiscardUnsavedChanges()) {
      return;
    }

    set({
      selectedFile: relativePath,
      document: createLoadingDocument(),
    });

    try {
      const document = await readMarkdownFile(relativePath);
      set({
        selectedFile: document.relativePath,
        document: createReadyDocument(document.content, document.headings),
      });
    } catch (error) {
      set({
        document: createErrorDocument(error instanceof Error ? error.message : "문서를 열지 못했습니다."),
      });
    }
  },
  setDocumentMode: (mode) => {
    set((state) => ({
      document: {
        ...state.document,
        mode,
      },
    }));
  },
  updateDraftContent: (content) => {
    set((state) => ({
      document: {
        ...state.document,
        content,
        draftContent: content,
        headings: extractHeadings(content),
        isDirty: content !== state.document.savedContent,
      },
    }));
  },
  saveCurrentDocument: async () => {
    const state = get();
    const current = state.selectedFile;
    const currentDocument = state.document;
    if (
      !current ||
      currentDocument.state !== "ready" ||
      !currentDocument.isDirty ||
      currentDocument.isSaving ||
      currentDocument.externalChangeDetected
    ) {
      return;
    }

    const draftContent = currentDocument.draftContent;
    set((state) => ({
      document: {
        ...state.document,
        isSaving: true,
        error: null,
      },
    }));

    try {
      const document = await writeMarkdownFile(current, draftContent);
      set({
        selectedFile: document.relativePath,
        document: {
          ...createReadyDocument(document.content, document.headings),
          mode: get().document.mode,
          lastSavedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      set((state) => ({
        document: {
          ...state.document,
          state: state.document.state === "loading" ? "error" : state.document.state,
          isSaving: false,
          error: error instanceof Error ? error.message : "문서를 저장하지 못했습니다.",
        },
      }));
    }
  },
  reloadCurrentDocument: async (force = false) => {
    const current = get().selectedFile;
    if (!current) {
      return;
    }

    const currentDocument = get().document;
    if (currentDocument.isDirty && !force) {
      set({
        document: {
          ...currentDocument,
          externalChangeDetected: true,
        },
      });
      return;
    }

    try {
      const document = await readMarkdownFile(current);
      set((state) => ({
        selectedFile: document.relativePath,
        document: {
          ...createReadyDocument(document.content, document.headings),
          mode: state.document.mode,
        },
      }));
    } catch (error) {
      set({
        document: createErrorDocument(error instanceof Error ? error.message : "문서를 다시 불러오지 못했습니다."),
      });
    }
  },
  keepDraftAfterExternalChange: () => {
    set((state) => ({
      document: {
        ...state.document,
        externalChangeDetected: false,
      },
    }));
  },
  refresh: async () => {
    const previousSelection = get().selectedFile;
    const hadDirtyDocument = get().document.isDirty;

    if (hadDirtyDocument && !confirmDiscardUnsavedChanges()) {
      return;
    }

    if (hadDirtyDocument) {
      set({ document: createEmptyDocument() });
    }

    try {
      const session = await refreshSession();
      const { values: files, valueSet: fileSet } = mergeSortedUnique([], new Set(), session.files);
      set({
        bootstrapState: "ready",
        error: null,
        rootDir: session.rootDir,
        files,
        fileSet,
        scanState: "completed",
        scanSkippedPaths: [],
        scanSkippedPathSet: new Set(),
        scanError: null,
      });

      const nextSelection =
        previousSelection && session.files.includes(previousSelection)
          ? previousSelection
          : session.selectedFile;

      if (nextSelection) {
        await get().openDocument(nextSelection);
      } else {
        set({
          selectedFile: null,
          document: createEmptyDocument(),
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "세션을 새로고침하지 못했습니다.",
      });
    }
  },
}));

function createEmptyDocument(): AppStore["document"] {
  return {
    state: "idle",
    content: "",
    savedContent: "",
    draftContent: "",
    headings: [],
    error: null,
    mode: "preview",
    isDirty: false,
    isSaving: false,
    lastSavedAt: null,
    externalChangeDetected: false,
  };
}

function createLoadingDocument(): AppStore["document"] {
  return {
    ...createEmptyDocument(),
    state: "loading",
  };
}

function createReadyDocument(content: string, headings: HeadingItem[]): AppStore["document"] {
  return {
    state: "ready",
    content,
    savedContent: content,
    draftContent: content,
    headings: headings.length > 0 ? headings : extractHeadings(content),
    error: null,
    mode: "preview",
    isDirty: false,
    isSaving: false,
    lastSavedAt: null,
    externalChangeDetected: false,
  };
}

function createErrorDocument(message: string): AppStore["document"] {
  return {
    ...createEmptyDocument(),
    state: "error",
    error: message,
  };
}

function confirmDiscardUnsavedChanges() {
  return window.confirm("저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 계속할까요?");
}

function mergeSortedUnique(current: string[], currentSet: ReadonlySet<string>, incoming: string[]) {
  let hasNewValue = false;
  const next = new Set(currentSet);

  for (const value of incoming) {
    if (!next.has(value)) {
      hasNewValue = true;
    }
    next.add(value);
  }

  if (!hasNewValue && next.size === current.length) {
    return { values: current, valueSet: currentSet };
  }

  return {
    values: [...next].sort((a, b) => a.localeCompare(b)),
    valueSet: next,
  };
}
