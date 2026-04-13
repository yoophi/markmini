import { invoke } from "@tauri-apps/api/core";

import type { InitialSession, MarkdownDocument } from "@/types/content";

export function getInitialSession() {
  return invoke<InitialSession>("get_initial_session");
}

export function readMarkdownFile(relativePath: string) {
  return invoke<MarkdownDocument>("read_markdown_file", { relativePath });
}
