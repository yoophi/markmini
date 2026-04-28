import { useEffect } from "react";
import { FileText, FolderTree, Menu, RefreshCcw, TextSearch } from "lucide-react";

import { FileTree } from "@/components/file-tree";
import { MarkdownView } from "@/components/markdown-view";
import { TableOfContents } from "@/components/table-of-contents";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAppStore } from "@/store/app-store";
import { subscribeToFsChanges, subscribeToScanProgress } from "@/store/fs-watcher";

function App() {
  const bootstrap = useAppStore((state) => state.bootstrap);
  const openDocument = useAppStore((state) => state.openDocument);
  const refresh = useAppStore((state) => state.refresh);
  const bootstrapState = useAppStore((state) => state.bootstrapState);
  const error = useAppStore((state) => state.error);
  const rootDir = useAppStore((state) => state.rootDir);
  const files = useAppStore((state) => state.files);
  const recentDocuments = useAppStore((state) => state.recentDocuments);
  const scanState = useAppStore((state) => state.scanState);
  const scanSkippedPaths = useAppStore((state) => state.scanSkippedPaths);
  const scanError = useAppStore((state) => state.scanError);
  const selectedFile = useAppStore((state) => state.selectedFile);
  const document = useAppStore((state) => state.document);
  const isSidebarOpen = useAppStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const unlistenPromise = subscribeToFsChanges();
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const unlistenPromise = subscribeToScanProgress();
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const selectedSegments = selectedFile?.split("/") ?? [];
  const selectedLabel = selectedSegments[selectedSegments.length - 1] ?? "문서를 선택하세요";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="relative mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-4 sm:px-6">
        <header className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold text-primary">MARKMINI</p>
                <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                  <span className="truncate">{rootDir ?? "루트 경로를 불러오는 중"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Sheet open={isSidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden">
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">문서 목록 열기</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[min(88vw,340px)] p-0">
                  <SheetHeader className="border-b border-border/60 px-5 py-4">
                    <SheetTitle>Documents</SheetTitle>
                  </SheetHeader>
                  <div className="h-[calc(100vh-72px)] overflow-hidden">
                    <FileTree
                      files={files}
                      recentDocuments={recentDocuments}
                      scanState={scanState}
                      skippedCount={scanSkippedPaths.length}
                      selectedFile={selectedFile}
                      onSelect={(file) => {
                        void openDocument(file);
                        setSidebarOpen(false);
                      }}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                새로고침
              </Button>
            </div>
          </div>
        </header>

        {bootstrapState === "loading" ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void bootstrap()} />
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="hidden min-h-0 lg:block">
              <div className="sticky top-4 h-[calc(100vh-8rem)]">
                <FileTree
                  files={files}
                  recentDocuments={recentDocuments}
                  scanState={scanState}
                  skippedCount={scanSkippedPaths.length}
                  selectedFile={selectedFile}
                  onSelect={(file) => void openDocument(file)}
                />
              </div>
            </aside>

            <section className="relative min-h-0 min-w-0 xl:pr-[296px]">
              <Card className="min-h-[70vh] min-w-0 overflow-hidden">
                <CardContent className="flex h-full flex-col p-0">
                  <div className="border-b border-border/60 px-5 py-4">
                    <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
                      <TextSearch className="h-4 w-4" />
                      Reader
                    </div>
                    <h1 className="mt-2 truncate font-display text-2xl font-semibold text-foreground">{selectedLabel}</h1>
                  </div>

                  {document.state === "loading" ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                      문서를 불러오는 중입니다.
                    </div>
                  ) : document.state === "error" ? (
                    <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-destructive">
                      {document.error}
                    </div>
                  ) : document.content ? (
                    <MarkdownView
                      content={document.content}
                      currentRelativePath={selectedFile}
                      knownDocuments={files}
                      onNavigate={openDocument}
                    />
                  ) : (
                    <EmptyReader />
                  )}
                </CardContent>
              </Card>

              <aside className="hidden xl:block">
                <div className="fixed right-[max(1.5rem,calc((100vw-1600px)/2+1.5rem))] top-28 z-20 w-[280px]">
                  {scanError ? (
                    <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {scanError}
                    </div>
                  ) : null}
                  <TableOfContents headings={document.headings} />
                </div>
              </aside>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <Card className="flex min-h-[70vh] items-center justify-center">
      <CardContent className="py-16 text-center">
        <p className="font-display text-2xl font-semibold text-primary">MARKMINI</p>
        <p className="mt-3 text-sm text-muted-foreground">로컬 markdown 세션을 준비하고 있습니다.</p>
      </CardContent>
    </Card>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="flex min-h-[70vh] items-center justify-center">
      <CardContent className="max-w-md py-16 text-center">
        <p className="font-display text-2xl font-semibold text-destructive">FAILED TO OPEN</p>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{message}</p>
        <Button className="mt-6" onClick={onRetry}>
          다시 시도
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyReader() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <FolderTree className="h-6 w-6" />
        </div>
        <p className="mt-5 font-display text-xl font-semibold text-primary">NO DOCUMENT</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          현재 경로에서 markdown 파일을 찾지 못했거나 아직 선택된 문서가 없습니다.
        </p>
      </div>
    </div>
  );
}

export default App;
