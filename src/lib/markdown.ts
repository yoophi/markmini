import type { ReactNode } from "react";

import type { HeadingItem } from "@/types/content";

export function extractCodeText(children: ReactNode): string {
  if (typeof children === "string") {
    return children;
  }

  if (Array.isArray(children)) {
    return children.map((child) => extractCodeText(child)).join("");
  }

  if (children && typeof children === "object" && "props" in children) {
    const props = (children as { props?: { children?: ReactNode } }).props;
    return extractCodeText(props?.children ?? "");
  }

  return "";
}

export function createSlugger() {
  const counts = new Map<string, number>();

  return (value: string) => {
    const base = slugify(value);
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

export function slugify(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}\-_]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "section";
}

export function extractHeadings(markdown: string): HeadingItem[] {
  const createHeadingId = createSlugger();
  const headings: HeadingItem[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (!match) {
      continue;
    }

    const depth = match[1].length as 1 | 2 | 3;
    const text = stripMarkdownInline(match[2].trim());
    if (!text) {
      continue;
    }

    headings.push({
      depth,
      text,
      id: createHeadingId(text),
    });
  }

  return headings;
}

function stripMarkdownInline(value: string) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}
