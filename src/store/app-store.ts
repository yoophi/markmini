import { create } from "zustand";

import { extractHeadings } from "@/lib/markdown";
import { getInitialSession, readMarkdownFile, refreshSession, type ScanProgressPayload } from "@/lib/tauri";
import type { HeadingItem, ScanStatus } from "@/types/content";

type BootstrapState = "idle" | "loading" | "ready" | "error";
type DocumentState = "idle" | "loading" | "ready" | "error";

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
  scanState: "idle",
  scanSkippedPaths: [],
  scanSkippedPathSet: new Set(),
  scanError: null,
  selectedFile: null,
  isSidebarOpen: false,
  document: {
    state: "idle",
    content: "",
    headings: [],
    error: null,
  },
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
      document: {
        state: "idle",
        content: "",
        headings: [],
        error: null,
      },
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
    set({
      selectedFile: relativePath,
      document: {
        state: "loading",
        content: "",
        headings: [],
        error: null,
      },
    });

    try {
      const document = await readMarkdownFile(relativePath);
      set({
        selectedFile: document.relativePath,
        document: {
          state: "ready",
          content: document.content,
          headings: document.headings.length > 0 ? document.headings : extractHeadings(document.content),
          error: null,
        },
      });
    } catch (error) {
      set({
        document: {
          state: "error",
          content: "",
          headings: [],
          error: error instanceof Error ? error.message : "문서를 열지 못했습니다.",
        },
      });
    }
  },
  reloadCurrentDocument: async () => {
    const current = get().selectedFile;
    if (!current) {
      return;
    }

    try {
      const document = await readMarkdownFile(current);
      set({
        selectedFile: document.relativePath,
        document: {
          state: "ready",
          content: document.content,
          headings:
            document.headings.length > 0 ? document.headings : extractHeadings(document.content),
          error: null,
        },
      });
    } catch (error) {
      set({
        document: {
          state: "error",
          content: "",
          headings: [],
          error: error instanceof Error ? error.message : "문서를 다시 불러오지 못했습니다.",
        },
      });
    }
  },
  refresh: async () => {
    const previousSelection = get().selectedFile;

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
          document: {
            state: "idle",
            content: "",
            headings: [],
            error: null,
          },
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "세션을 새로고침하지 못했습니다.",
      });
    }
  },
}));

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
