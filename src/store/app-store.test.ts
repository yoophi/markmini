/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppStore } from "@/store/app-store";
import { getInitialSession, readMarkdownFile, writeMarkdownFile } from "@/lib/tauri";
import type { HeadingItem, MarkdownDocument } from "@/types/content";

vi.mock("@/lib/tauri", () => ({
  createMarkdownFile: vi.fn(),
  deleteMarkdownFile: vi.fn(),
  getInitialSession: vi.fn(),
  readMarkdownFile: vi.fn(),
  refreshSession: vi.fn(),
  renameMarkdownFile: vi.fn(),
  writeMarkdownFile: vi.fn(),
}));

const heading: HeadingItem = { depth: 1, text: "Saved", id: "saved" };

function markdownDocument(relativePath: string, content: string, modifiedAt = 100): MarkdownDocument {
  return {
    relativePath,
    fileMetadata: { relativePath, modifiedAt, sizeBytes: content.length },
    content,
    headings: [heading],
  };
}

function resetStore() {
  useAppStore.setState({
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
    documentSortDirections: {},
    successMessage: null,
    successMessageId: 0,
    document: {
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
    },
  });
}

describe("app store document safety flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetStore();
  });

  it("stores document tree controls in window state and persists sort mode per root", () => {
    useAppStore.setState({ rootDir: "/vault" });

    useAppStore.getState().setDocumentSearchQuery("guide");
    useAppStore.getState().setDocumentSortMode("name");
    useAppStore.getState().setDocumentSortDirection("desc");

    expect(useAppStore.getState().documentSearchQuery).toBe("guide");
    expect(useAppStore.getState().documentSortMode).toBe("name");
    expect(useAppStore.getState().documentSortDirection).toBe("desc");
    expect(localStorage.getItem("markmini:document-sort-mode:/vault")).toBe("name");
    expect(localStorage.getItem("markmini:document-sort-direction:/vault")).toBe("desc");
  });

  it("toggles favorite documents and persists only relative paths", () => {
    useAppStore.setState({ rootDir: "/vault" });

    useAppStore.getState().toggleFavoriteDocument("notes/a.md");
    useAppStore.getState().toggleFavoriteDocument("notes/b.md");
    useAppStore.getState().toggleFavoriteDocument("notes/a.md");

    expect(useAppStore.getState().favoriteDocuments).toEqual(["notes/b.md"]);
    expect(JSON.parse(localStorage.getItem("markmini:favorite-documents:/vault") ?? "[]")).toEqual(["notes/b.md"]);
  });

  it("tracks recently opened documents without duplicates and keeps the list short", async () => {
    vi.mocked(readMarkdownFile).mockImplementation(async (path) => markdownDocument(path, `# ${path}\n`));

    for (const path of ["a.md", "b.md", "c.md", "d.md", "e.md", "f.md", "c.md"]) {
      await useAppStore.getState().openDocument(path);
    }

    expect(useAppStore.getState().recentDocuments).toEqual(["c.md", "f.md", "e.md", "d.md", "b.md"]);
  });

  it("restores persisted favorite and recent documents for the current root and drops stale entries", async () => {
    localStorage.setItem("markmini:document-sort-mode:/vault", "modified");
    localStorage.setItem("markmini:favorite-documents:/vault", JSON.stringify(["notes/b.md", "missing.md", "notes/a.md"]));
    localStorage.setItem(
      "markmini:recent-documents:/vault",
      JSON.stringify(["notes/a.md", "missing.md", "notes/b.md", "notes/a.md"]),
    );
    vi.mocked(getInitialSession).mockResolvedValue({
      rootDir: "/vault",
      files: ["notes/a.md", "notes/b.md"],
      fileMetadata: [
        { relativePath: "notes/a.md", modifiedAt: 100, sizeBytes: 10 },
        { relativePath: "notes/b.md", modifiedAt: 200, sizeBytes: 20 },
      ],
      selectedFile: null,
    });

    await useAppStore.getState().bootstrap();

    expect(useAppStore.getState().documentSortMode).toBe("modified");
    expect(useAppStore.getState().fileMetadata).toEqual({
      "notes/a.md": { relativePath: "notes/a.md", modifiedAt: 100, sizeBytes: 10 },
      "notes/b.md": { relativePath: "notes/b.md", modifiedAt: 200, sizeBytes: 20 },
    });
    expect(useAppStore.getState().favoriteDocuments).toEqual(["notes/b.md", "notes/a.md"]);
    expect(useAppStore.getState().recentDocuments).toEqual(["notes/a.md", "notes/b.md"]);
    expect(JSON.parse(localStorage.getItem("markmini:favorite-documents:/vault") ?? "[]")).toEqual(["notes/b.md", "notes/a.md"]);
    expect(JSON.parse(localStorage.getItem("markmini:recent-documents:/vault") ?? "[]")).toEqual(["notes/a.md", "notes/b.md"]);
  });

  it("restores persisted file size sort mode", async () => {
    localStorage.setItem("markmini:document-sort-mode:/vault", "size");
    vi.mocked(getInitialSession).mockResolvedValue({
      rootDir: "/vault",
      files: [],
      fileMetadata: [],
      selectedFile: null,
    });

    await useAppStore.getState().bootstrap();

    expect(useAppStore.getState().documentSortMode).toBe("size");
    expect(useAppStore.getState().documentSortDirection).toBe("desc");
  });

  it("restores persisted sort direction", async () => {
    localStorage.setItem("markmini:document-sort-mode:/vault", "name");
    localStorage.setItem("markmini:document-sort-direction:/vault", "desc");
    vi.mocked(getInitialSession).mockResolvedValue({
      rootDir: "/vault",
      files: [],
      fileMetadata: [],
      selectedFile: null,
    });

    await useAppStore.getState().bootstrap();

    expect(useAppStore.getState().documentSortMode).toBe("name");
    expect(useAppStore.getState().documentSortDirection).toBe("desc");
  });

  it("remembers sort directions per mode", () => {
    useAppStore.setState({ rootDir: "/vault" });

    useAppStore.getState().setDocumentSortMode("name");
    useAppStore.getState().setDocumentSortDirection("desc");
    useAppStore.getState().setDocumentSortMode("size");

    expect(useAppStore.getState().documentSortDirection).toBe("desc");

    useAppStore.getState().setDocumentSortDirection("asc");
    useAppStore.getState().setDocumentSortMode("name");

    expect(useAppStore.getState().documentSortDirection).toBe("desc");
    expect(JSON.parse(localStorage.getItem("markmini:document-sort-directions:/vault") ?? "{}")).toEqual({
      name: "desc",
      size: "asc",
    });
  });

  it("restores persisted per-mode sort directions ahead of the legacy direction key", async () => {
    localStorage.setItem("markmini:document-sort-mode:/vault", "size");
    localStorage.setItem("markmini:document-sort-direction:/vault", "desc");
    localStorage.setItem("markmini:document-sort-directions:/vault", JSON.stringify({ size: "asc", name: "desc", unknown: "asc" }));
    vi.mocked(getInitialSession).mockResolvedValue({
      rootDir: "/vault",
      files: [],
      fileMetadata: [],
      selectedFile: null,
    });

    await useAppStore.getState().bootstrap();

    expect(useAppStore.getState().documentSortMode).toBe("size");
    expect(useAppStore.getState().documentSortDirection).toBe("asc");
    expect(useAppStore.getState().documentSortDirections).toEqual({ size: "asc", name: "desc" });
  });

  it("falls back to path sort when persisted sort mode is invalid", async () => {
    localStorage.setItem("markmini:document-sort-mode:/vault", "updated-at");
    vi.mocked(getInitialSession).mockResolvedValue({
      rootDir: "/vault",
      files: [],
      fileMetadata: [],
      selectedFile: null,
    });

    await useAppStore.getState().bootstrap();

    expect(useAppStore.getState().documentSortMode).toBe("path");
  });

  it("saves the dirty draft and clears dirty state", async () => {
    vi.mocked(readMarkdownFile).mockResolvedValue(markdownDocument("notes/a.md", "# Saved\n", 100));
    vi.mocked(writeMarkdownFile).mockResolvedValue(markdownDocument("notes/a.md", "# Draft\n", 200));

    await useAppStore.getState().openDocument("notes/a.md");
    useAppStore.getState().updateDraftContent("# Draft\n");

    expect(useAppStore.getState().document.isDirty).toBe(true);

    await useAppStore.getState().saveCurrentDocument();

    expect(writeMarkdownFile).toHaveBeenCalledWith("notes/a.md", "# Draft\n");
    expect(useAppStore.getState().document).toMatchObject({
      content: "# Draft\n",
      savedContent: "# Draft\n",
      draftContent: "# Draft\n",
      isDirty: false,
      isSaving: false,
      error: null,
    });
    expect(useAppStore.getState().successMessage).toBe("저장했습니다: notes/a.md");
    expect(useAppStore.getState().fileMetadata["notes/a.md"]).toEqual({ relativePath: "notes/a.md", modifiedAt: 200, sizeBytes: "# Draft\n".length });
  });

  it("does not save over an unresolved external change", async () => {
    vi.mocked(readMarkdownFile).mockResolvedValue(markdownDocument("notes/a.md", "# Saved\n"));

    await useAppStore.getState().openDocument("notes/a.md");
    useAppStore.getState().updateDraftContent("# Local draft\n");
    await useAppStore.getState().reloadCurrentDocument(false);

    expect(useAppStore.getState().document.externalChangeDetected).toBe(true);

    await useAppStore.getState().saveCurrentDocument();

    expect(writeMarkdownFile).not.toHaveBeenCalled();
    expect(useAppStore.getState().document).toMatchObject({
      draftContent: "# Local draft\n",
      isDirty: true,
      externalChangeDetected: true,
    });
  });

  it("keeps a dirty draft when reload detects an external change without force", async () => {
    vi.mocked(readMarkdownFile).mockResolvedValue(markdownDocument("notes/a.md", "# Saved\n"));

    await useAppStore.getState().openDocument("notes/a.md");
    useAppStore.getState().updateDraftContent("# Local draft\n");
    vi.mocked(readMarkdownFile).mockClear();

    await useAppStore.getState().reloadCurrentDocument(false);

    expect(readMarkdownFile).not.toHaveBeenCalled();
    expect(useAppStore.getState().document).toMatchObject({
      content: "# Local draft\n",
      draftContent: "# Local draft\n",
      savedContent: "# Saved\n",
      isDirty: true,
      externalChangeDetected: true,
    });
  });

  it("force reload discards the draft and restores disk content", async () => {
    vi.mocked(readMarkdownFile)
      .mockResolvedValueOnce(markdownDocument("notes/a.md", "# Saved\n"))
      .mockResolvedValueOnce(markdownDocument("notes/a.md", "# Disk\n"));

    await useAppStore.getState().openDocument("notes/a.md");
    useAppStore.getState().updateDraftContent("# Local draft\n");

    await useAppStore.getState().reloadCurrentDocument(true);

    expect(readMarkdownFile).toHaveBeenLastCalledWith("notes/a.md");
    expect(useAppStore.getState().document).toMatchObject({
      content: "# Disk\n",
      savedContent: "# Disk\n",
      draftContent: "# Disk\n",
      isDirty: false,
      externalChangeDetected: false,
    });
  });
});
