/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FileTree } from "@/components/file-tree";

const files = ["docs/guide.md", "notes/today.md", "projects/markmini/plan.md"];

afterEach(() => {
  cleanup();
});

function renderFileTree(options: Partial<React.ComponentProps<typeof FileTree>> = {}) {
  return render(
    <FileTree
      files={files}
      scanState="completed"
      skippedCount={0}
      selectedFile="docs/guide.md"
      onSelect={vi.fn()}
      {...options}
    />,
  );
}

describe("FileTree search", () => {
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
});
