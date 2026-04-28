import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Search, X } from "lucide-react";

import { fileLabel } from "@/lib/path";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ScanStatus } from "@/types/content";

interface FileTreeProps {
  files: string[];
  scanState: ScanStatus;
  skippedCount: number;
  selectedFile: string | null;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSelect: (relativePath: string) => void;
}

export function FileTree({
  files,
  scanState,
  skippedCount,
  selectedFile,
  searchQuery,
  onSearchQueryChange,
  onSelect,
}: FileTreeProps) {
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredFiles = useMemo(() => filterFiles(files, normalizedSearchQuery), [files, normalizedSearchQuery]);
  const tree = useMemo(() => buildTree(filteredFiles), [filteredFiles]);
  const directoryPaths = useMemo(() => collectDirectoryPaths(tree), [tree]);
  const selectedFileIsFilteredOut = Boolean(normalizedSearchQuery && selectedFile && !filteredFiles.includes(selectedFile));
  const hasInitializedExpansionRef = useRef(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [focusedPath, setFocusedPath] = useState<string | null>(selectedFile);
  const treeRef = useRef<HTMLUListElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setExpandedPaths((current) => {
      const knownDirectories = new Set(directoryPaths);
      const next = normalizedSearchQuery
        ? new Set(directoryPaths)
        : hasInitializedExpansionRef.current
          ? new Set([...current].filter((path) => knownDirectories.has(path)))
          : new Set(directoryPaths);

      for (const path of selectedFile ? ancestorDirectoryPaths(selectedFile) : []) {
        next.add(path);
      }

      hasInitializedExpansionRef.current = true;
      return next;
    });
  }, [directoryPaths, normalizedSearchQuery, selectedFile]);

  const renderedItems = useMemo(() => flattenVisibleTree(tree, expandedPaths), [expandedPaths, tree]);
  const currentFocusPath =
    focusedPath && renderedItems.some((item) => item.node.path === focusedPath)
      ? focusedPath
      : selectedFile && renderedItems.some((item) => item.node.path === selectedFile)
        ? selectedFile
        : renderedItems[0]?.node.path ?? null;

  useEffect(() => {
    if (!currentFocusPath) {
      return;
    }

    setFocusedPath(currentFocusPath);
  }, [currentFocusPath]);

  const focusTreeItem = (path: string) => {
    setFocusedPath(path);
    requestAnimationFrame(() => {
      treeRef.current?.querySelector<HTMLElement>(`[data-tree-path="${CSS.escape(path)}"]`)?.focus();
    });
  };

  const toggleDirectory = (path: string, force?: boolean) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      const shouldExpand = force ?? !next.has(path);
      if (shouldExpand) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  };

  useEffect(() => {
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleDocumentKeyDown);
    return () => window.removeEventListener("keydown", handleDocumentKeyDown);
  }, []);

  const clearSearchQuery = () => {
    onSearchQueryChange("");
    searchInputRef.current?.focus();
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && searchQuery) {
      event.preventDefault();
      clearSearchQuery();
    }
  };

  const handleTreeKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (renderedItems.length === 0 || !currentFocusPath) {
      return;
    }

    const currentIndex = renderedItems.findIndex((item) => item.node.path === currentFocusPath);
    const currentItem = renderedItems[currentIndex];
    if (!currentItem) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusTreeItem(renderedItems[Math.min(currentIndex + 1, renderedItems.length - 1)].node.path);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusTreeItem(renderedItems[Math.max(currentIndex - 1, 0)].node.path);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusTreeItem(renderedItems[0].node.path);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusTreeItem(renderedItems[renderedItems.length - 1].node.path);
      return;
    }

    if (event.key === "ArrowRight" && currentItem.node.kind === "directory") {
      event.preventDefault();
      if (!expandedPaths.has(currentItem.node.path)) {
        toggleDirectory(currentItem.node.path, true);
        return;
      }

      const firstChild = renderedItems[currentIndex + 1];
      if (firstChild && firstChild.depth > currentItem.depth) {
        focusTreeItem(firstChild.node.path);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (currentItem.node.kind === "directory" && expandedPaths.has(currentItem.node.path)) {
        toggleDirectory(currentItem.node.path, false);
        return;
      }

      const parentPath = parentDirectoryPath(currentItem.node.path);
      if (parentPath) {
        focusTreeItem(parentPath);
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (currentItem.node.kind === "directory") {
        toggleDirectory(currentItem.node.path);
      } else {
        onSelect(currentItem.node.path);
      }
    }
  };

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">Documents</CardTitle>
          <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
            {normalizedSearchQuery ? `${filteredFiles.length}/${files.length}` : files.length}
          </span>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="문서 검색"
            aria-label="문서 검색"
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-9 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {searchQuery ? (
            <button
              type="button"
              aria-label="문서 검색어 지우기"
              onClick={clearSearchQuery}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {scanState === "scanning" || skippedCount > 0 ? (
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{scanState === "scanning" ? "문서를 찾는 중입니다." : "문서 탐색 완료"}</span>
            {skippedCount > 0 ? <span>{skippedCount}개 경로 건너뜀</span> : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea className="h-full">
          <div className="px-2 py-3">
            {selectedFileIsFilteredOut ? (
              <div className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
                현재 선택된 문서는 검색 결과에 없습니다. 검색어를 지우면 다시 표시됩니다.
              </div>
            ) : null}
            {tree.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-8 text-center">
                <Folder className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {normalizedSearchQuery ? "검색 결과가 없습니다." : "표시할 markdown 파일이 없습니다."}
                </p>
              </div>
            ) : (
              <ul
                ref={treeRef}
                role="tree"
                aria-label="Markdown documents"
                className="space-y-0.5"
                onKeyDown={handleTreeKeyDown}
              >
                {renderedItems.map(({ node, depth }) => (
                  <TreeNode
                    key={node.path}
                    node={node}
                    selectedFile={selectedFile}
                    onSelect={onSelect}
                    depth={depth}
                    expanded={expandedPaths.has(node.path)}
                    focused={currentFocusPath === node.path}
                    onFocusItem={setFocusedPath}
                    onToggle={toggleDirectory}
                  />
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface TreeNodeData {
  name: string;
  path: string;
  kind: "directory" | "file";
  children: TreeNodeData[];
}

function TreeNode({
  node,
  selectedFile,
  onSelect,
  depth,
  expanded,
  focused,
  onFocusItem,
  onToggle,
}: {
  node: TreeNodeData;
  selectedFile: string | null;
  onSelect: (relativePath: string) => void;
  depth: number;
  expanded: boolean;
  focused: boolean;
  onFocusItem: (path: string) => void;
  onToggle: (path: string) => void;
}) {
  const isDirectory = node.kind === "directory";
  const isSelected = selectedFile === node.path;
  const label = isDirectory ? node.name : fileLabel(node.path);

  if (node.kind === "directory") {
    return (
      <li role="none">
        <button
          type="button"
          role="treeitem"
          aria-expanded={expanded}
          aria-level={depth + 1}
          tabIndex={focused ? 0 : -1}
          data-tree-path={node.path}
          onFocus={() => onFocusItem(node.path)}
          onClick={() => onToggle(node.path)}
          className={cn(
            "group flex h-9 w-full items-center gap-2 rounded-md pr-2 text-left text-sm outline-none transition-colors",
            treeNodeIndentClass(depth),
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:text-accent-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:text-accent-foreground" />
          )}
          {expanded ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
          <span className="truncate font-medium">{label}</span>
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {countLeafNodes(node)}
          </span>
        </button>
      </li>
    );
  }

  return (
    <li role="none">
      <button
        type="button"
        role="treeitem"
        aria-selected={isSelected}
        aria-level={depth + 1}
        tabIndex={focused ? 0 : -1}
        data-tree-path={node.path}
        onFocus={() => onFocusItem(node.path)}
        onClick={() => onSelect(node.path)}
        className={cn(
          "group flex h-9 w-full items-center gap-2 rounded-md pr-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          treeNodeIndentClass(depth),
          isSelected
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <span className="h-4 w-4 shrink-0" aria-hidden="true" />
        <FileText className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-90" : "text-muted-foreground")} />
        <span className="truncate">{label}</span>
      </button>
    </li>
  );
}

function treeNodeIndentClass(depth: number) {
  const classes = ["pl-2", "pl-6", "pl-10", "pl-14", "pl-16"];
  return classes[Math.min(depth, classes.length - 1)];
}

function collectDirectoryPaths(nodes: TreeNodeData[]) {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.kind === "directory") {
      paths.push(node.path, ...collectDirectoryPaths(node.children));
    }
  }
  return paths;
}

function flattenVisibleTree(nodes: TreeNodeData[], expandedPaths: Set<string>, depth = 0) {
  const items: Array<{ node: TreeNodeData; depth: number }> = [];
  for (const node of nodes) {
    items.push({ node, depth });
    if (node.kind === "directory" && expandedPaths.has(node.path)) {
      items.push(...flattenVisibleTree(node.children, expandedPaths, depth + 1));
    }
  }
  return items;
}

function countLeafNodes(node: TreeNodeData): number {
  if (node.kind === "file") {
    return 1;
  }
  return node.children.reduce((total, child) => total + countLeafNodes(child), 0);
}

function parentDirectoryPath(path: string) {
  const segments = path.split("/");
  segments.pop();
  return segments.length > 0 ? segments.join("/") : null;
}

function ancestorDirectoryPaths(path: string) {
  const segments = path.split("/");
  segments.pop();
  return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
}

function filterFiles(files: string[], normalizedSearchQuery: string) {
  if (!normalizedSearchQuery) {
    return files;
  }

  return files.filter((file) => {
    const normalizedPath = file.toLocaleLowerCase();
    const normalizedLabel = fileLabel(file).toLocaleLowerCase();
    return normalizedPath.includes(normalizedSearchQuery) || normalizedLabel.includes(normalizedSearchQuery);
  });
}

function buildTree(files: string[]) {
  const root: TreeNodeData[] = [];

  for (const file of files) {
    insertNode(root, file.split("/"), "", file);
  }

  return sortTree(root);
}

function insertNode(nodes: TreeNodeData[], segments: string[], parentPath: string, originalPath: string) {
  const [segment, ...rest] = segments;
  if (!segment) {
    return;
  }

  const currentPath = parentPath ? `${parentPath}/${segment}` : segment;
  const isFile = rest.length === 0;
  const existing = nodes.find((node) => node.path === currentPath);

  if (existing) {
    if (!isFile) {
      insertNode(existing.children, rest, currentPath, originalPath);
    }
    return;
  }

  const node: TreeNodeData = {
    name: isFile ? fileLabel(originalPath) : segment,
    path: currentPath,
    kind: isFile ? "file" : "directory",
    children: [],
  };
  nodes.push(node);

  if (!isFile) {
    insertNode(node.children, rest, currentPath, originalPath);
  }
}

function sortTree(nodes: TreeNodeData[]): TreeNodeData[] {
  return nodes
    .map((node) => ({
      ...node,
      children: sortTree(node.children),
    }))
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "directory" ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
}
