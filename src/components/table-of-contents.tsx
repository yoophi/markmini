import { ListTree } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { HeadingItem } from "@/types/content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { focusHeadingById } from "@/lib/heading-navigation";
import { cn } from "@/lib/utils";

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
    window.addEventListener("scroll", scheduleUpdate, { capture: true, passive: true });
    window.addEventListener("hashchange", scheduleUpdate);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", scheduleUpdate, { capture: true });
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
        <CardContent className="pt-0 text-sm text-muted-foreground">이 문서에는 표시할 제목이 없습니다.</CardContent>
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
        <ScrollArea className="h-[min(60vh,calc(100vh-14rem))] pr-3" viewportRef={scrollViewportRef}>
          <div>
            <nav aria-label="Table of contents">
              <ol className="space-y-1">
                {headings.map((heading) => {
                  const isActive = heading.id === activeId;
                  return (
                    <li key={heading.id}>
                      <a
                        href={`#${heading.id}`}
                        className={cn(
                          "block rounded-md py-2 pr-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                          tocIndentClass(heading.depth),
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
                        aria-current={isActive ? "location" : undefined}
                        ref={isActive ? activeLinkRef : undefined}
                        onClick={(event) => {
                          event.preventDefault();
                          if (focusHeadingById(heading.id)) {
                            setActiveId(heading.id);
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

function tocIndentClass(depth: HeadingItem["depth"]) {
  const classes = {
    1: "pl-3",
    2: "pl-6",
    3: "pl-9",
  };
  return classes[depth];
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
