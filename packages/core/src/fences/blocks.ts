import { getLogger } from "@logtape/logtape";
import { markdownToMdast, mdxToMdast, type MdastNode } from "satteri";
import {
  ANNOTATIONS,
  extensionOf,
  type Annotation,
  type Lang,
  type OutputExtension,
  isAnnotation,
  isLang,
} from "../constants.ts";
import type { BlockDetails, Position, SourceRange } from "./compile-error.ts";
import {
  columnsBeforeOffset,
  linesBeforeOffset,
  oneBased,
  placeInFile,
  rangeInFile,
  WHOLE_FILE,
  zeroBased,
  type Placement,
} from "./placement.ts";
import {
  codeWithSetup,
  positionInText,
  segmentsOf,
  type CodeRun,
  type Segment,
} from "./segments.ts";
import { setupBefore } from "./hidden.ts";
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
  rangeInText: SourceRange;
  placement?: Placement;
  /** Setup code from comments above the fence; it runs before `code` */
  setup?: readonly CodeRun[];
};

export class CodeBlock {
  readonly #code: string;
  readonly #segments: readonly Segment[];
  public readonly lang: Lang;
  public readonly details: BlockDetails;
  readonly #annotation: Annotation | null;
  readonly #placement: Placement;
  readonly #fenceInFile: Position;

  public constructor(init: CodeBlockInit) {
    const { code, setup = [], placement = WHOLE_FILE, rangeInText } = init;
    const fenceInText = zeroBased(rangeInText.start);
    this.lang = init.lang;
    this.#annotation = init.annotation;
    this.#placement = placement;
    this.#code = codeWithSetup(setup, code);
    this.#segments = segmentsOf(setup, fenceInText);
    this.#fenceInFile = placeInFile(placement, fenceInText);
    this.details = {
      file: init.path,
      lang: init.lang,
      annotation: init.annotation,
      range: rangeInFile(placement, rangeInText),
      contents: code,
    };
  }

  public get line(): number {
    return this.details.range.start.line;
  }

  /** 0 indexed */
  public get zeroBasedStart(): Position {
    return this.#fenceInFile;
  }

  /** `codeLine` and `codeColumn` are 0 indexed in the code, and so is the result in the file */
  public zeroBasedPositionAt(codeLine: number, codeColumn: number): Position {
    return placeInFile(this.#placement, positionInText(this.#segments, codeLine, codeColumn));
  }

  public positionAt(offset: number): Position {
    return oneBased(
      this.zeroBasedPositionAt(
        linesBeforeOffset(this.#code, offset),
        columnsBeforeOffset(this.#code, offset),
      ),
    );
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

type CodeNode = Extract<MdastNode, { type: "code" }>;

/** Walks the tree in document order, calling `onCode` for every code block with its siblings. */
function visitCode(
  node: MdastNode,
  onCode: (node: CodeNode, siblings: readonly MdastNode[], index: number) => void,
): void {
  if (!("children" in node)) return;
  for (const [index, child] of node.children.entries()) {
    if (child.type === "code") onCode(child, node.children, index);
    visitCode(child, onCode);
  }
}

export function parseCodeFences(
  source: string,
  path: string,
  placement: Placement = WHOLE_FILE,
): CodeBlock[] {
  const tree = parseMarkdown(source, path);
  const blocks: CodeBlock[] = [];

  visitCode(tree, (node, siblings, index) => {
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
        setup: setupBefore(siblings, index),
      }),
    );
  });

  return blocks;
}
