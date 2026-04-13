import { slugify } from "@/lib/markdown";

export function normalizeRelativePath(value: string) {
  const segments = value.replace(/\\/g, "/").split("/");
  const stack: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      stack.pop();
      continue;
    }

    stack.push(segment);
  }

  return stack.join("/");
}

export function dirname(value: string) {
  const normalized = normalizeRelativePath(value);
  const segments = normalized.split("/").filter(Boolean);
  segments.pop();
  return segments.join("/");
}

export function resolveMarkdownHref(currentRelativePath: string, href: string, knownDocuments: string[]) {
  if (!href || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) {
    return null;
  }

  if (href.startsWith("#")) {
    return { type: "hash" as const, hash: href.replace(/^#/, "") };
  }

  const [pathPart, sectionPart] = href.split("#");
  const currentDirectory = dirname(currentRelativePath);
  const candidate = normalizeRelativePath([currentDirectory, pathPart].filter(Boolean).join("/"));
  const candidates = new Set<string>([candidate]);

  if (!candidate.endsWith(".md")) {
    candidates.add(`${candidate}.md`);
    candidates.add(normalizeRelativePath(`${candidate}/README.md`));
    candidates.add(normalizeRelativePath(`${candidate}/index.md`));
  }

  for (const entry of candidates) {
    if (knownDocuments.includes(entry)) {
      return {
        type: "document" as const,
        path: entry,
        hash: sectionPart ? slugify(sectionPart) : null,
      };
    }
  }

  return null;
}

export function fileLabel(relativePath: string) {
  const segments = relativePath.split("/");
  return segments[segments.length - 1]?.replace(/\.md$/i, "") ?? relativePath;
}
