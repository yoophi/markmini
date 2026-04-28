import { describe, expect, it } from "vitest";

import {
  DOCUMENT_TREE_SEARCH_QUERY_STORAGE_KEY,
  buildTree,
  filterFiles,
  flattenVisibleTree,
  readStoredSearchQuery,
  treeNodeIndent,
  writeStoredSearchQuery,
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
