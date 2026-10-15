const MARKDOWN_EXTENSIONS = ["md", "mdx"];
const SOURCE_EXTENSIONS = ["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs"];

const endsWithAny = (path: string, extensions: readonly string[]): boolean =>
  extensions.some((extension) => path.endsWith(`.${extension}`));

/** Whether a doc is markdown, whose code fences are the doc's own text */
export function isMarkdownFile(path: string): boolean {
  return endsWithAny(path, MARKDOWN_EXTENSIONS);
}

/** Whether a doc is a source file, whose JSDoc comments hold the code fences */
export function isSourceFile(path: string): boolean {
  return endsWithAny(path, SOURCE_EXTENSIONS);
}

/** A glob matching every kind of doc */
export const DOC_GLOB: string = `**/*.{${[...MARKDOWN_EXTENSIONS, ...SOURCE_EXTENSIONS].join(",")}}`;
