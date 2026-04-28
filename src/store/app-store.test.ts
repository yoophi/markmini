import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppStore } from "@/store/app-store";
import { readMarkdownFile, writeMarkdownFile } from "@/lib/tauri";
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

function markdownDocument(relativePath: string, content: string): MarkdownDocument {
  return {
    relativePath,
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
    scanState: "idle",
    scanSkippedPaths: [],
    scanSkippedPathSet: new Set(),
    scanError: null,
    selectedFile: null,
    recentDocuments: [],
    documentLoadToken: 0,
    isSidebarOpen: false,
    documentSearchQuery: "",
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
    resetStore();
  });

  it("stores the document search query in window state", () => {
    useAppStore.getState().setDocumentSearchQuery("guide");

    expect(useAppStore.getState().documentSearchQuery).toBe("guide");
  });

  it("tracks recently opened documents without duplicates and keeps the list short", async () => {
    vi.mocked(readMarkdownFile).mockImplementation(async (path) => markdownDocument(path, `# ${path}\n`));

    for (const path of ["a.md", "b.md", "c.md", "d.md", "e.md", "f.md", "c.md"]) {
      await useAppStore.getState().openDocument(path);
    }

    expect(useAppStore.getState().recentDocuments).toEqual(["c.md", "f.md", "e.md", "d.md", "b.md"]);
  });

  it("saves the dirty draft and clears dirty state", async () => {
    vi.mocked(readMarkdownFile).mockResolvedValue(markdownDocument("notes/a.md", "# Saved\n"));
    vi.mocked(writeMarkdownFile).mockResolvedValue(markdownDocument("notes/a.md", "# Draft\n"));

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
