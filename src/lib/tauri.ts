import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { InitialSession, MarkdownDocument, ScanStatus } from "@/types/content";

export interface FsChangePayload {
  changedPaths: string[];
  treeChanged: boolean;
}

export interface ScanProgressPayload {
  files: string[];
  selectedFile: string | null;
  status: ScanStatus;
  skippedPaths: string[];
  error: string | null;
}

const FS_CHANGE_EVENT = "markmini://fs-change";
const SCAN_PROGRESS_EVENT = "markmini://scan-progress";

export function getInitialSession() {
  return invoke<InitialSession>("get_initial_session");
}

export function refreshSession() {
  return invoke<InitialSession>("refresh_session");
}

export function readMarkdownFile(relativePath: string) {
  return invoke<MarkdownDocument>("read_markdown_file", { relativePath });
}

export function listenToFsChanges(handler: (payload: FsChangePayload) => void): Promise<UnlistenFn> {
  return listen<FsChangePayload>(FS_CHANGE_EVENT, (event) => handler(event.payload));
}

export function listenToScanProgress(handler: (payload: ScanProgressPayload) => void): Promise<UnlistenFn> {
  return listen<ScanProgressPayload>(SCAN_PROGRESS_EVENT, (event) => handler(event.payload));
}
