import { ChevronRight, FileText, FolderOpen } from "lucide-react";

import { fileLabel } from "@/lib/path";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FileTreeProps {
  files: string[];
  selectedFile: string | null;
  onSelect: (relativePath: string) => void;
}

export function FileTree({ files, selectedFile, onSelect }: FileTreeProps) {
  const tree = buildTree(files);

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-lg">Documents</CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-78px)] p-0">
        <ScrollArea className="h-full">
          <div className="px-3 py-4">
            {tree.length === 0 ? (
              <p className="px-3 text-sm leading-6 text-muted-foreground">표시할 markdown 파일이 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {tree.map((node) => (
                  <TreeNode key={node.path} node={node} selectedFile={selectedFile} onSelect={onSelect} depth={0} />
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
}: {
  node: TreeNodeData;
  selectedFile: string | null;
  onSelect: (relativePath: string) => void;
  depth: number;
}) {
  if (node.kind === "directory") {
    return (
      <li>
        <div className="mb-1 flex items-center gap-2 px-3 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <FolderOpen className="h-4 w-4" />
          <span className="truncate">{node.name}</span>
        </div>
        <ul className="space-y-1">
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} selectedFile={selectedFile} onSelect={onSelect} depth={depth + 1} />
          ))}
        </ul>
      </li>
    );
  }

  const isSelected = selectedFile === node.path;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md py-2.5 pr-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          treeNodeIndentClass(depth),
          isSelected ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <ChevronRight className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-80" : "text-muted-foreground")} />
        <FileText className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm">{fileLabel(node.path)}</span>
      </button>
    </li>
  );
}

function treeNodeIndentClass(depth: number) {
  const classes = ["pl-3", "pl-6", "pl-9", "pl-12", "pl-14"];
  return classes[Math.min(depth, classes.length - 1)];
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
