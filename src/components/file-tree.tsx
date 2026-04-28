import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Search, Star, X } from "lucide-react";

import { fileLabel } from "@/lib/path";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ScanStatus } from "@/types/content";
import type { MarkdownFileMetadata } from "@/types/content";

export type DocumentTreeSortMode = "name" | "path" | "modified";

export const DOCUMENT_TREE_SEARCH_QUERY_STORAGE_KEY = "markmini.documentTree.searchQuery";
export const DOCUMENT_TREE_SORT_MODE_STORAGE_KEY = "markmini.documentTree.sortMode";

interface FileTreeProps {
  files: string[];
  fileMetadata: Record<string, MarkdownFileMetadata>;
  recentDocuments: string[];
  favoriteDocuments: string[];
  scanState: ScanStatus;
  skippedCount: number;
  selectedFile: string | null;
  onSelect: (relativePath: string) => void;
  onToggleFavorite: (relativePath: string) => void;
}

export function FileTree({
  files,
  fileMetadata,
  recentDocuments,
  favoriteDocuments,
  scanState,
  skippedCount,
  selectedFile,
  onSelect,
  onToggleFavorite,
}: FileTreeProps) {
  const [searchQuery, setSearchQuery] = useState(readStoredSearchQuery);
  const [sortMode, setSortMode] = useState<DocumentTreeSortMode>(readStoredSortMode);
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const filteredFiles = useMemo(() => filterFiles(files, normalizedSearchQuery), [files, normalizedSearchQuery]);
  const tree = useMemo(() => buildTree(filteredFiles, sortMode, fileMetadata), [filteredFiles, fileMetadata, sortMode]);
  const directoryPaths = useMemo(() => collectDirectoryPaths(tree), [tree]);
  const selectedFileIsFilteredOut = Boolean(normalizedSearchQuery && selectedFile && !filteredFiles.includes(selectedFile));
  const hasInitializedExpansionRef = useRef(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [focusedPath, setFocusedPath] = useState<string | null>(selectedFile);
  const treeRef = useRef<HTMLUListElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const showSearchClearButton = shouldShowSearchClearButton(searchQuery);

  useEffect(() => {
    writeStoredSearchQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    writeStoredSortMode(sortMode);
  }, [sortMode]);

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

  const handleTreeKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
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
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && searchQuery) {
                event.preventDefault();
                setSearchQuery("");
              }
            }}
            placeholder="문서 검색"
            aria-label="문서 검색"
            className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-10 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {showSearchClearButton ? (
            <button
              type="button"
              aria-label="문서 검색어 지우기"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>정렬</span>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(parseSortMode(event.target.value))}
            aria-label="문서 트리 정렬"
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="name">이름순</option>
            <option value="path">경로순</option>
            <option value="modified">수정일순</option>
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
            {favoriteDocuments.length > 0 ? (
              <div className="mb-3 border-b border-border/60 pb-3">
                <p className="px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Favorites</p>
                <div className="mt-2 space-y-0.5">
                  {favoriteDocuments.map((path) => (
                    <button
                      key={path}
                      type="button"
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        selectedFile === path
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                      onClick={() => onSelect(path)}
                    >
                      <Star className="h-4 w-4 shrink-0 fill-current text-yellow-500" />
                      <span className="truncate">{fileLabel(path)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {recentDocuments.length > 0 ? (
              <div className="mb-3 border-b border-border/60 pb-3">
                <p className="px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Recent</p>
                <div className="mt-2 space-y-0.5">
                  {recentDocuments.map((path) => (
                    <button
                      key={path}
                      type="button"
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        selectedFile === path
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                      onClick={() => onSelect(path)}
                    >
                      <FileText className={cn("h-4 w-4 shrink-0", selectedFile === path ? "opacity-90" : "text-muted-foreground")} />
                      <span className="truncate">{fileLabel(path)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
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
                    fileMetadata={fileMetadata}
                    sortMode={sortMode}
                    favorite={favoriteDocuments.includes(node.path)}
                    depth={depth}
                    expanded={expandedPaths.has(node.path)}
                    focused={currentFocusPath === node.path}
                    searchQuery={searchQuery}
                    onFocusItem={setFocusedPath}
                    onToggle={toggleDirectory}
                    onToggleFavorite={onToggleFavorite}
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

export interface TreeNodeData {
  name: string;
  path: string;
  kind: "directory" | "file";
  children: TreeNodeData[];
}

function TreeNode({
  node,
  selectedFile,
  onSelect,
  fileMetadata,
  sortMode,
  favorite,
  depth,
  expanded,
  focused,
  searchQuery,
  onFocusItem,
  onToggle,
  onToggleFavorite,
}: {
  node: TreeNodeData;
  selectedFile: string | null;
  onSelect: (relativePath: string) => void;
  fileMetadata: Record<string, MarkdownFileMetadata>;
  sortMode: DocumentTreeSortMode;
  favorite: boolean;
  depth: number;
  expanded: boolean;
  focused: boolean;
  searchQuery: string;
  onFocusItem: (path: string) => void;
  onToggle: (path: string) => void;
  onToggleFavorite: (path: string) => void;
}) {
  const isDirectory = node.kind === "directory";
  const isSelected = selectedFile === node.path;
  const label = isDirectory ? node.name : fileLabel(node.path);
  const modifiedLabel =
    sortMode === "modified" && node.kind === "file" ? formatModifiedAt(fileMetadata[node.path]?.modifiedAt) : null;

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
          style={{ paddingLeft: treeNodeIndent(depth) }}
          className={cn(
            "group flex h-9 w-full items-center gap-2 rounded-md pr-2 text-left text-sm outline-none transition-colors",
            "text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:text-accent-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:text-accent-foreground" />
          )}
          {expanded ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
          <span className="truncate font-medium">
            <HighlightedLabel text={label} searchQuery={searchQuery} />
          </span>
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {countLeafNodes(node)}
          </span>
        </button>
      </li>
    );
  }

  return (
    <li role="none">
      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-level={depth + 1}
        data-tree-path={node.path}
        style={{ paddingLeft: treeNodeIndent(depth) }}
        className={cn(
          "group flex h-9 w-full items-center gap-1 rounded-md pr-2 text-sm outline-none transition-colors focus-within:ring-2 focus-within:ring-ring",
          isSelected
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <button
          type="button"
          tabIndex={focused ? 0 : -1}
          onFocus={() => onFocusItem(node.path)}
          onClick={() => onSelect(node.path)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left outline-none"
        >
          <FileText className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-90" : "text-muted-foreground")} />
          <span className="truncate">
            <HighlightedLabel text={label} searchQuery={searchQuery} />
          </span>
          {modifiedLabel ? (
            <span className={cn("ml-auto shrink-0 text-[11px] tabular-nums", isSelected ? "opacity-80" : "text-muted-foreground")}>
              {modifiedLabel}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          aria-label={favorite ? `${label} 즐겨찾기 해제` : `${label} 즐겨찾기 추가`}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-70 outline-none transition hover:bg-background/50 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
            favorite ? "text-yellow-500 opacity-100" : isSelected ? "text-primary-foreground" : "text-muted-foreground",
          )}
          onClick={() => onToggleFavorite(node.path)}
        >
          <Star className={cn("h-4 w-4", favorite ? "fill-current" : "")} />
        </button>
      </div>
    </li>
  );
}

function HighlightedLabel({ text, searchQuery }: { text: string; searchQuery: string }) {
  return splitHighlightedText(text, searchQuery).map((part, index) =>
    part.highlight ? (
      <mark key={`${part.text}-${index}`} className="rounded bg-primary/20 px-0.5 text-inherit">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

export function treeNodeIndent(depth: number) {
  return `${8 + depth * 20}px`;
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

export function flattenVisibleTree(nodes: TreeNodeData[], expandedPaths: Set<string>, depth = 0) {
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

export function filterFiles(files: string[], normalizedSearchQuery: string) {
  if (!normalizedSearchQuery) {
    return files;
  }

  return files.filter((file) => {
    const normalizedPath = file.toLocaleLowerCase();
    const normalizedLabel = fileLabel(file).toLocaleLowerCase();
    return normalizedPath.includes(normalizedSearchQuery) || normalizedLabel.includes(normalizedSearchQuery);
  });
}

export function shouldShowSearchClearButton(searchQuery: string) {
  return searchQuery.length > 0;
}

export function splitHighlightedText(text: string, searchQuery: string) {
  const query = searchQuery.trim();
  if (!query) {
    return [{ text, highlight: false }];
  }

  const matchIndex = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (matchIndex === -1) {
    return [{ text, highlight: false }];
  }

  const before = text.slice(0, matchIndex);
  const match = text.slice(matchIndex, matchIndex + query.length);
  const after = text.slice(matchIndex + query.length);

  return [
    before ? { text: before, highlight: false } : null,
    { text: match, highlight: true },
    after ? { text: after, highlight: false } : null,
  ].filter((part): part is { text: string; highlight: boolean } => Boolean(part));
}

export function readStoredSearchQuery() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.sessionStorage.getItem(DOCUMENT_TREE_SEARCH_QUERY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeStoredSearchQuery(searchQuery: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (searchQuery) {
      window.sessionStorage.setItem(DOCUMENT_TREE_SEARCH_QUERY_STORAGE_KEY, searchQuery);
    } else {
      window.sessionStorage.removeItem(DOCUMENT_TREE_SEARCH_QUERY_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures so the document tree remains usable in restricted contexts.
  }
}

export function readStoredSortMode(): DocumentTreeSortMode {
  if (typeof window === "undefined") {
    return "name";
  }

  try {
    return parseSortMode(window.sessionStorage.getItem(DOCUMENT_TREE_SORT_MODE_STORAGE_KEY));
  } catch {
    return "name";
  }
}

export function writeStoredSortMode(sortMode: DocumentTreeSortMode) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(DOCUMENT_TREE_SORT_MODE_STORAGE_KEY, sortMode);
  } catch {
    // Keep sorting usable even if session storage is unavailable.
  }
}

export function parseSortMode(value: unknown): DocumentTreeSortMode {
  return value === "path" || value === "modified" ? value : "name";
}

export function buildTree(
  files: string[],
  sortMode: DocumentTreeSortMode = "name",
  fileMetadata: Record<string, MarkdownFileMetadata> = {},
) {
  const root: TreeNodeData[] = [];

  for (const file of files) {
    insertNode(root, file.split("/"), "", file);
  }

  return sortTree(root, sortMode, fileMetadata);
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

function sortTree(
  nodes: TreeNodeData[],
  sortMode: DocumentTreeSortMode,
  fileMetadata: Record<string, MarkdownFileMetadata>,
): TreeNodeData[] {
  return nodes
    .map((node) => ({
      ...node,
      children: sortTree(node.children, sortMode, fileMetadata),
    }))
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "directory" ? -1 : 1;
      }

      if (sortMode === "modified") {
        const modifiedComparison = modifiedAt(right, fileMetadata) - modifiedAt(left, fileMetadata);
        if (modifiedComparison !== 0) {
          return modifiedComparison;
        }
      }

      const leftValue = sortMode === "path" ? left.path : left.name;
      const rightValue = sortMode === "path" ? right.path : right.name;
      return leftValue.localeCompare(rightValue);
    });
}

function modifiedAt(node: TreeNodeData, fileMetadata: Record<string, MarkdownFileMetadata>): number {
  if (node.kind === "file") {
    return fileMetadata[node.path]?.modifiedAt ?? 0;
  }

  return Math.max(0, ...node.children.map((child) => modifiedAt(child, fileMetadata)));
}

export function formatModifiedAt(modifiedAt: number | null | undefined, now = Date.now()): string | null {
  if (!modifiedAt) {
    return null;
  }

  const diffMs = Math.max(0, now - modifiedAt);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "방금 전";
  }

  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)}분 전`;
  }

  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}시간 전`;
  }

  if (diffMs < 7 * day) {
    return `${Math.floor(diffMs / day)}일 전`;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(modifiedAt));
}
