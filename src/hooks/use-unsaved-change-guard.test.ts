/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUnsavedChangeGuard } from "@/hooks/use-unsaved-change-guard";
import { useAppStore } from "@/store/app-store";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: vi.fn(async () => vi.fn()),
    close: vi.fn(),
  }),
}));

function resetStore() {
  useAppStore.setState({
    selectedFile: "notes/a.md",
    document: {
      state: "ready",
      content: "# Saved\n",
      savedContent: "# Saved\n",
      draftContent: "# Saved\n",
      headings: [],
      error: null,
      mode: "edit",
      isDirty: false,
      isSaving: false,
      lastSavedAt: null,
      externalChangeDetected: false,
    },
    saveCurrentDocument: async () => {
      const state = useAppStore.getState();
      useAppStore.setState({
        document: {
          ...state.document,
          content: state.document.draftContent,
          savedContent: state.document.draftContent,
          isDirty: false,
          error: null,
        },
      });
    },
  });
}

function makeDirtyDraft() {
  const state = useAppStore.getState();
  useAppStore.setState({
    document: {
      ...state.document,
      content: "# Draft\n",
      draftContent: "# Draft\n",
      isDirty: true,
    },
  });
}

describe("useUnsavedChangeGuard", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("runs guarded actions immediately when the document is clean", () => {
    const run = vi.fn();
    const { result } = renderHook(() => useUnsavedChangeGuard());

    act(() => {
      result.current.runGuardedAction({
        title: "Open",
        description: "Open another document",
        confirmLabel: "Open",
        run,
      });
    });

    expect(run).toHaveBeenCalledOnce();
    expect(result.current.pendingUnsavedAction).toBeNull();
  });

  it("stores a pending action when the document is dirty and confirms discard", async () => {
    makeDirtyDraft();
    const run = vi.fn();
    const { result } = renderHook(() => useUnsavedChangeGuard());

    act(() => {
      result.current.runGuardedAction({
        title: "Open",
        description: "Open another document",
        confirmLabel: "Discard and open",
        run,
      });
    });

    expect(run).not.toHaveBeenCalled();
    expect(result.current.pendingUnsavedAction?.title).toBe("Open");

    await act(async () => {
      await result.current.confirmPendingUnsavedAction();
    });

    expect(run).toHaveBeenCalledOnce();
    expect(result.current.pendingUnsavedAction).toBeNull();
  });

  it("clears a pending action when cancelled", () => {
    makeDirtyDraft();
    const { result } = renderHook(() => useUnsavedChangeGuard());

    act(() => {
      result.current.runGuardedAction({
        title: "Refresh",
        description: "Refresh session",
        confirmLabel: "Discard and refresh",
        run: vi.fn(),
      });
    });

    expect(result.current.pendingUnsavedAction).not.toBeNull();

    act(() => {
      result.current.clearPendingUnsavedAction();
    });

    expect(result.current.pendingUnsavedAction).toBeNull();
  });

  it("saves a dirty draft before continuing a pending action", async () => {
    makeDirtyDraft();
    const run = vi.fn();
    const { result } = renderHook(() => useUnsavedChangeGuard());

    act(() => {
      result.current.runGuardedAction({
        title: "Delete",
        description: "Delete current document",
        confirmLabel: "Discard and delete",
        run,
      });
    });

    await act(async () => {
      await result.current.saveAndContinuePendingAction();
    });

    expect(run).toHaveBeenCalledOnce();
    expect(result.current.pendingUnsavedAction).toBeNull();
    expect(useAppStore.getState().document).toMatchObject({
      savedContent: "# Draft\n",
      isDirty: false,
      error: null,
    });
  });

  it("keeps the pending action when save does not resolve the dirty state", async () => {
    makeDirtyDraft();
    const run = vi.fn();
    useAppStore.setState({
      saveCurrentDocument: async () => {
        const state = useAppStore.getState();
        useAppStore.setState({
          document: {
            ...state.document,
            error: "문서를 저장하지 못했습니다.",
          },
        });
      },
    });
    const { result } = renderHook(() => useUnsavedChangeGuard());

    act(() => {
      result.current.runGuardedAction({
        title: "Refresh",
        description: "Refresh session",
        confirmLabel: "Discard and refresh",
        run,
      });
    });

    await act(async () => {
      await result.current.saveAndContinuePendingAction();
    });

    expect(run).not.toHaveBeenCalled();
    expect(result.current.pendingUnsavedAction?.title).toBe("Refresh");
    expect(useAppStore.getState().document.error).toBe("문서를 저장하지 못했습니다.");
  });
});
