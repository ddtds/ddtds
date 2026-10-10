import { parseSync, type OxcError, type ParserOptions } from "oxc-parser";
import type { ExportDefaultDeclarationKind, Program } from "@oxc-project/types";
import type { CodeBlock } from "./blocks.ts";
import { DdtSyntaxError } from "./error.ts";

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
  const lang = parserLang(block.lang);
  const { program, module, errors } = parseSync(`block.${lang}`, block.code, {
    lang,
    sourceType: "module",
  });

  if (errors.length > 0) {
    throw new DdtSyntaxError(errors.map((error) => formatParseError(block, error)).join("\n"));
  }

  const imports = module.staticImports.map((staticImport) => sliceSource(block.code, staticImport));

  const transformed = sanitizeProgram(program);
  const body = transformed.map((node) => printBodyNode(block.code, node)).join("\n");

  return { imports, body };
}

function formatParseError(block: CodeBlock, error: OxcError): string {
  const label = error.labels[0];
  if (!label) return error.message;
  const line = block.line + block.code.slice(0, label.start).split("\n").length;
  return `${error.message} (line ${line})`;
}

function parserLang(lang: string): NonNullable<ParserOptions["lang"]> {
  if (lang === "javascript") return "js";
  if (lang === "typescript") return "ts";
  if (lang === "jsx") return "jsx";
  if (lang === "tsx") return "tsx";
  return "ts";
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
