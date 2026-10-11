import MarkdownIt from "markdown-it";
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

  public shouldFail(): boolean {
    return this.#annotation === ANNOTATIONS.FAIL;
  }

  public shouldFailToCompile(): boolean {
    return this.#annotation === ANNOTATIONS.COMPILE_FAIL;
  }

  public splitImports(): { imports: string[]; body: string } {
    return splitImportsAndBlock(this);
  }
}

/** HTML blocks on, as in CommonMark, so code inside HTML isn't read as fences */
const markdown = new MarkdownIt({ html: true });

/** A fence's info string: the language, then the rest */
function splitInfo(info: string): { lang: string; meta: string } {
  const [lang = "", ...rest] = info.trim().split(/\s+/);
  return { lang, meta: rest.join(" ") };
}

export function parseCodeFences(source: string, path: string, log: Logger): CodeBlock[] {
  const lines = source.split("\n");
  return markdown.parse(source, {}).flatMap((token) => {
    if (token.type !== "fence") return [];
    const { lang, meta } = splitInfo(token.info);
    if (!meta || !isLang(lang)) return [];

    const result = parseAnnotation(meta);
    if (result.tag === "unknown") {
      log.error(`unknown annotation in code block: "${result.raw}"`);
      return [];
    }
    if (result.tag === "none" || result.annotation === ANNOTATIONS.SKIP) return [];
    if (!token.map) {
      log.error(`code block missing position info, skipping`);
      return [];
    }
    const [start, end] = token.map;
    const column = (lines[start] ?? "").search(/[`~]/) + 1;
    return [
      new CodeBlock({
        code: token.content.replace(/\n$/, ""),
        lang,
        annotation: result.annotation,
        path,
        range: {
          start: { line: start + 1, column },
          end: { line: end, column: (lines[end - 1] ?? "").length + 1 },
        },
        indent: column - 1,
      }),
    ];
  });
}
