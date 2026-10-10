import { createRequire } from "node:module";
import { parseSync } from "oxc-parser";
import type * as TsrxParser from "@tsrx/oxc/parser";
import type { ExportDefaultDeclarationKind, Program } from "@oxc-project/types";
import type { CodeBlock } from "./blocks.ts";
import { LANGS } from "./constants.ts";

type ParsedBodyNode = Program["body"][number];
type SyntheticDefaultNode = {
  kind: "synthetic-default";
  declaration: ExportDefaultDeclarationKind;
};
type BodyNode = ParsedBodyNode | SyntheticDefaultNode;

export type PreparedBlock = {
  imports: string[];
  body: string;
};

export function splitImportsAndBlock(block: CodeBlock): PreparedBlock {
  const { program, staticImports } = parse(block);

  const imports = staticImports.map((staticImport) => sliceSource(block.code, staticImport));

  const transformed = sanitizeProgram(program);
  const body = transformed.map((node) => printBodyNode(block.code, node)).join("\n");

  return { imports, body };
}

type ParsedBlock = { program: Program; staticImports: Range[] };
type ParseError = { message: string; labels: Range[] };

function parse(block: CodeBlock): ParsedBlock {
  const lang = LANGS[block.lang].parser;
  const filename = `block.${lang}`;
  const { program, module, errors } =
    lang === "tsrx"
      ? parseTsrx(filename, block.code)
      : parseSync(filename, block.code, { lang, sourceType: "module" });

  if (errors.length > 0 || !program || !module) {
    throw new SyntaxError(errors.map((error) => formatParseError(block, error)).join("\n"));
  }
  return { program, staticImports: module.staticImports };
}

function formatParseError(block: CodeBlock, error: ParseError): string {
  const label = error.labels[0];
  if (!label) return error.message;
  const line = block.line + block.code.slice(0, label.start).split("\n").length;
  return `${error.message} (line ${line})`;
}

// tsrx parser throws sometimes
function parseTsrx(filename: string, code: string): ReturnType<typeof TsrxParser.parseSync> {
  const parser = tsrxParser();
  try {
    return parser.parseSync(filename, code, { lang: "tsrx", sourceType: "module" });
  } catch (error) {
    throw new SyntaxError(error instanceof Error ? error.message : String(error), { cause: error });
  }
}

const requireTsrxParser: (id: "@tsrx/oxc/parser") => typeof TsrxParser = createRequire(
  import.meta.url,
);
let cachedTsrxParser: typeof TsrxParser | undefined;

function tsrxParser(): typeof TsrxParser {
  try {
    cachedTsrxParser ??= requireTsrxParser("@tsrx/oxc/parser");
    return cachedTsrxParser;
  } catch (error) {
    throw new Error('tsrx code blocks need "@tsrx/oxc" installed', { cause: error });
  }
}

function sanitizeProgram(program: Program): BodyNode[] {
  return program.body.flatMap(sanitizeStatement);
}

function sanitizeStatement(node: ParsedBodyNode): BodyNode[] {
  if (node.type === "ImportDeclaration") return [];
  if (node.type === "ExportAllDeclaration") return [];

  if (node.type === "ExportNamedDeclaration") {
    if (!node.declaration) {
      return [];
    }
    return [node.declaration];
  }

  if (node.type === "ExportDefaultDeclaration") {
    const decl = node.declaration;

    if (decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration") {
      return [decl];
    }

    return [{ kind: "synthetic-default", declaration: decl }];
  }

  return [node];
}

function printBodyNode(source: string, node: BodyNode): string {
  if ("kind" in node && node.kind === "synthetic-default") {
    return `const ______default_that_does_not_conflict = ${sliceSource(source, node.declaration)};`;
  }

  return sliceSource(source, node);
}

type Range = { start: number; end: number };
function sliceSource(source: string, { start, end }: Range): string {
  return source.slice(start, end).trimEnd();
}
