import { beforeEach, describe, expect, it, vi } from "vitest";

import { getInitialSession, readMarkdownFile, refreshSession } from "@/lib/tauri";
import { useAppStore } from "@/store/app-store";
import type { HeadingItem, MarkdownDocument } from "@/types/content";

vi.mock("@/lib/tauri", () => ({
  getInitialSession: vi.fn(),
  readMarkdownFile: vi.fn(),
  refreshSession: vi.fn(),
}));

const heading: HeadingItem = { depth: 1, text: "Title", id: "title" };

function markdownDocument(relativePath: string, content: string, headings: HeadingItem[] = [heading]): MarkdownDocument {
  return {
    relativePath,
    content,
    headings,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
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
    documentLoadToken: 0,
    isSidebarOpen: false,
    document: {
      state: "idle",
      content: "",
      headings: [],
      error: null,
    },
  });
}

describe("viewer app store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("bootstraps the viewer session and opens the selected document", async () => {
    vi.mocked(getInitialSession).mockResolvedValue({
      rootDir: "/vault",
      files: ["notes/a.md"],
      selectedFile: "notes/a.md",
    });
    vi.mocked(readMarkdownFile).mockResolvedValue(markdownDocument("notes/a.md", "# Title\n"));

    await useAppStore.getState().bootstrap();

    expect(getInitialSession).toHaveBeenCalledOnce();
    expect(readMarkdownFile).toHaveBeenCalledWith("notes/a.md");
    expect(useAppStore.getState()).toMatchObject({
      bootstrapState: "ready",
      rootDir: "/vault",
      files: ["notes/a.md"],
      selectedFile: "notes/a.md",
    });
    expect(useAppStore.getState().document).toMatchObject({
      state: "ready",
      content: "# Title\n",
      headings: [heading],
      error: null,
    });
  });

  it("ignores stale document reads when a newer selection finishes first", async () => {
    const slowRead = deferred<MarkdownDocument>();
    const fastRead = deferred<MarkdownDocument>();
    vi.mocked(readMarkdownFile)
      .mockReturnValueOnce(slowRead.promise)
      .mockReturnValueOnce(fastRead.promise);

    const firstOpen = useAppStore.getState().openDocument("notes/slow.md");
    const secondOpen = useAppStore.getState().openDocument("notes/fast.md");

    fastRead.resolve(markdownDocument("notes/fast.md", "# Fast\n"));
    await secondOpen;

    slowRead.resolve(markdownDocument("notes/slow.md", "# Slow\n"));
    await firstOpen;

    expect(useAppStore.getState().selectedFile).toBe("notes/fast.md");
    expect(useAppStore.getState().document).toMatchObject({
      state: "ready",
      content: "# Fast\n",
    });
  });

  it("refreshes and reloads the selected document when the selection is unchanged", async () => {
    useAppStore.setState({ selectedFile: "notes/a.md" });
    vi.mocked(refreshSession).mockResolvedValue({
      rootDir: "/vault",
      files: ["notes/a.md", "notes/b.md"],
      selectedFile: "notes/a.md",
    });
    vi.mocked(readMarkdownFile).mockResolvedValue(markdownDocument("notes/a.md", "# Reloaded\n", []));

    await useAppStore.getState().refresh();

    expect(refreshSession).toHaveBeenCalledOnce();
    expect(readMarkdownFile).toHaveBeenCalledWith("notes/a.md");
    expect(useAppStore.getState()).toMatchObject({
      rootDir: "/vault",
      files: ["notes/a.md", "notes/b.md"],
      selectedFile: "notes/a.md",
      scanState: "completed",
    });
    expect(useAppStore.getState().document).toMatchObject({
      state: "ready",
      content: "# Reloaded\n",
      headings: [{ depth: 1, text: "Reloaded", id: "reloaded" }],
    });
  });

  it("records refresh errors without clearing the current viewer document", async () => {
    useAppStore.setState({
      selectedFile: "notes/a.md",
      document: {
        state: "ready",
        content: "# Existing\n",
        headings: [heading],
        error: null,
      },
    });
    vi.mocked(refreshSession).mockRejectedValue(new Error("scan failed"));

    await useAppStore.getState().refresh();

    expect(useAppStore.getState().scanState).toBe("error");
    expect(useAppStore.getState().scanError).toBe("scan failed");
    expect(useAppStore.getState().document).toMatchObject({
      state: "ready",
      content: "# Existing\n",
    });
  });
});
