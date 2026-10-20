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
import { parseInfo } from "./info.ts";
import { splitImportsAndBlock, type PreparedBlock } from "./parse.ts";

const logger = getLogger(["ddtds", "blocks"]);

type AnnotationResult =
  | { tag: "ok"; annotation: Annotation }
  | { tag: "none" }
  | { tag: "conflict"; annotations: Annotation[] };

function parseAnnotation(meta: string): AnnotationResult {
  const annotations = parseInfo(meta).words.filter(isAnnotation);
  const [annotation] = annotations;
  if (annotation === undefined) return { tag: "none" };
  if (annotations.length > 1) return { tag: "conflict", annotations };
  return { tag: "ok", annotation };
}

export type CodeBlockInit = {
  code: string;
  lang: Lang;
  annotation: Annotation | null;
  path: string;
  rangeInText: SourceRange;
  placement?: Placement;
  setup?: readonly CodeRun[];
};

export class CodeBlock {
  readonly #code: string;
  readonly #segments: readonly Segment[];
  public readonly details: BlockDetails;
  readonly #placement: Placement;

  public constructor(init: CodeBlockInit) {
    const { code, setup = [], placement = WHOLE_FILE, rangeInText } = init;
    this.#placement = placement;
    this.#code = codeWithSetup(setup, code);
    this.#segments = segmentsOf(setup, zeroBased(rangeInText.start));
    this.details = {
      file: init.path,
      lang: init.lang,
      annotation: init.annotation,
      range: rangeInFile(placement, rangeInText),
      contents: code,
    };
  }

  public get lang(): Lang {
    return this.details.lang;
  }

  public get line(): number {
    return this.details.range.start.line;
  }

  public get zeroBasedStart(): Position {
    return zeroBased(this.details.range.start);
  }

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
    return this.details.annotation === ANNOTATIONS.FAIL;
  }

  public shouldFailToCompile(): boolean {
    return this.details.annotation === ANNOTATIONS.COMPILE_FAIL;
  }

  public isCompileOnly(): boolean {
    return this.details.annotation === ANNOTATIONS.COMPILE_ONLY;
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
    if (result.tag === "conflict") {
      logger.warn("code block has more than one annotation: {annotations}", () => ({
        annotations: result.annotations.join(", "),
      }));
      return;
    }
    if (result.tag === "none" || result.annotation === ANNOTATIONS.SKIP) return;
    if (!node.position) throw new Error("code block has no position");
    const setup = setupBefore(siblings, index);
    if (setup.length > 0) {
      logger.debug("{path}:{line} uses {count} setup comments", {
        path,
        line: node.position.start.line,
        count: setup.length,
      });
    }
    blocks.push(
      new CodeBlock({
        code: node.value,
        lang,
        annotation: result.annotation,
        path,
        rangeInText: node.position,
        placement,
        setup,
      }),
    );
  });

  return blocks;
}
