import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Search, X } from "lucide-react";

import { fileLabel } from "@/lib/path";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MarkdownFileMetadata, ScanStatus } from "@/types/content";

type DocumentSortMode = "path" | "name" | "modified" | "size";

interface FileTreeProps {
  files: string[];
  fileMetadata: Record<string, MarkdownFileMetadata>;
  scanState: ScanStatus;
  skippedCount: number;
  selectedFile: string | null;
  favoriteDocuments: string[];
  recentDocuments: string[];
  searchQuery: string;
  sortMode: DocumentSortMode;
  onSearchQueryChange: (query: string) => void;
  onSortModeChange: (mode: DocumentSortMode) => void;
  onSelect: (relativePath: string) => void;
}

export function FileTree({
  files,
  fileMetadata,
  scanState,
  skippedCount,
  selectedFile,
  favoriteDocuments,
  recentDocuments,
  searchQuery,
  sortMode,
  onSearchQueryChange,
  onSortModeChange,
  onSelect,
}: FileTreeProps) {
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredFiles = useMemo(
    () => sortFiles(filterFiles(files, normalizedSearchQuery), sortMode, fileMetadata),
    [fileMetadata, files, normalizedSearchQuery, sortMode],
  );
  const tree = useMemo(() => buildTree(filteredFiles, sortMode), [filteredFiles, sortMode]);
  const visibleFavoriteDocuments = useMemo(() => favoriteDocuments.filter((file) => files.includes(file)), [favoriteDocuments, files]);
  const visibleRecentDocuments = useMemo(() => recentDocuments.filter((file) => files.includes(file)), [files, recentDocuments]);
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
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <label htmlFor="document-sort-mode" className="font-medium">
            정렬
          </label>
          <select
            id="document-sort-mode"
            value={sortMode}
            onChange={(event) => onSortModeChange(event.target.value as DocumentSortMode)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="path">경로순</option>
            <option value="name">이름순</option>
            <option value="modified">수정시간순</option>
            <option value="size">크기순</option>
          </select>
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
            {visibleFavoriteDocuments.length > 0 ? (
              <DocumentShortcutSection title="Favorites" documents={visibleFavoriteDocuments} selectedFile={selectedFile} onSelect={onSelect} />
            ) : null}
            {visibleRecentDocuments.length > 0 ? (
              <DocumentShortcutSection title="Recent" documents={visibleRecentDocuments} selectedFile={selectedFile} onSelect={onSelect} />
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
                    searchQuery={normalizedSearchQuery}
                    modifiedAt={fileMetadata[node.path]?.modifiedAt ?? null}
                    sizeBytes={fileMetadata[node.path]?.sizeBytes ?? null}
                    showModifiedTime={sortMode === "modified"}
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

function DocumentShortcutSection({
  title,
  documents,
  selectedFile,
  onSelect,
}: {
  title: string;
  documents: string[];
  selectedFile: string | null;
  onSelect: (relativePath: string) => void;
}) {
  return (
    <div className="mb-3 rounded-md border border-border bg-muted/30 p-2">
      <p className="px-1 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-0.5">
        {documents.map((path) => {
          const isSelected = selectedFile === path;
          return (
            <button
              key={path}
              type="button"
              aria-current={isSelected ? "page" : undefined}
              onClick={() => onSelect(path)}
              className={cn(
                "flex min-h-8 w-full items-center gap-2 rounded px-2 py-1 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                isSelected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <FileText className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-90" : "text-muted-foreground")} />
              <span className="min-w-0 flex-1 truncate">
                <span className="block truncate">{fileLabel(path)}</span>
                <span className={cn("block truncate text-xs", isSelected ? "text-primary-foreground/75" : "text-muted-foreground")}>{path}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TreeNode({
  node,
  selectedFile,
  onSelect,
  searchQuery,
  modifiedAt,
  sizeBytes,
  showModifiedTime,
  depth,
  expanded,
  focused,
  onFocusItem,
  onToggle,
}: {
  node: TreeNodeData;
  selectedFile: string | null;
  onSelect: (relativePath: string) => void;
  searchQuery: string;
  modifiedAt: number | null;
  sizeBytes: number | null;
  showModifiedTime: boolean;
  depth: number;
  expanded: boolean;
  focused: boolean;
  onFocusItem: (path: string) => void;
  onToggle: (path: string) => void;
}) {
  const isDirectory = node.kind === "directory";
  const isSelected = selectedFile === node.path;
  const label = isDirectory ? node.name : fileLabel(node.path);
  const normalizedLabel = label.toLocaleLowerCase();
  const pathMatchesOnly = Boolean(searchQuery && !normalizedLabel.includes(searchQuery) && node.path.toLocaleLowerCase().includes(searchQuery));
  const metadataContext = !isDirectory ? formatMetadataContext({ modifiedAt, sizeBytes, showModifiedTime }) : null;

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
          <span className="truncate font-medium">{renderHighlightedText(label, searchQuery, false)}</span>
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
          "group flex min-h-9 w-full items-center gap-2 rounded-md py-1 pr-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          treeNodeIndentClass(depth),
          isSelected
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <span className="h-4 w-4 shrink-0" aria-hidden="true" />
        <FileText className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-90" : "text-muted-foreground")} />
        <span className="min-w-0 flex-1 truncate">
          <span className="truncate">{renderHighlightedText(label, searchQuery, isSelected)}</span>
          {pathMatchesOnly ? (
            <span className={cn("mt-0.5 block truncate text-xs", isSelected ? "text-primary-foreground/75" : "text-muted-foreground")}>
              {renderHighlightedText(node.path, searchQuery, isSelected)}
            </span>
          ) : metadataContext ? (
            <span className={cn("mt-0.5 block truncate text-xs", isSelected ? "text-primary-foreground/75" : "text-muted-foreground")}>
              {metadataContext}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function renderHighlightedText(text: string, normalizedSearchQuery: string, isSelected: boolean) {
  if (!normalizedSearchQuery) {
    return text;
  }

  const matchIndex = text.toLocaleLowerCase().indexOf(normalizedSearchQuery);
  if (matchIndex === -1) {
    return text;
  }

  const before = text.slice(0, matchIndex);
  const match = text.slice(matchIndex, matchIndex + normalizedSearchQuery.length);
  const after = text.slice(matchIndex + normalizedSearchQuery.length);

  return (
    <>
      {before}
      <mark className={cn("rounded px-0.5", isSelected ? "bg-primary-foreground/25 text-inherit" : "bg-amber-200 text-amber-950")}>
        {match}
      </mark>
      {after}
    </>
  );
}

function formatMetadataContext({ modifiedAt, sizeBytes, showModifiedTime }: { modifiedAt: number | null; sizeBytes: number | null; showModifiedTime: boolean }) {
  const parts = [];
  if (showModifiedTime) {
    parts.push(formatModifiedTime(modifiedAt));
  }
  parts.push(formatFileSize(sizeBytes));
  return parts.join(" · ");
}

function formatModifiedTime(modifiedAt: number | null) {
  if (!modifiedAt) {
    return "수정시간 없음";
  }

  return `수정: ${new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(modifiedAt))}`;
}

function formatFileSize(sizeBytes: number | null) {
  if (sizeBytes === null) {
    return "크기 없음";
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${formatCompactNumber(sizeBytes / 1024)} KB`;
  }

  return `${formatCompactNumber(sizeBytes / 1024 / 1024)} MB`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: value >= 10 ? 0 : 1 }).format(value);
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

function sortFiles(files: string[], sortMode: DocumentSortMode, fileMetadata: Record<string, MarkdownFileMetadata>) {
  return [...files].sort((left, right) => {
    if (sortMode === "modified") {
      const leftModified = fileMetadata[left]?.modifiedAt ?? 0;
      const rightModified = fileMetadata[right]?.modifiedAt ?? 0;
      if (leftModified !== rightModified) {
        return rightModified - leftModified;
      }
    }
    if (sortMode === "size") {
      const leftSize = fileMetadata[left]?.sizeBytes ?? 0;
      const rightSize = fileMetadata[right]?.sizeBytes ?? 0;
      if (leftSize !== rightSize) {
        return rightSize - leftSize;
      }
    }
    if (sortMode === "name") {
      const labelComparison = fileLabel(left).localeCompare(fileLabel(right));
      if (labelComparison !== 0) {
        return labelComparison;
      }
    }

    return left.localeCompare(right);
  });
}

function buildTree(files: string[], sortMode: DocumentSortMode) {
  const root: TreeNodeData[] = [];

  for (const file of files) {
    insertNode(root, file.split("/"), "", file);
  }

  return sortTree(root, sortMode);
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

function sortTree(nodes: TreeNodeData[], sortMode: DocumentSortMode): TreeNodeData[] {
  const mappedNodes = nodes.map((node) => ({
    ...node,
    children: sortTree(node.children, sortMode),
  }));

  if (sortMode === "modified" || sortMode === "size") {
    return mappedNodes;
  }

  return mappedNodes.sort((left, right) => {
    if (sortMode === "path" && left.kind !== right.kind) {
      return left.kind === "directory" ? -1 : 1;
    }

    const labelComparison = left.name.localeCompare(right.name);
    if (labelComparison !== 0) {
      return labelComparison;
    }

    return left.path.localeCompare(right.path);
  });
}
