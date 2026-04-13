import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";
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

export function MarkdownView({ content, currentRelativePath, knownDocuments, onNavigate }: MarkdownViewProps) {
  const createHeadingId = createSlugger();

  return (
    <ScrollArea className="h-[calc(100vh-13rem)]">
      <div className="markdown-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
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
              const language = props?.className?.replace("language-", "") ?? "";
              const codeText = extractCodeText(props?.children as ReactNode).replace(/\n$/, "");

              if (language === "mermaid") {
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
