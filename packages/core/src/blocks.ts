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
import { columnsBeforeOffset, linesBeforeOffset, WHOLE_FILE, type Placement } from "./placement.ts";
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

function zeroBased({ line, column }: Position): Position {
  return { line: line - 1, column: column - 1 };
}

function oneBased({ line, column }: Position): Position {
  return { line: line + 1, column: column + 1 };
}

export type CodeBlockInit = {
  code: string;
  lang: Lang;
  annotation: Annotation | null;
  path: string;
  rangeInText: SourceRange;
  placement?: Placement;
};

export class CodeBlock {
  readonly #code: string;
  public readonly lang: Lang;
  readonly #annotation: Annotation | null;
  readonly #path: string;
  readonly #fenceInText: Position;
  readonly #placement: Placement;
  readonly #rangeInFile: SourceRange;
  readonly #fenceInFile: Position;

  public constructor({
    code,
    lang,
    annotation,
    path,
    rangeInText,
    placement = WHOLE_FILE,
  }: CodeBlockInit) {
    this.#code = code;
    this.lang = lang;
    this.#annotation = annotation;
    this.#path = path;
    this.#placement = placement;
    this.#fenceInText = zeroBased(rangeInText.start);
    const inFile = (position: Position): Position => ({
      line: position.line + placement.linesBefore,
      column: position.column + placement.columnsBeforeLine(position.line),
    });
    this.#fenceInFile = inFile(this.#fenceInText);
    this.#rangeInFile = {
      start: oneBased(this.#fenceInFile),
      end: oneBased(inFile(zeroBased(rangeInText.end))),
    };
  }

  public get line(): number {
    return this.#rangeInFile.start.line;
  }

  /** 0 indexed */
  public get zeroBasedStart(): Position {
    return this.#fenceInFile;
  }

  /** 0 indexed file line */
  public get firstCodeLine(): number {
    return this.#fenceInFile.line + 1;
  }

  public get details(): BlockDetails {
    return {
      file: this.#path,
      lang: this.lang,
      annotation: this.#annotation,
      range: this.#rangeInFile,
      contents: this.#code,
    };
  }

  /** `codeLine` is 0 indexed */
  public columnsBeforeCodeLine(codeLine: number): number {
    const lineInText = this.#fenceInText.line + 1 + codeLine;
    return this.#fenceInText.column + this.#placement.columnsBeforeLine(lineInText);
  }

  public positionAt(offset: number): Position {
    const codeLine = linesBeforeOffset(this.#code, offset);
    const codeColumn = columnsBeforeOffset(this.#code, offset);
    return oneBased({
      line: this.firstCodeLine + codeLine,
      column: this.columnsBeforeCodeLine(codeLine) + codeColumn,
    });
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
  placement: Placement = WHOLE_FILE,
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
        rangeInText: {
          start: { line: start.line, column: start.column },
          end: { line: end.line, column: end.column },
        },
        placement,
      }),
    );
  });

  return blocks;
}
