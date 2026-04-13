export interface HeadingItem {
  depth: 1 | 2 | 3;
  text: string;
  id: string;
}

export interface InitialSession {
  rootDir: string;
  files: string[];
  selectedFile: string | null;
}

export interface MarkdownDocument {
  relativePath: string;
  content: string;
  headings: HeadingItem[];
}
