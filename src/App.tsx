import { useEffect } from "react";
import { Edit3, Eye, FileText, FolderTree, Menu, RefreshCcw, Save, TextSearch } from "lucide-react";

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
  const setDocumentMode = useAppStore((state) => state.setDocumentMode);
  const updateDraftContent = useAppStore((state) => state.updateDraftContent);
  const saveCurrentDocument = useAppStore((state) => state.saveCurrentDocument);
  const reloadCurrentDocument = useAppStore((state) => state.reloadCurrentDocument);
  const keepDraftAfterExternalChange = useAppStore((state) => state.keepDraftAfterExternalChange);
  const bootstrapState = useAppStore((state) => state.bootstrapState);
  const error = useAppStore((state) => state.error);
  const rootDir = useAppStore((state) => state.rootDir);
  const files = useAppStore((state) => state.files);
  const scanState = useAppStore((state) => state.scanState);
  const scanSkippedPaths = useAppStore((state) => state.scanSkippedPaths);
  const scanError = useAppStore((state) => state.scanError);
  const selectedFile = useAppStore((state) => state.selectedFile);
  const document = useAppStore((state) => state.document);
  const isSidebarOpen = useAppStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
  const canSaveDocument =
    document.state === "ready" &&
    document.isDirty &&
    !document.isSaving &&
    !document.externalChangeDetected;

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (canSaveDocument) {
          void saveCurrentDocument();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canSaveDocument, saveCurrentDocument]);

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
                  scanState={scanState}
                  skippedCount={scanSkippedPaths.length}
                  selectedFile={selectedFile}
                  onSelect={(file) => void openDocument(file)}
                />
              </div>
            </aside>

            <section className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <Card className="min-h-[70vh] overflow-hidden">
                <CardContent className="flex h-full flex-col p-0">
                  <div className="border-b border-border/60 px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
                          <TextSearch className="h-4 w-4" />
                          {document.mode === "edit" ? "Editor" : "Reader"}
                          {document.isDirty ? <span className="tracking-normal text-destructive">저장 안 됨</span> : null}
                        </div>
                        <h1 className="mt-2 truncate font-display text-2xl font-semibold text-foreground">{selectedLabel}</h1>
                      </div>
                      {document.state === "ready" ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDocumentMode(document.mode === "edit" ? "preview" : "edit")}
                          >
                            {document.mode === "edit" ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                            {document.mode === "edit" ? "미리보기" : "편집"}
                          </Button>
                          <Button
                            size="sm"
                            disabled={!canSaveDocument}
                            onClick={() => void saveCurrentDocument()}
                          >
                            <Save className="h-4 w-4" />
                            {document.isSaving ? "저장 중" : "저장"}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {document.externalChangeDetected ? (
                    <div className="border-b border-border/60 bg-secondary px-5 py-3 text-sm text-secondary-foreground">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>파일이 디스크에서 변경되었습니다.</span>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => void reloadCurrentDocument(true)}>
                            디스크에서 다시 불러오기
                          </Button>
                          <Button variant="ghost" size="sm" onClick={keepDraftAfterExternalChange}>
                            현재 편집 유지
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {document.state === "ready" && document.error ? (
                    <div className="border-b border-destructive/30 bg-destructive/10 px-5 py-3 text-sm text-destructive">
                      {document.error}
                    </div>
                  ) : null}

                  {document.state === "loading" ? (
                    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                      문서를 불러오는 중입니다.
                    </div>
                  ) : document.state === "error" ? (
                    <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-destructive">
                      {document.error}
                    </div>
                  ) : document.state === "ready" && document.mode === "edit" ? (
                    <MarkdownEditor content={document.draftContent} onChange={updateDraftContent} />
                  ) : document.state === "ready" ? (
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

              <aside className="min-h-0">
                <div className="sticky top-4">
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

function MarkdownEditor({ content, onChange }: { content: string; onChange: (content: string) => void }) {
  return (
    <div className="h-[calc(100vh-13rem)] bg-background">
      <textarea
        value={content}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className="h-full w-full resize-none border-0 bg-background px-5 py-6 font-mono text-sm leading-7 text-foreground outline-none placeholder:text-muted-foreground focus:ring-0 sm:px-8"
      />
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
