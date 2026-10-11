import type { RootContent } from "mdast";
import { markdownToMdast, mdxToMdast, type MdastNode } from "satteri";
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

/** Setup code from a `<!-- ddt-hide ... -->` comment just before a fence, run before the fence */
export type HiddenCode = Readonly<{
  code: string;
  /** 1 indexed line of the first line of code in the markdown */
  line: number;
  indent: number;
}>;

export type CodeBlockInit = {
  code: string;
  lang: Lang;
  annotation: Annotation | null;
  path: string;
  range: SourceRange;
  indent: number;
  hidden?: HiddenCode;
};

export class CodeBlock {
  readonly #code: string;
  public readonly lang: Lang;
  readonly #annotation: Annotation | null;
  readonly #path: string;
  readonly #range: SourceRange;
  readonly #indent: number;
  readonly #hidden: HiddenCode | undefined;

  public constructor({ code, lang, annotation, path, range, indent, hidden }: CodeBlockInit) {
    this.#code = code;
    this.#hidden = hidden;
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

  /** The code that runs: hidden setup, then the fence's own code */
  public get source(): string {
    return this.#hidden ? `${this.#hidden.code}\n${this.#code}` : this.#code;
  }

  /** Maps an offset in {@link source} to its position in the markdown */
  public positionAt(offset: number): Position {
    const before = this.source.slice(0, offset);
    const line = before.split("\n").length - 1;
    return this.docPosition(line, offset - before.lastIndexOf("\n") - 1);
  }

  /** Maps a 0 indexed line and column in {@link source} to its position in the markdown */
  public docPosition(line: number, column: number): Position {
    const hiddenLines = this.#hidden?.code.split("\n").length ?? 0;
    if (this.#hidden && line < hiddenLines) {
      return { line: this.#hidden.line + line, column: column + 1 + this.#hidden.indent };
    }
    return { line: this.line + 1 + line - hiddenLines, column: column + 1 + this.#indent };
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

/** A ddt-hide comment's opening line, and the whole comment with the setup code on the lines between */
type DdtComment = Readonly<{ open: RegExp; comment: RegExp }>;

/** `<!-- ddt-hide` in markdown; `{/* ddt-hide` in MDX, which has no HTML comments */
const ddtComments: Partial<Record<RootContent["type"], DdtComment>> = {
  html: { open: /^<!--\s*ddt-hide\b/, comment: /^<!--\s*ddt-hide\s*\n(?<code>[\s\S]*)\n\s*-->$/ },
  mdxFlowExpression: {
    open: /^\/\*\s*ddt-hide\b/,
    comment: /^\/\*\s*ddt-hide\s*\n(?<code>[\s\S]*)\n\s*\*\/$/,
  },
};

/** Setup code from a ddt-hide comment right before a fence */
function hiddenCode(node: RootContent | undefined, log: Logger): HiddenCode | undefined {
  if (!node || !("value" in node) || !node.position) return undefined;
  const ddt = ddtComments[node.type];
  if (!ddt?.open.test(node.value)) return undefined;
  const code = ddt.comment.exec(node.value)?.groups?.["code"];
  if (code === undefined) {
    log.error(
      "ddt-hide comments put setup code on the lines between the opening and closing lines",
    );
    return undefined;
  }
  const { start } = node.position;
  return { code, line: start.line + 1, indent: start.column - 1 };
}

/** Markdown, or MDX for `.mdx` files so fences inside components count */
function parseMarkdown(source: string, path: string): MdastNode {
  if (!path.endsWith(".mdx")) return markdownToMdast(source);
  try {
    return mdxToMdast(source);
  } catch (error) {
    throw new Error(`${path} is not valid MDX`, { cause: error });
  }
}

export function parseCodeFences(source: string, path: string, log: Logger): CodeBlock[] {
  const tree = parseMarkdown(source, path);
  const blocks: CodeBlock[] = [];

  visit(tree, "code", (node, index, parent) => {
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
        hidden: hiddenCode(index === undefined ? undefined : parent?.children[index - 1], log),
      }),
    );
  });

  return blocks;
}
