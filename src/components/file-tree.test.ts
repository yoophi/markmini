import { describe, expect, it } from "vitest";

import {
  DOCUMENT_TREE_SEARCH_QUERY_STORAGE_KEY,
  DOCUMENT_TREE_SORT_MODE_STORAGE_KEY,
  buildTree,
  filterFiles,
  flattenVisibleTree,
  formatModifiedAt,
  parseSortMode,
  readStoredSearchQuery,
  readStoredSortMode,
  shouldShowSearchClearButton,
  splitHighlightedText,
  treeNodeIndent,
  writeStoredSearchQuery,
  writeStoredSortMode,
} from "./file-tree";

const files = ["docs/guide.md", "notes/today.md", "projects/markmini/plan.md"];

describe("document tree filtering", () => {
  it("returns all files when the normalized search query is empty", () => {
    expect(filterFiles(files, "")).toEqual(files);
  });

  it("filters documents by case-insensitive path match", () => {
    expect(filterFiles(files, "MARKMINI".toLocaleLowerCase())).toEqual(["projects/markmini/plan.md"]);
  });

  it("filters documents by rendered file label", () => {
    expect(filterFiles(files, "today")).toEqual(["notes/today.md"]);
  });

  it("keeps parent directories for filtered results", () => {
    expect(buildTree(filterFiles(files, "plan"))).toMatchObject([
      {
        kind: "directory",
        name: "projects",
        path: "projects",
        children: [
          {
            kind: "directory",
            name: "markmini",
            path: "projects/markmini",
            children: [
              {
                kind: "file",
                name: "plan",
                path: "projects/markmini/plan.md",
              },
            ],
          },
        ],
      },
    ]);
  });
});

describe("document tree search query persistence", () => {
  it("stores and restores the query in session storage", () => {
    const sessionStorage = installSessionStorageMock();
    window.sessionStorage.clear();

    writeStoredSearchQuery("markmini");

    expect(sessionStorage.getItem(DOCUMENT_TREE_SEARCH_QUERY_STORAGE_KEY)).toBe("markmini");
    expect(readStoredSearchQuery()).toBe("markmini");
  });

  it("removes the stored query when the query is cleared", () => {
    const sessionStorage = installSessionStorageMock();
    sessionStorage.setItem(DOCUMENT_TREE_SEARCH_QUERY_STORAGE_KEY, "guide");

    writeStoredSearchQuery("");

    expect(sessionStorage.getItem(DOCUMENT_TREE_SEARCH_QUERY_STORAGE_KEY)).toBeNull();
    expect(readStoredSearchQuery()).toBe("");
  });
});

describe("document tree search affordances", () => {
  it("shows the clear affordance only while there is query text", () => {
    expect(shouldShowSearchClearButton("")).toBe(false);
    expect(shouldShowSearchClearButton("guide")).toBe(true);
  });
});

describe("document tree search highlighting", () => {
  it("splits the first case-insensitive label match for highlighting", () => {
    expect(splitHighlightedText("MarkMini Plan", "mini")).toEqual([
      { text: "Mark", highlight: false },
      { text: "Mini", highlight: true },
      { text: " Plan", highlight: false },
    ]);
  });

  it("does not highlight when the query is empty or missing from the label", () => {
    expect(splitHighlightedText("Guide", "")).toEqual([{ text: "Guide", highlight: false }]);
    expect(splitHighlightedText("Guide", "plan")).toEqual([{ text: "Guide", highlight: false }]);
  });
});

function installSessionStorageMock() {
  const values = new Map<string, string>();
  const sessionStorage = {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };

  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage },
    configurable: true,
  });

  return sessionStorage;
}

describe("file tree structure", () => {
  it("preserves every parent directory for deeply nested markdown files", () => {
    const tree = buildTree(["docs/a/b/file.md", "docs/index.md", "README.md"]);

    expect(tree).toMatchObject([
      {
        kind: "directory",
        name: "docs",
        path: "docs",
        children: [
          {
            kind: "directory",
            name: "a",
            path: "docs/a",
            children: [
              {
                kind: "directory",
                name: "b",
                path: "docs/a/b",
                children: [
                  {
                    kind: "file",
                    name: "file",
                    path: "docs/a/b/file.md",
                    children: [],
                  },
                ],
              },
            ],
          },
          {
            kind: "file",
            name: "index",
            path: "docs/index.md",
            children: [],
          },
        ],
      },
      {
        kind: "file",
        name: "README",
        path: "README.md",
        children: [],
      },
    ]);
  });

  it("only shows children for expanded directories", () => {
    const tree = buildTree(["docs/a/b/file.md", "docs/index.md", "README.md"]);

    expect(flattenVisibleTree(tree, new Set()).map((item) => item.node.path)).toEqual(["docs", "README.md"]);
    expect(flattenVisibleTree(tree, new Set(["docs", "docs/a"])).map((item) => item.node.path)).toEqual([
      "docs",
      "docs/a",
      "docs/a/b",
      "docs/index.md",
      "README.md",
    ]);
    expect(flattenVisibleTree(tree, new Set(["docs", "docs/a", "docs/a/b"])).map((item) => item.node.path)).toEqual([
      "docs",
      "docs/a",
      "docs/a/b",
      "docs/a/b/file.md",
      "docs/index.md",
      "README.md",
    ]);
  });

  it("uses a predictable indentation step for each path depth", () => {
    expect([0, 1, 2, 3].map(treeNodeIndent)).toEqual(["8px", "28px", "48px", "68px"]);
  });
});

describe("document tree sorting", () => {
  it("parses unknown sort modes as name sort", () => {
    expect(parseSortMode("path")).toBe("path");
    expect(parseSortMode("modified")).toBe("modified");
    expect(parseSortMode(null)).toBe("name");
  });

  it("stores and restores the selected sort mode in session storage", () => {
    const sessionStorage = installSessionStorageMock();

    writeStoredSortMode("path");

    expect(sessionStorage.getItem(DOCUMENT_TREE_SORT_MODE_STORAGE_KEY)).toBe("path");
    expect(readStoredSortMode()).toBe("path");
  });

  it("sorts files and directories by newest modified time when metadata is available", () => {
    const tree = buildTree(
      ["old.md", "docs/older.md", "docs/newer.md", "notes/latest.md"],
      "modified",
      {
        "old.md": { relativePath: "old.md", modifiedAt: 10 },
        "docs/older.md": { relativePath: "docs/older.md", modifiedAt: 20 },
        "docs/newer.md": { relativePath: "docs/newer.md", modifiedAt: 30 },
        "notes/latest.md": { relativePath: "notes/latest.md", modifiedAt: 40 },
      },
    );

    expect(tree.map((node) => node.path)).toEqual(["notes", "docs", "old.md"]);
    expect(tree[1]?.children.map((node) => node.path)).toEqual(["docs/newer.md", "docs/older.md"]);
  });
});

describe("modified time labels", () => {
  it("formats recent modified times without exposing file content", () => {
    const now = Date.UTC(2026, 3, 28, 13, 0, 0);

    expect(formatModifiedAt(null, now)).toBeNull();
    expect(formatModifiedAt(now - 30_000, now)).toBe("방금 전");
    expect(formatModifiedAt(now - 5 * 60_000, now)).toBe("5분 전");
    expect(formatModifiedAt(now - 3 * 60 * 60_000, now)).toBe("3시간 전");
    expect(formatModifiedAt(now - 2 * 24 * 60 * 60_000, now)).toBe("2일 전");
  });
});
