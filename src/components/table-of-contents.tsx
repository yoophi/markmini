import { ListTree } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { HeadingItem } from "@/types/content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TableOfContentsProps {
  headings: HeadingItem[];
}

const ACTIVE_HEADING_OFFSET = 140;

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string | null>(headings[0]?.id ?? null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);
  const headingIds = useMemo(() => headings.map((heading) => heading.id), [headings]);

  useEffect(() => {
    if (headings.length === 0) {
      setActiveId(null);
      return;
    }

    const updateActiveHeading = () => {
      const nextActiveId = resolveActiveHeadingId(headingIds);
      setActiveId((current) => (current === nextActiveId ? current : nextActiveId));
    };

    let frameId = 0;
    const scheduleUpdate = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateActiveHeading();
      });
    };

    updateActiveHeading();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("hashchange", scheduleUpdate);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("hashchange", scheduleUpdate);
    };
  }, [headingIds, headings.length]);

  useEffect(() => {
    if (!activeId) {
      return;
    }

    const viewport = scrollViewportRef.current;
    const activeLink = activeLinkRef.current;
    if (!viewport || !activeLink) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    if (linkRect.top < viewportRect.top || linkRect.bottom > viewportRect.bottom) {
      activeLink.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [activeId]);

  if (headings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListTree className="h-4 w-4" />
            TOC
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-[var(--muted-foreground)]">이 문서에는 표시할 제목이 없습니다.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ListTree className="h-4 w-4" />
          TOC
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="toc-scroll pr-3">
          <div ref={scrollViewportRef}>
            <nav aria-label="Table of contents">
              <ol className="space-y-1">
                {headings.map((heading) => {
                  const isActive = heading.id === activeId;
                  return (
                    <li key={heading.id}>
                      <a
                        href={`#${heading.id}`}
                        className={`
                          block rounded-2xl px-3 py-2 text-sm transition-colors
                          ${isActive ? "bg-[var(--panel-strong)] text-white" : "text-[var(--muted-foreground)] hover:bg-white/70 hover:text-[var(--foreground)]"}
                        `}
                        aria-current={isActive ? "location" : undefined}
                        ref={isActive ? activeLinkRef : undefined}
                        style={{ paddingLeft: `${0.75 + (heading.depth - 1) * 0.9}rem` }}
                        onClick={(event) => {
                          event.preventDefault();
                          const target = document.getElementById(heading.id);
                          if (target) {
                            history.replaceState(null, "", `#${heading.id}`);
                            target.scrollIntoView({ behavior: "smooth", block: "start" });
                          }
                        }}
                      >
                        {heading.text}
                      </a>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function resolveActiveHeadingId(headingIds: string[]) {
  if (headingIds.length === 0) {
    return null;
  }

  const hashId = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (hashId && headingIds.includes(hashId)) {
    const hashedHeading = document.getElementById(hashId);
    if (hashedHeading) {
      const { top, bottom } = hashedHeading.getBoundingClientRect();
      if (top <= ACTIVE_HEADING_OFFSET && bottom > 0) {
        return hashId;
      }
    }
  }

  const headingElements = headingIds
    .map((id) => document.getElementById(id))
    .filter((element): element is HTMLElement => Boolean(element));

  if (headingElements.length === 0) {
    return headingIds[0] ?? null;
  }

  const passedHeadings = headingElements.filter((element) => element.getBoundingClientRect().top <= ACTIVE_HEADING_OFFSET);
  if (passedHeadings.length > 0) {
    return passedHeadings[passedHeadings.length - 1]?.id ?? headingIds[0] ?? null;
  }

  return headingElements[0]?.id ?? headingIds[0] ?? null;
}
