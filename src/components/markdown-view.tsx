import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { MermaidBlock } from "@/components/mermaid-block";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createSlugger, extractCodeText } from "@/lib/markdown";
import { resolveMarkdownHref } from "@/lib/path";

interface MarkdownViewProps {
  content: string;
  currentRelativePath: string | null;
  knownDocuments: string[];
  onNavigate: (relativePath: string) => void;
}

const MERMAID_START_KEYWORDS = new Set([
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "gantt",
  "journey",
  "pie",
  "requirementDiagram",
  "gitGraph",
  "mindmap",
  "timeline",
  "quadrantChart",
  "sankey-beta",
  "xychart-beta",
  "block-beta",
  "packet-beta",
  "architecture-beta",
  "zenuml",
  "C4Context",
  "C4Container",
  "C4Component",
  "C4Dynamic",
  "C4Deployment",
]);

function looksLikeMermaid(codeText: string): boolean {
  const firstLine = codeText.split(/\r?\n/).find((line) => line.trim().length > 0);
  if (!firstLine) {
    return false;
  }
  const firstToken = firstLine.trim().split(/\s+/)[0];
  return MERMAID_START_KEYWORDS.has(firstToken);
}

export function MarkdownView({ content, currentRelativePath, knownDocuments, onNavigate }: MarkdownViewProps) {
  const createHeadingId = createSlugger();

  return (
    <ScrollArea className="h-[calc(100vh-13rem)]">
      <div className="markdown-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
          components={{
          a: ({ href = "", children }) => {
            if (!currentRelativePath) {
              return (
                <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                  {children}
                </a>
              );
            }

            const resolved = resolveMarkdownHref(currentRelativePath, href, knownDocuments);
            if (resolved?.type === "document") {
              return (
                <button
                  type="button"
                  className="cursor-pointer bg-transparent p-0 text-left text-inherit"
                  onClick={() => {
                    onNavigate(resolved.path);
                    if (resolved.hash) {
                      setTimeout(() => {
                        const target = document.getElementById(resolved.hash!);
                        target?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 50);
                    }
                  }}
                >
                  {children}
                </button>
              );
            }

            if (resolved?.type === "hash") {
              return (
                <a
                  href={`#${resolved.hash}`}
                  onClick={(event) => {
                    event.preventDefault();
                    const target = document.getElementById(resolved.hash);
                    if (target) {
                      history.replaceState(null, "", `#${resolved.hash}`);
                      target.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                >
                  {children}
                </a>
              );
            }

            return (
              <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                {children}
              </a>
            );
          },
          pre: ({ children }) => {
            const child = Array.isArray(children) ? children[0] : children;
            if (child && typeof child === "object" && "props" in child) {
              const props = (child as { props?: { className?: string; children?: unknown } }).props;
              const classList = props?.className?.split(/\s+/) ?? [];
              const languageToken = classList.find((token) => token.startsWith("language-"));
              const language = languageToken?.slice("language-".length) ?? "";
              const codeText = extractCodeText(props?.children as ReactNode).replace(/\n$/, "");

              if (language === "mermaid" || (!language && looksLikeMermaid(codeText))) {
                return <MermaidBlock chart={codeText} />;
              }
            }

            return <pre>{children}</pre>;
          },
          code: ({ className, children }) => <code className={className}>{children}</code>,
          h1: ({ children }) => {
            const id = createHeadingId(extractCodeText(children));
            return <h1 id={id}>{children}</h1>;
          },
          h2: ({ children }) => {
            const id = createHeadingId(extractCodeText(children));
            return <h2 id={id}>{children}</h2>;
          },
          h3: ({ children }) => {
            const id = createHeadingId(extractCodeText(children));
            return <h3 id={id}>{children}</h3>;
          },
        }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </ScrollArea>
  );
}
