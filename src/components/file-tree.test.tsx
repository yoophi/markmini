/** @vitest-environment jsdom */

import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FileTree } from "@/components/file-tree";

const files = ["docs/guide.md", "notes/today.md", "projects/markmini/plan.md"];

afterEach(() => {
  cleanup();
});

function renderFileTree(options: Partial<React.ComponentProps<typeof FileTree>> = {}) {
  function ControlledFileTree() {
    const [searchQuery, setSearchQuery] = useState(options.searchQuery ?? "");

    return (
      <FileTree
        files={files}
        fileMetadata={{}}
        scanState="completed"
        skippedCount={0}
        selectedFile="docs/guide.md"
        favoriteDocuments={[]}
        recentDocuments={[]}
        onSelect={vi.fn()}
        {...options}
        searchQuery={searchQuery}
        sortMode="path"
        onSearchQueryChange={(query) => {
          setSearchQuery(query);
          options.onSearchQueryChange?.(query);
        }}
        onSortModeChange={vi.fn()}
      />
    );
  }

  return render(<ControlledFileTree />);
}

describe("FileTree search", () => {
  it("shows favorite documents above recent documents and opens them through the normal select flow", () => {
    const onSelect = vi.fn();
    renderFileTree({ favoriteDocuments: ["projects/markmini/plan.md", "missing.md"], recentDocuments: ["notes/today.md"], onSelect });

    expect(screen.queryByText("Favorites")).not.toBeNull();
    expect(screen.queryByText("Recent")).not.toBeNull();
    expect(screen.queryByText("projects/markmini/plan.md")).not.toBeNull();
    expect(screen.queryByText("missing.md")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /plan/i }));

    expect(onSelect).toHaveBeenCalledWith("projects/markmini/plan.md");
  });

  it("shows recent documents and opens them through the normal select flow", () => {
    const onSelect = vi.fn();
    renderFileTree({ recentDocuments: ["notes/today.md", "missing.md"], onSelect });

    expect(screen.queryByText("Recent")).not.toBeNull();
    expect(screen.queryByText("notes/today.md")).not.toBeNull();
    expect(screen.queryByText("missing.md")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /today/i }));

    expect(onSelect).toHaveBeenCalledWith("notes/today.md");
  });

  it("filters documents by case-insensitive path match", () => {
    renderFileTree();

    fireEvent.change(screen.getByLabelText("문서 검색"), { target: { value: "MARKMINI" } });

    expect(screen.queryByRole("treeitem", { name: /plan/i })).not.toBeNull();
    expect(screen.queryByRole("treeitem", { name: /guide/i })).toBeNull();
    expect(screen.queryByText("1/3")).not.toBeNull();
  });

  it("filters documents by rendered file label", () => {
    renderFileTree();

    fireEvent.change(screen.getByLabelText("문서 검색"), { target: { value: "today" } });

    expect(screen.queryByRole("treeitem", { name: /today/i })).not.toBeNull();
    expect(screen.queryByRole("treeitem", { name: /plan/i })).toBeNull();
  });

  it("shows selected-document guidance when the current document is filtered out", () => {
    renderFileTree({ selectedFile: "docs/guide.md" });

    fireEvent.change(screen.getByLabelText("문서 검색"), { target: { value: "today" } });

    expect(screen.queryByText("현재 선택된 문서는 검색 결과에 없습니다. 검색어를 지우면 다시 표시됩니다.")).not.toBeNull();
  });

  it("shows an empty state when no documents match", () => {
    renderFileTree();

    fireEvent.change(screen.getByLabelText("문서 검색"), { target: { value: "missing" } });

    expect(screen.queryByText("검색 결과가 없습니다.")).not.toBeNull();
    expect(screen.queryByText("0/3")).not.toBeNull();
  });

  it("selects a filtered document", () => {
    const onSelect = vi.fn();
    renderFileTree({ onSelect });

    fireEvent.change(screen.getByLabelText("문서 검색"), { target: { value: "today" } });
    fireEvent.click(within(screen.getByRole("tree")).getByRole("treeitem", { name: /today/i }));

    expect(onSelect).toHaveBeenCalledWith("notes/today.md");
  });

  it("changes document tree ordering with the sort control", () => {
    function SortableFileTree() {
      const [sortMode, setSortMode] = useState<React.ComponentProps<typeof FileTree>["sortMode"]>("path");
      return (
        <FileTree
          files={["docs/guide.md", "alpha.md"]}
          fileMetadata={{}}
          scanState="completed"
          skippedCount={0}
          selectedFile="alpha.md"
          favoriteDocuments={["docs/guide.md"]}
          recentDocuments={["alpha.md"]}
          searchQuery=""
          sortMode={sortMode}
          onSearchQueryChange={vi.fn()}
          onSortModeChange={setSortMode}
          onSelect={vi.fn()}
        />
      );
    }

    render(<SortableFileTree />);

    expect(within(screen.getByRole("tree")).getAllByRole("treeitem")[0].textContent).toContain("docs");

    fireEvent.change(screen.getByLabelText("정렬"), { target: { value: "name" } });

    expect(within(screen.getByRole("tree")).getAllByRole("treeitem")[0].textContent).toContain("alpha");
    expect(screen.queryByText("Favorites")).not.toBeNull();
    expect(screen.queryByText("Recent")).not.toBeNull();
  });

  it("sorts documents by modified time when metadata is available", () => {
    renderFileTree({
      files: ["old.md", "new.md"],
      fileMetadata: {
        "old.md": { relativePath: "old.md", modifiedAt: 100 },
        "new.md": { relativePath: "new.md", modifiedAt: 200 },
      },
      sortMode: "modified",
    });

    expect(within(screen.getByRole("tree")).getAllByRole("treeitem")[0].textContent).toContain("new");
  });

  it("clears the search query with the clear button", () => {
    const onSearchQueryChange = vi.fn();
    renderFileTree({ onSearchQueryChange });

    fireEvent.change(screen.getByLabelText("문서 검색"), { target: { value: "today" } });
    fireEvent.click(screen.getByLabelText("문서 검색어 지우기"));

    expect(onSearchQueryChange).toHaveBeenLastCalledWith("");
    expect((screen.getByLabelText("문서 검색") as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("3")).not.toBeNull();
  });

  it("clears the search query with Escape while focused", () => {
    const onSearchQueryChange = vi.fn();
    renderFileTree({ onSearchQueryChange });
    const searchInput = screen.getByLabelText("문서 검색");

    fireEvent.change(searchInput, { target: { value: "today" } });
    fireEvent.keyDown(searchInput, { key: "Escape" });

    expect(onSearchQueryChange).toHaveBeenLastCalledWith("");
    expect((searchInput as HTMLInputElement).value).toBe("");
  });

  it("focuses the search input with Cmd/Ctrl+F", () => {
    renderFileTree();
    const searchInput = screen.getByLabelText("문서 검색");

    fireEvent.keyDown(window, { key: "f", ctrlKey: true });

    expect(document.activeElement).toBe(searchInput);
  });

  it("highlights matching text in visible file labels", () => {
    const { container } = renderFileTree({ searchQuery: "today" });

    expect(screen.queryByRole("treeitem", { name: /today/i })).not.toBeNull();
    expect(container.querySelector("mark")?.textContent).toBe("today");
  });

  it("shows highlighted path context when the path matches outside the file label", () => {
    const { container } = renderFileTree({ searchQuery: "markmini" });

    expect(screen.queryByRole("treeitem", { name: /plan/i })).not.toBeNull();
    expect(screen.queryByText((_, element) => element?.textContent === "projects/markmini/plan.md")).not.toBeNull();
    expect(container.querySelector("mark")?.textContent).toBe("markmini");
  });
});
