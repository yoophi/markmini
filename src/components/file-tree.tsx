import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";

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
  onSelect: (relativePath: string) => void;
}

export function FileTree({ files, scanState, skippedCount, selectedFile, onSelect }: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);
  const directoryPaths = useMemo(() => collectDirectoryPaths(tree), [tree]);
  const hasInitializedExpansionRef = useRef(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [focusedPath, setFocusedPath] = useState<string | null>(selectedFile);
  const treeRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    setExpandedPaths((current) => {
      const knownDirectories = new Set(directoryPaths);
      const next = hasInitializedExpansionRef.current
        ? new Set([...current].filter((path) => knownDirectories.has(path)))
        : new Set(directoryPaths);

      for (const path of selectedFile ? ancestorDirectoryPaths(selectedFile) : []) {
        next.add(path);
      }

      hasInitializedExpansionRef.current = true;
      return next;
    });
  }, [directoryPaths, selectedFile]);

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
    <Card className="h-full overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">Documents</CardTitle>
          <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
            {files.length}
          </span>
        </div>
        {scanState === "scanning" || skippedCount > 0 ? (
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{scanState === "scanning" ? "문서를 찾는 중입니다." : "문서 탐색 완료"}</span>
            {skippedCount > 0 ? <span>{skippedCount}개 경로 건너뜀</span> : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="h-[calc(100%-78px)] p-0">
        <ScrollArea className="h-full">
          <div className="px-2 py-3">
            {tree.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-8 text-center">
                <Folder className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-3 text-sm leading-6 text-muted-foreground">표시할 markdown 파일이 없습니다.</p>
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
        style={{ paddingLeft: treeNodeIndent(depth) }}
        className={cn(
          "group flex h-9 w-full items-center gap-2 rounded-md pr-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          isSelected
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <FileText className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-90" : "text-muted-foreground")} />
        <span className="truncate">{label}</span>
      </button>
    </li>
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

export function buildTree(files: string[]) {
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
