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
import { columnsBefore, linesBefore, NO_SHIFT, type Shift } from "./shift.ts";
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
  /** Where the fence is in the parsed text, which is not the file when `shift` is set */
  range: SourceRange;
  /** How far the parsed text is shifted in the file */
  shift?: Shift;
};

export class CodeBlock {
  readonly #code: string;
  public readonly lang: Lang;
  readonly #annotation: Annotation | null;
  readonly #path: string;
  readonly #textRange: SourceRange;
  readonly #shift: Shift;
  readonly #range: SourceRange;

  public constructor({ code, lang, annotation, path, range, shift = NO_SHIFT }: CodeBlockInit) {
    this.#code = code;
    this.lang = lang;
    this.#annotation = annotation;
    this.#path = path;
    this.#textRange = range;
    this.#shift = shift;
    const move = ({ line, column }: Position): Position => ({
      line: line + shift.lines,
      column: column + shift.columns(line),
    });
    this.#range = { start: move(range.start), end: move(range.end) };
  }

  /** The line of the fence's opening in the file */
  public get line(): number {
    return this.#range.start.line;
  }

  public get details(): BlockDetails {
    return {
      file: this.#path,
      lang: this.lang,
      annotation: this.#annotation,
      range: this.#range,
      contents: this.#code,
    };
  }

  /** How many file columns come before the text of a 0 indexed line of the code */
  public columnsBeforeCode(codeLine: number): number {
    // the parser strips the fence's indent from each code line, so it is added back
    const fenceIndent = this.#textRange.start.column - 1;
    const textLine = this.#textRange.start.line + 1 + codeLine;
    return fenceIndent + this.#shift.columns(textLine);
  }

  /** The 1 indexed file position of a character offset in the code */
  public positionAt(offset: number): Position {
    const codeLine = linesBefore(this.#code, offset);
    const codeColumn = columnsBefore(this.#code, offset);
    return {
      line: this.line + 1 + codeLine,
      column: this.columnsBeforeCode(codeLine) + codeColumn + 1,
    };
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
  shift: Shift = NO_SHIFT,
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
        shift,
      }),
    );
  });

  return blocks;
}
