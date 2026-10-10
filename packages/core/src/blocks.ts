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
import type { SourceRange } from "./compile-error.ts";
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
  meta: string;
  path: string;
  range: SourceRange;
  indent: number;
};

export class CodeBlock {
  readonly #code: string;
  public readonly lang: Lang;
  public readonly annotation: Annotation | null;
  public readonly meta: string;
  public readonly path: string;
  public readonly range: SourceRange;
  public readonly indent: number;

  public constructor({ code, lang, annotation, meta, path, range, indent }: CodeBlockInit) {
    this.#code = code;
    this.lang = lang;
    this.annotation = annotation;
    this.meta = meta;
    this.path = path;
    this.range = range;
    this.indent = indent;
  }

  public get line(): number {
    return this.range.start.line;
  }

  public get outputExtension(): OutputExtension {
    return LANGS[this.lang].extension;
  }

  public get code(): string {
    return this.#code;
  }

  public isSkipped(): boolean {
    return this.annotation !== ANNOTATIONS.RUN && this.annotation !== ANNOTATIONS.FAIL;
  }

  public shouldFail(): boolean {
    return this.annotation === ANNOTATIONS.FAIL;
  }

  public splitImports(): { imports: string[]; body: string } {
    return splitImportsAndBlock(this);
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
        meta,
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
