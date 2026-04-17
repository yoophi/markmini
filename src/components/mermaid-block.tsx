import { useEffect, useId, useState } from "react";

interface MermaidBlockProps {
  chart: string;
}

const shellClassName = "not-prose my-6 overflow-hidden rounded-lg border border-border bg-background p-4 shadow-sm";

export function MermaidBlock({ chart }: MermaidBlockProps) {
  const reactId = useId();
  const elementId = `mermaid-${reactId.replace(/:/g, "-")}`;
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function renderChart() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "IBM Plex Sans, sans-serif",
        });

        const result = await mermaid.render(elementId, chart);
        if (!cancelled) {
          setSvg(result.svg);
          setError("");
        }
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : "Failed to render mermaid chart");
          setSvg("");
        }
      }
    }

    void renderChart();

    return () => {
      cancelled = true;
    };
  }, [chart, elementId]);

  if (error) {
    return (
      <div className={shellClassName}>
        <p className="font-medium text-destructive">Mermaid 렌더링에 실패했습니다.</p>
        <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-border bg-secondary p-4 text-xs text-foreground">
          {error}
          {"\n\n"}
          {chart}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return <div className={`${shellClassName} text-sm text-muted-foreground`}>Mermaid chart 렌더링 중...</div>;
  }

  return <div className={`${shellClassName} [&_svg]:h-auto [&_svg]:max-w-full`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
