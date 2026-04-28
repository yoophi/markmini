import { describe, expect, it } from "vitest";

import { buildTree, filterFiles } from "./file-tree";

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
