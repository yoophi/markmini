import type { UnlistenFn } from "@tauri-apps/api/event";

import { listenToFsChanges, listenToOpenDocument, listenToScanProgress, listenToWindowHighlight } from "@/lib/tauri";
import { useAppStore } from "@/store/app-store";

const DEBOUNCE_MS = 200;

export function subscribeToFsChanges(): Promise<UnlistenFn> {
  let timeoutId: number | null = null;
  let pendingPaths = new Set<string>();
  let pendingTreeChanged = false;

  const flush = () => {
    const paths = pendingPaths;
    const treeChanged = pendingTreeChanged;
    pendingPaths = new Set();
    pendingTreeChanged = false;
    timeoutId = null;

    const state = useAppStore.getState();

    if (treeChanged) {
      void state.refresh();
      return;
    }

    if (state.selectedFile && paths.has(state.selectedFile)) {
      void state.reloadCurrentDocument();
    }
  };

  return listenToFsChanges((payload) => {
    for (const path of payload.changedPaths) {
      pendingPaths.add(path);
    }
    if (payload.treeChanged) {
      pendingTreeChanged = true;
    }

    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(flush, DEBOUNCE_MS);
  });
}

export function subscribeToScanProgress(): Promise<UnlistenFn> {
  return listenToScanProgress((payload) => {
    void useAppStore.getState().applyScanProgress(payload);
  });
}

export async function subscribeToWindowCommands(onHighlight: () => void): Promise<UnlistenFn> {
  const unlistenOpenDocument = await listenToOpenDocument((payload) => {
    void useAppStore.getState().requestOpenDocument(payload.relativePath);
  });
  const unlistenHighlight = await listenToWindowHighlight(onHighlight);

  return () => {
    unlistenOpenDocument();
    unlistenHighlight();
  };
}
