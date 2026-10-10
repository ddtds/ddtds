import { remark } from "remark";
import { visit } from "unist-util-visit";
import {
  ANNOTATIONS,
  LANGS,
  type Annotation,
  type Lang,
  type OutputExtension,
  isAnnotation,
  isLang,
} from "./constants.ts";
import type { BlockDetails, Position, SourceRange } from "./compile-error.ts";
import { splitImportsAndBlock } from "./parse.ts";
import type { Logger } from "./logger.ts";

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
  range: SourceRange;
  indent: number;
};

export class CodeBlock {
  readonly #code: string;
  public readonly lang: Lang;
  readonly #annotation: Annotation | null;
  readonly #path: string;
  readonly #range: SourceRange;
  readonly #indent: number;

  public constructor({ code, lang, annotation, path, range, indent }: CodeBlockInit) {
    this.#code = code;
    this.lang = lang;
    this.#annotation = annotation;
    this.#path = path;
    this.#range = range;
    this.#indent = indent;
  }

  public get line(): number {
    return this.#range.start.line;
  }

  public get details(): BlockDetails {
    return {
      file: this.#path,
      lang: this.lang,
      annotation: this.#annotation,
      range: this.#range,
      indent: this.#indent,
      contents: this.#code,
    };
  }

  /** maps code block offset to file position */
  public positionAt(offset: number): Position {
    const before = this.#code.slice(0, offset);
    const line = this.line + before.split("\n").length;
    const column = offset - this.#code.lastIndexOf("\n", offset - 1) + this.#indent;
    return { line, column };
  }

  public get outputExtension(): OutputExtension {
    return LANGS[this.lang].extension;
  }

  public get code(): string {
    return this.#code;
  }

  public isSkipped(): boolean {
    return this.#annotation === null || this.#annotation === ANNOTATIONS.SKIP;
  }

  public shouldFail(): boolean {
    return this.#annotation === ANNOTATIONS.FAIL;
  }

  public shouldFailToCompile(): boolean {
    return this.#annotation === ANNOTATIONS.COMPILE_FAIL;
  }

  public splitImports(importsFrom?: string): { imports: string[]; body: string } {
    return splitImportsAndBlock(this, importsFrom);
  }
}

export function parseCodeFences(source: string, path: string, log: Logger): CodeBlock[] {
  const tree = remark().parse(source);
  const blocks: CodeBlock[] = [];

  visit(tree, "code", (node) => {
    const { lang, meta } = node;
    if (!meta || !lang || !isLang(lang)) return;

    const result = parseAnnotation(meta);
    if (result.tag === "unknown") {
      log.error(`unknown annotation in code block: "${result.raw}"`);
      return;
    }
    if (result.tag === "none" || result.annotation === ANNOTATIONS.SKIP) return;
    if (!node.position) {
      log.error(`code block missing position info, skipping`);
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
        indent: start.column - 1,
      }),
    );
  });

  return blocks;
}
