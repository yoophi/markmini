import { create } from "zustand";

import { extractHeadings } from "@/lib/markdown";
import { getInitialSession, readMarkdownFile, refreshSession } from "@/lib/tauri";
import type { HeadingItem } from "@/types/content";

type BootstrapState = "idle" | "loading" | "ready" | "error";
type DocumentState = "idle" | "loading" | "ready" | "error";

interface AppStore {
  bootstrapState: BootstrapState;
  error: string | null;
  rootDir: string | null;
  files: string[];
  selectedFile: string | null;
  isSidebarOpen: boolean;
  document: {
    state: DocumentState;
    content: string;
    headings: HeadingItem[];
    error: string | null;
  };
  setSidebarOpen: (open: boolean) => void;
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
  selectedFile: null,
  isSidebarOpen: false,
  document: {
    state: "idle",
    content: "",
    headings: [],
    error: null,
  },
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  bootstrap: async () => {
    set({
      bootstrapState: "loading",
      error: null,
      document: {
        state: "idle",
        content: "",
        headings: [],
        error: null,
      },
    });

    try {
      const session = await getInitialSession();
      set({
        bootstrapState: "ready",
        rootDir: session.rootDir,
        files: session.files,
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
      set({
        bootstrapState: "ready",
        error: null,
        rootDir: session.rootDir,
        files: session.files,
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
