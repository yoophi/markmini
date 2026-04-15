import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { InitialSession, MarkdownDocument } from "@/types/content";

export interface FsChangePayload {
  changedPaths: string[];
  treeChanged: boolean;
}

const FS_CHANGE_EVENT = "markmini://fs-change";

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
