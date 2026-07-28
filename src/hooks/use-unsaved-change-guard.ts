import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { useAppStore } from "@/store/app-store";

export type PendingUnsavedAction = {
  title: string;
  description: string;
  confirmLabel: string;
  run: () => Promise<void> | void;
};

export function useUnsavedChangeGuard() {
  const document = useAppStore((state) => state.document);
  const saveCurrentDocument = useAppStore((state) => state.saveCurrentDocument);
  const [pendingUnsavedAction, setPendingUnsavedAction] = useState<PendingUnsavedAction | null>(null);
  const allowWindowCloseRef = useRef(false);

  const canSaveDocument =
    document.state === "ready" &&
    document.isDirty &&
    !document.isSaving &&
    !document.externalChangeDetected;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!document.isDirty || allowWindowCloseRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [document.isDirty]);

  useEffect(() => {
    let isDisposed = false;
    let cleanup: (() => void) | undefined;

    const setupCloseGuard = async () => {
      try {
        const appWindow = getCurrentWindow();
        const unlisten = await appWindow.onCloseRequested(async (event) => {
          if (allowWindowCloseRef.current || !document.isDirty) {
            return;
          }

          event.preventDefault();
          setPendingUnsavedAction({
            title: "저장하지 않은 변경사항이 있습니다",
            description: "이 창을 닫으면 현재 문서의 저장되지 않은 편집 내용이 사라집니다. 저장 후 닫거나, 변경사항을 버리고 닫을 수 있습니다.",
            confirmLabel: "변경사항 버리고 닫기",
            run: async () => {
              allowWindowCloseRef.current = true;
              await appWindow.close();
            },
          });
        });

        if (isDisposed) {
          unlisten();
          return;
        }

        cleanup = unlisten;
      } catch {
        // non-tauri surface
      }
    };

    void setupCloseGuard();

    return () => {
      isDisposed = true;
      cleanup?.();
    };
  }, [document.isDirty]);

  const runGuardedAction = useCallback(
    (action: PendingUnsavedAction) => {
      if (document.isDirty) {
        setPendingUnsavedAction(action);
        return;
      }

      void action.run();
    },
    [document.isDirty],
  );

  const requestUnsavedConfirmation = useCallback((action: PendingUnsavedAction) => {
    setPendingUnsavedAction(action);
  }, []);

  const clearPendingUnsavedAction = useCallback(() => {
    setPendingUnsavedAction(null);
  }, []);

  const confirmPendingUnsavedAction = useCallback(async () => {
    if (!pendingUnsavedAction) {
      return;
    }

    const action = pendingUnsavedAction;
    setPendingUnsavedAction(null);
    await action.run();
  }, [pendingUnsavedAction]);

  const saveAndContinuePendingAction = useCallback(async () => {
    if (!pendingUnsavedAction) {
      return;
    }

    await saveCurrentDocument();

    const latestDocument = useAppStore.getState().document;
    if (latestDocument.isDirty || latestDocument.error) {
      return;
    }

    const action = pendingUnsavedAction;
    setPendingUnsavedAction(null);
    await action.run();
  }, [pendingUnsavedAction, saveCurrentDocument]);

  return {
    canSaveDocument,
    pendingUnsavedAction,
    requestUnsavedConfirmation,
    runGuardedAction,
    clearPendingUnsavedAction,
    confirmPendingUnsavedAction,
    saveAndContinuePendingAction,
  };
}
