import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { MermaidBlock } from "@/components/mermaid-block";
import { focusHeadingById, focusHeadingByIdWhenReady } from "@/lib/heading-navigation";
import { createSlugger, extractCodeText } from "@/lib/markdown";
import { resolveMarkdownHref } from "@/lib/path";

interface MarkdownViewProps {
  content: string;
  currentRelativePath: string | null;
  knownDocuments: string[];
  onNavigate: (relativePath: string) => Promise<void> | void;
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

const markdownClassName = [
  "prose prose-slate mx-auto w-full min-w-0 max-w-full overflow-x-hidden px-5 py-8 text-foreground sm:px-8 sm:py-10",
  "prose-headings:scroll-mt-24 prose-headings:font-display prose-headings:text-primary prose-headings:focus:outline-none prose-headings:focus-visible:ring-2 prose-headings:focus-visible:ring-ring",
  "prose-h1:mt-0 prose-h1:text-4xl prose-h1:leading-tight",
  "prose-h2:mt-12 prose-h2:text-2xl prose-h2:leading-tight",
  "prose-h3:mt-8 prose-h3:text-xl prose-h3:leading-tight",
  "prose-p:text-[15px] prose-p:leading-8 prose-li:text-[15px] prose-li:leading-8",
  "prose-a:text-primary prose-a:decoration-accent-foreground/30 prose-a:underline-offset-4",
  "prose-strong:text-primary prose-code:rounded-md prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:text-primary",
  "prose-blockquote:border-accent prose-blockquote:bg-background prose-blockquote:px-4 prose-blockquote:py-1 prose-blockquote:font-normal prose-blockquote:italic",
  "prose-hr:border-border",
  "[&_code::after]:content-none [&_code::before]:content-none [&_pre_code]:rounded-none [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:font-normal [&_pre_code]:text-inherit",
].join(" ");

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
    <div className="h-[calc(100vh-13rem)] w-full min-w-0 max-w-full overflow-x-hidden overflow-y-auto">
      <div className={markdownClassName}>
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
                  onClick={async () => {
                    await onNavigate(resolved.path);
                    if (resolved.hash) {
                      await focusHeadingByIdWhenReady(resolved.hash);
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
                    focusHeadingById(resolved.hash);
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
          table: ({ children }) => (
            <div className="not-prose my-6 w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-border bg-background shadow-sm">
              <table className="w-max min-w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-secondary">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-border px-4 py-3 text-left font-semibold text-primary">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-border px-4 py-3 align-top">{children}</td>,
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

            return (
              <div className="not-prose my-6 w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-border bg-primary shadow-inner">
                <pre className="m-0 min-w-max bg-transparent p-4 text-sm text-primary-foreground">{children}</pre>
              </div>
            );
          },
          code: ({ className, children }) => <code className={className}>{children}</code>,
          h1: ({ children }) => {
            const id = createHeadingId(extractCodeText(children));
            return (
              <h1 id={id} tabIndex={-1}>
                {children}
              </h1>
            );
          },
          h2: ({ children }) => {
            const id = createHeadingId(extractCodeText(children));
            return (
              <h2 id={id} tabIndex={-1}>
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const id = createHeadingId(extractCodeText(children));
            return (
              <h3 id={id} tabIndex={-1}>
                {children}
              </h3>
            );
          },
        }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
