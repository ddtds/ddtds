import { getLogger } from "@logtape/logtape";
import { markdownToMdast, mdxToMdast, type MdastNode } from "satteri";
import { visit } from "unist-util-visit";
import {
  ANNOTATIONS,
  extensionOf,
  type Annotation,
  type Lang,
  type OutputExtension,
  isAnnotation,
  isLang,
} from "./constants.ts";
import type { BlockDetails, Position, SourceRange } from "./compile-error.ts";
import { NO_OFFSET, type Offset } from "./offset.ts";
import { splitImportsAndBlock, type PreparedBlock } from "./parse.ts";

const logger = getLogger(["ddtds", "blocks"]);

type AnnotationResult =
  | { tag: "ok"; annotation: Annotation }
  | { tag: "none" }
  | { tag: "unknown"; raw: string };

function parseAnnotation(meta: string): AnnotationResult {
  if (!meta) return { tag: "none" };
  if (isAnnotation(meta)) return { tag: "ok", annotation: meta };
  return { tag: "unknown", raw: meta };
}

export type CodeBlockInit = {
  code: string;
  lang: Lang;
  annotation: Annotation | null;
  path: string;
  /** Where the fence is in the parsed text, which is not the file when `offset` is set */
  range: SourceRange;
  /** Where the parsed text is in the file */
  offset?: Offset;
};

export class CodeBlock {
  readonly #code: string;
  public readonly lang: Lang;
  readonly #annotation: Annotation | null;
  readonly #path: string;
  readonly #textRange: SourceRange;
  readonly #offset: Offset;

  public constructor({ code, lang, annotation, path, range, offset = NO_OFFSET }: CodeBlockInit) {
    this.#code = code;
    this.lang = lang;
    this.#annotation = annotation;
    this.#path = path;
    this.#textRange = range;
    this.#offset = offset;
  }

  public get line(): number {
    return this.range.start.line;
  }

  /** The fence in the file */
  public get range(): SourceRange {
    const move = ({ line, column }: Position): Position => ({
      line: line + this.#offset.lines,
      column: column + this.#offset.columnsBefore(line),
    });
    return { start: move(this.#textRange.start), end: move(this.#textRange.end) };
  }

  public get details(): BlockDetails {
    const range = this.range;
    return {
      file: this.#path,
      lang: this.lang,
      annotation: this.#annotation,
      range,
      contents: this.#code,
    };
  }

  /** The file column of a 1 indexed column in a 0 indexed line of the code */
  public columnAt(codeLine: number, column: number): number {
    const fenceIndent = this.#textRange.start.column - 1;
    const textLine = this.#textRange.start.line + 1 + codeLine;
    // the parser removes the fence's indent from each code line, so it is added back
    return column + fenceIndent + this.#offset.columnsBefore(textLine);
  }

  /** maps code block offset to file position */
  public positionAt(offset: number): Position {
    const before = this.#code.slice(0, offset);
    const codeLine = before.split("\n").length;
    const line = this.line + codeLine;
    const column = this.columnAt(codeLine - 1, offset - this.#code.lastIndexOf("\n", offset - 1));
    return { line, column };
  }

  public get outputExtension(): OutputExtension {
    return extensionOf(this.lang);
  }

  public get code(): string {
    return this.#code;
  }

  public shouldFail(): boolean {
    return this.#annotation === ANNOTATIONS.FAIL;
  }

  public shouldFailToCompile(): boolean {
    return this.#annotation === ANNOTATIONS.COMPILE_FAIL;
  }

  public splitImports(): PreparedBlock {
    return splitImportsAndBlock(this);
  }
}

/**
 * Markdown, or MDX for `.mdx` files so fences inside components count. Any text is valid
 * markdown, so only MDX can fail to parse.
 */
function parseMarkdown(source: string, path: string): MdastNode {
  return path.endsWith(".mdx") ? mdxToMdast(source) : markdownToMdast(source);
}

export function parseCodeFences(
  source: string,
  path: string,
  offset: Offset = NO_OFFSET,
): CodeBlock[] {
  const tree = parseMarkdown(source, path);
  const blocks: CodeBlock[] = [];

  visit(tree, "code", (node) => {
    const { lang, meta } = node;
    if (!meta || !lang || !isLang(lang)) return;

    const result = parseAnnotation(meta);
    if (result.tag === "unknown") {
      logger.error('unknown annotation in code block: "{raw}"', { raw: result.raw });
      return;
    }
    if (result.tag === "none" || result.annotation === ANNOTATIONS.SKIP) return;
    if (!node.position) {
      logger.error("code block missing position info, skipping");
      return;
    }
    const { start, end } = node.position;
    blocks.push(
      new CodeBlock({
        code: node.value,
        lang,
        annotation: result.annotation,
        path,
        range: {
          start: { line: start.line, column: start.column },
          end: { line: end.line, column: end.column },
        },
        offset,
      }),
    );
  });

  return blocks;
}
