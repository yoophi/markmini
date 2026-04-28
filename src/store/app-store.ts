import { create } from "zustand";

import { extractHeadings } from "@/lib/markdown";
import {
  createMarkdownFile,
  deleteMarkdownFile,
  getInitialSession,
  readMarkdownFile,
  refreshSession,
  renameMarkdownFile,
  writeMarkdownFile,
  type ScanProgressPayload,
} from "@/lib/tauri";
import type { HeadingItem, MarkdownFileMetadata, ScanStatus } from "@/types/content";

type BootstrapState = "idle" | "loading" | "ready" | "error";
type DocumentState = "idle" | "loading" | "ready" | "error";
type DocumentMode = "preview" | "edit";
type DocumentSortMode = "path" | "name" | "modified" | "size";
type DocumentSortDirection = "asc" | "desc";

interface AppStore {
  bootstrapState: BootstrapState;
  error: string | null;
  rootDir: string | null;
  files: string[];
  fileSet: ReadonlySet<string>;
  fileMetadata: Record<string, MarkdownFileMetadata>;
  scanState: ScanStatus;
  scanSkippedPaths: string[];
  scanSkippedPathSet: ReadonlySet<string>;
  scanError: string | null;
  selectedFile: string | null;
  favoriteDocuments: string[];
  recentDocuments: string[];
  documentLoadToken: number;
  isSidebarOpen: boolean;
  documentSearchQuery: string;
  documentSortMode: DocumentSortMode;
  documentSortDirection: DocumentSortDirection;
  successMessage: string | null;
  successMessageId: number;
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
  setDocumentSearchQuery: (query: string) => void;
  setDocumentSortMode: (mode: DocumentSortMode) => void;
  setDocumentSortDirection: (direction: DocumentSortDirection) => void;
  toggleFavoriteDocument: (relativePath: string) => void;
  clearSuccessMessage: () => void;
  applyScanProgress: (payload: ScanProgressPayload) => Promise<void>;
  bootstrap: () => Promise<void>;
  openDocument: (relativePath: string) => Promise<void>;
  createDocument: (relativePath: string, content?: string) => Promise<void>;
  renameCurrentDocument: (toRelativePath: string) => Promise<void>;
  deleteCurrentDocument: () => Promise<void>;
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
  fileMetadata: {},
  scanState: "idle",
  scanSkippedPaths: [],
  scanSkippedPathSet: new Set(),
  scanError: null,
  selectedFile: null,
  favoriteDocuments: [],
  recentDocuments: [],
  documentLoadToken: 0,
  isSidebarOpen: false,
  documentSearchQuery: "",
  documentSortMode: "path",
  documentSortDirection: "asc",
  successMessage: null,
  successMessageId: 0,
  document: createEmptyDocument(),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setDocumentSearchQuery: (query) => set({ documentSearchQuery: query }),
  setDocumentSortMode: (mode) =>
    set((state) => {
      const direction = defaultDocumentSortDirection(mode);
      persistDocumentSortMode(state.rootDir, mode);
      persistDocumentSortDirection(state.rootDir, direction);
      return { documentSortMode: mode, documentSortDirection: direction };
    }),
  setDocumentSortDirection: (direction) =>
    set((state) => {
      persistDocumentSortDirection(state.rootDir, direction);
      return { documentSortDirection: direction };
    }),
  toggleFavoriteDocument: (relativePath) => {
    set((state) => {
      const favoriteDocuments = state.favoriteDocuments.includes(relativePath)
        ? state.favoriteDocuments.filter((entry) => entry !== relativePath)
        : [relativePath, ...state.favoriteDocuments].slice(0, 20);
      persistFavoriteDocuments(state.rootDir, favoriteDocuments);
      return { favoriteDocuments };
    });
  },
  clearSuccessMessage: () => set({ successMessage: null }),
  applyScanProgress: async (payload) => {
    const state = get();
    const { values: files, valueSet: fileSet } = mergeSortedUnique(state.files, state.fileSet, payload.files);
    const fileMetadata = mergeFileMetadata(state.fileMetadata, payload.fileMetadata);
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
      fileMetadata,
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
      const fileMetadata = fileMetadataByPath(session.fileMetadata);
      const favoriteDocuments = loadFavoriteDocuments(session.rootDir, fileSet);
      const recentDocuments = loadRecentDocuments(session.rootDir, fileSet);
      const documentSortMode = loadDocumentSortMode(session.rootDir);
      const documentSortDirection = loadDocumentSortDirection(session.rootDir, documentSortMode);
      set({
        bootstrapState: "ready",
        rootDir: session.rootDir,
        files,
        fileSet,
        fileMetadata,
        favoriteDocuments,
        recentDocuments,
        documentSortMode,
        documentSortDirection,
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
    const requestPath = relativePath;
    const current = get();

    const loadToken = current.documentLoadToken + 1;
    set({
      selectedFile: relativePath,
      documentLoadToken: loadToken,
      document: createLoadingDocument(),
    });

    try {
      const document = await readMarkdownFile(requestPath);
      if (!isCurrentDocumentLoad(get(), requestPath, loadToken)) {
        return;
      }

      const recentDocuments = addRecentDocument(get().recentDocuments, document.relativePath);
      persistRecentDocuments(get().rootDir, recentDocuments);
      set({
        selectedFile: document.relativePath,
        fileMetadata: mergeFileMetadata(get().fileMetadata, [document.fileMetadata]),
        recentDocuments,
        successMessage: null,
        document: createReadyDocument(document.content, document.headings),
      });
    } catch (error) {
      if (!isCurrentDocumentLoad(get(), requestPath, loadToken)) {
        return;
      }

      set({
        document: createErrorDocument(error instanceof Error ? error.message : "문서를 열지 못했습니다."),
      });
    }
  },
  createDocument: async (relativePath, content = "") => {
    const state = get();

    const normalizedPath = normalizeRelativeMarkdownPath(relativePath);
    if (!normalizedPath) {
      return;
    }

    set({
      error: null,
      selectedFile: normalizedPath,
      document: createLoadingDocument(),
    });

    try {
      const document = await createMarkdownFile(normalizedPath, content);
      const { values: files, valueSet: fileSet } = mergeSortedUnique(state.files, state.fileSet, [document.relativePath]);
      const fileMetadata = mergeFileMetadata(state.fileMetadata, [document.fileMetadata]);
      set((state) => {
        const recentDocuments = addRecentDocument(state.recentDocuments, document.relativePath);
        persistRecentDocuments(state.rootDir, recentDocuments);
        return {
          files,
          fileSet,
          fileMetadata,
          selectedFile: document.relativePath,
          recentDocuments,
          successMessage: `새 문서를 만들었습니다: ${document.relativePath}`,
          successMessageId: state.successMessageId + 1,
          document: {
            ...createReadyDocument(document.content, document.headings),
            mode: "edit",
          },
        };
      });
    } catch (error) {
      set({
        selectedFile: state.selectedFile,
        document: createErrorDocument(error instanceof Error ? error.message : "문서를 생성하지 못했습니다."),
      });
    }
  },
  renameCurrentDocument: async (toRelativePath) => {
    const state = get();
    const current = state.selectedFile;
    if (!current) {
      return;
    }

    const normalizedPath = normalizeRelativeMarkdownPath(toRelativePath);
    if (!normalizedPath) {
      return;
    }

    set({ document: createLoadingDocument() });

    try {
      const result = await renameMarkdownFile(current, normalizedPath);
      const files = state.files
        .filter((entry) => entry !== result.oldRelativePath)
        .concat(result.document.relativePath)
        .sort((a, b) => a.localeCompare(b));
      const { [result.oldRelativePath]: _oldMetadata, ...remainingFileMetadata } = state.fileMetadata;
      const fileMetadata = mergeFileMetadata(remainingFileMetadata, [result.document.fileMetadata]);
      set((state) => {
        const favoriteDocuments = state.favoriteDocuments.includes(result.oldRelativePath)
          ? [result.document.relativePath, ...state.favoriteDocuments.filter((entry) => entry !== result.oldRelativePath)]
          : state.favoriteDocuments;
        const recentDocuments = addRecentDocument(
          state.recentDocuments.filter((entry) => entry !== result.oldRelativePath),
          result.document.relativePath,
        );
        persistFavoriteDocuments(state.rootDir, favoriteDocuments);
        persistRecentDocuments(state.rootDir, recentDocuments);
        return {
          files,
          fileSet: new Set(files),
          fileMetadata,
          selectedFile: result.document.relativePath,
          favoriteDocuments,
          recentDocuments,
          successMessage: `문서 이름을 변경했습니다: ${result.document.relativePath}`,
          successMessageId: state.successMessageId + 1,
          document: createReadyDocument(result.document.content, result.document.headings),
        };
      });
    } catch (error) {
      set({
        selectedFile: current,
        document: createErrorDocument(error instanceof Error ? error.message : "문서 이름을 변경하지 못했습니다."),
      });
    }
  },
  deleteCurrentDocument: async () => {
    const state = get();
    const current = state.selectedFile;
    if (!current) {
      return;
    }

    set({ document: createLoadingDocument() });

    try {
      const result = await deleteMarkdownFile(current);
      const files = state.files.filter((entry) => entry !== result.deletedRelativePath);
      const { [result.deletedRelativePath]: _deletedMetadata, ...fileMetadata } = state.fileMetadata;
      set((state) => {
        const favoriteDocuments = state.favoriteDocuments.filter((entry) => entry !== result.deletedRelativePath);
        const recentDocuments = state.recentDocuments.filter((entry) => entry !== result.deletedRelativePath);
        persistFavoriteDocuments(state.rootDir, favoriteDocuments);
        persistRecentDocuments(state.rootDir, recentDocuments);
        return {
          files,
          fileSet: new Set(files),
          fileMetadata,
          selectedFile: result.nextSelectedFile,
          favoriteDocuments,
          recentDocuments,
          successMessage: `문서를 삭제했습니다: ${result.deletedRelativePath}`,
          successMessageId: state.successMessageId + 1,
          document: result.nextSelectedFile ? createLoadingDocument() : createEmptyDocument(),
        };
      });

      if (result.nextSelectedFile) {
        await get().openDocument(result.nextSelectedFile);
      }
    } catch (error) {
      set({
        selectedFile: current,
        document: createErrorDocument(error instanceof Error ? error.message : "문서를 삭제하지 못했습니다."),
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
      successMessage: null,
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
      set((state) => ({
        selectedFile: document.relativePath,
        fileMetadata: mergeFileMetadata(state.fileMetadata, [document.fileMetadata]),
        successMessage: `저장했습니다: ${document.relativePath}`,
        successMessageId: state.successMessageId + 1,
        document: {
          ...createReadyDocument(document.content, document.headings),
          mode: get().document.mode,
          lastSavedAt: new Date().toISOString(),
        },
      }));
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
    const requestPath = current;
    const currentState = get();

    const currentDocument = currentState.document;
    if (currentDocument.isDirty && !force) {
      set({
        document: {
          ...currentDocument,
          externalChangeDetected: true,
        },
      });
      return;
    }

    const loadToken = currentState.documentLoadToken + 1;
    set({ documentLoadToken: loadToken });

    try {
      const document = await readMarkdownFile(requestPath);
      if (!isCurrentDocumentLoad(get(), requestPath, loadToken)) {
        return;
      }

      set((state) => ({
        successMessage: null,
        selectedFile: document.relativePath,
        fileMetadata: mergeFileMetadata(state.fileMetadata, [document.fileMetadata]),
        document: {
          ...createReadyDocument(document.content, document.headings),
          mode: state.document.mode,
        },
      }));
    } catch (error) {
      if (!isCurrentDocumentLoad(get(), requestPath, loadToken)) {
        return;
      }

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
    const previousState = get();
    const previousSelection = previousState.selectedFile;
    const hadDirtyDocument = previousState.document.isDirty;

    try {
      const session = await refreshSession();
      const { values: files, valueSet: fileSet } = mergeSortedUnique([], new Set(), session.files);
      const fileMetadata = fileMetadataByPath(session.fileMetadata);
      const favoriteDocuments = previousState.favoriteDocuments.filter((entry) => fileSet.has(entry));
      const recentDocuments = previousState.recentDocuments.filter((entry) => fileSet.has(entry));
      persistFavoriteDocuments(session.rootDir, favoriteDocuments);
      persistRecentDocuments(session.rootDir, recentDocuments);
      set({
        bootstrapState: "ready",
        error: null,
        rootDir: session.rootDir,
        files,
        fileSet,
        fileMetadata,
        favoriteDocuments,
        recentDocuments,
        scanState: "completed",
        scanSkippedPaths: [],
        scanSkippedPathSet: new Set(),
        scanError: null,
        successMessage: null,
      });

      if (previousSelection && session.files.includes(previousSelection)) {
        if (hadDirtyDocument) {
          await get().reloadCurrentDocument(true);
        }
        return;
      }

      if (previousSelection) {
        set({
          selectedFile: previousSelection,
          document: createErrorDocument("선택한 문서가 디스크에서 삭제되었거나 이동되었습니다."),
        });
        return;
      }

      if (session.selectedFile) {
        await get().openDocument(session.selectedFile);
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

function normalizeRelativeMarkdownPath(relativePath: string) {
  return relativePath.trim().replace(/^\/+/, "");
}

function isCurrentDocumentLoad(state: AppStore, requestPath: string, loadToken: number) {
  return state.selectedFile === requestPath && state.documentLoadToken === loadToken;
}

function addRecentDocument(recentDocuments: string[], relativePath: string) {
  return [relativePath, ...recentDocuments.filter((entry) => entry !== relativePath)].slice(0, 5);
}

function fileMetadataByPath(fileMetadata: MarkdownFileMetadata[]) {
  return fileMetadata.reduce<Record<string, MarkdownFileMetadata>>((metadataByPath, metadata) => {
    metadataByPath[metadata.relativePath] = metadata;
    return metadataByPath;
  }, {});
}

function mergeFileMetadata(
  current: Record<string, MarkdownFileMetadata>,
  incoming: MarkdownFileMetadata[],
): Record<string, MarkdownFileMetadata> {
  return {
    ...current,
    ...fileMetadataByPath(incoming),
  };
}

function loadDocumentSortMode(rootDir: string): DocumentSortMode {
  const stored = safeLocalStorageGet(documentSortModeStorageKey(rootDir));
  return isDocumentSortMode(stored) ? stored : "path";
}

function persistDocumentSortMode(rootDir: string | null, mode: DocumentSortMode) {
  if (!rootDir) {
    return;
  }

  safeLocalStorageSet(documentSortModeStorageKey(rootDir), mode);
}

function loadDocumentSortDirection(rootDir: string, mode: DocumentSortMode): DocumentSortDirection {
  const stored = safeLocalStorageGet(documentSortDirectionStorageKey(rootDir));
  return isDocumentSortDirection(stored) ? stored : defaultDocumentSortDirection(mode);
}

function persistDocumentSortDirection(rootDir: string | null, direction: DocumentSortDirection) {
  if (!rootDir) {
    return;
  }

  safeLocalStorageSet(documentSortDirectionStorageKey(rootDir), direction);
}

function defaultDocumentSortDirection(mode: DocumentSortMode): DocumentSortDirection {
  return mode === "modified" || mode === "size" ? "desc" : "asc";
}

function isDocumentSortMode(value: string | null): value is DocumentSortMode {
  return value === "path" || value === "name" || value === "modified" || value === "size";
}

function isDocumentSortDirection(value: string | null): value is DocumentSortDirection {
  return value === "asc" || value === "desc";
}

function documentSortModeStorageKey(rootDir: string) {
  return `markmini:document-sort-mode:${rootDir}`;
}

function documentSortDirectionStorageKey(rootDir: string) {
  return `markmini:document-sort-direction:${rootDir}`;
}

function loadFavoriteDocuments(rootDir: string, fileSet: ReadonlySet<string>) {
  return loadStoredDocumentList(favoriteDocumentsStorageKey(rootDir), fileSet, 20);
}

function persistFavoriteDocuments(rootDir: string | null, favoriteDocuments: string[]) {
  persistStoredDocumentList(rootDir, "favorite", favoriteDocuments, 20);
}

function loadRecentDocuments(rootDir: string, fileSet: ReadonlySet<string>) {
  return loadStoredDocumentList(recentDocumentsStorageKey(rootDir), fileSet, 5);
}

function persistRecentDocuments(rootDir: string | null, recentDocuments: string[]) {
  persistStoredDocumentList(rootDir, "recent", recentDocuments, 5);
}

function loadStoredDocumentList(key: string, fileSet: ReadonlySet<string>, limit: number) {
  const stored = safeLocalStorageGet(key);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const documentPaths = parsed.filter((entry): entry is string => typeof entry === "string" && fileSet.has(entry));
    const deduped = [...new Set(documentPaths)].slice(0, limit);
    safeLocalStorageSet(key, JSON.stringify(deduped));
    return deduped;
  } catch {
    return [];
  }
}

function persistStoredDocumentList(rootDir: string | null, kind: "favorite" | "recent", documents: string[], limit: number) {
  if (!rootDir) {
    return;
  }

  const key = kind === "favorite" ? favoriteDocumentsStorageKey(rootDir) : recentDocumentsStorageKey(rootDir);
  safeLocalStorageSet(key, JSON.stringify(documents.slice(0, limit)));
}

function favoriteDocumentsStorageKey(rootDir: string) {
  return `markmini:favorite-documents:${rootDir}`;
}

function recentDocumentsStorageKey(rootDir: string) {
  return `markmini:recent-documents:${rootDir}`;
}

function safeLocalStorageGet(key: string) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage may be unavailable in restricted environments; recent documents remain session-local.
  }
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
