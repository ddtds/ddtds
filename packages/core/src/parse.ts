import { createRequire } from "node:module";
import { parseSync } from "oxc-parser";
import type * as TsrxParser from "@tsrx/oxc/parser";
import type { ExportDefaultDeclarationKind, Program } from "@oxc-project/types";
import type { CodeBlock } from "./blocks.ts";
import { LANGS, type Parser } from "./constants.ts";
import {
  DdtCompileError,
  type CompileDiagnostic,
  type CompilePhase,
  type ParserDetails,
  type ParserError,
} from "./compile-error.ts";

type ParsedBodyNode = Program["body"][number];
type SyntheticDefaultNode = {
  type: "SyntheticDefault";
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

function parse(block: CodeBlock): ParsedBlock {
  const parser = LANGS[block.lang].parser;
  const { program, module, errors } = runParser(block, parser);
  if (errors.length > 0 || !program || !module) {
    throw compileError(
      block,
      parser,
      "parse",
      errors.map((error) => toDiagnostic(block, error)),
    );
  }
  return { program, staticImports: module.staticImports };
}

type ParseResult = ReturnType<typeof parseSync> | ReturnType<typeof TsrxParser.parseSync>;

function runParser(block: CodeBlock, parser: Parser): ParseResult {
  const filename = `block.${parser}`;
  const options = { sourceType: "module", showSemanticErrors: true } as const;
  if (parser !== "tsrx") return parseSync(filename, block.code, { ...options, lang: parser });

  const tsrx = tsrxParser();
  try {
    return tsrx.parseSync(filename, block.code, { ...options, lang: parser });
  } catch (error) {
    // tsrx parser throws sometimes
    const message = error instanceof Error ? error.message : String(error);
    throw compileError(block, parser, "parser-crash", [{ message, labels: [] }], {
      cause: error,
    });
  }
}

function compileError(
  block: CodeBlock,
  parser: Parser,
  phase: CompilePhase,
  diagnostics: CompileDiagnostic[],
  options?: ErrorOptions,
): DdtCompileError {
  return new DdtCompileError(
    { block: block.details, parser: parserDetails(parser), phase, diagnostics },
    options,
  );
}

const PARSER_PACKAGES = {
  ts: "oxc-parser",
  js: "oxc-parser",
  tsx: "oxc-parser",
  jsx: "oxc-parser",
  tsrx: "@tsrx/oxc",
} as const satisfies Record<Parser, string>;

function parserDetails(name: Parser): ParserDetails {
  const pkg = PARSER_PACKAGES[name];
  return { name, package: pkg, version: requirePackageJson(`${pkg}/package.json`).version };
}

function toDiagnostic(block: CodeBlock, error: ParserError): CompileDiagnostic {
  const labels = error.labels.map((label) => ({
    ...(label.message ? { message: label.message } : {}),
    start: block.positionAt(label.start),
    end: block.positionAt(label.end),
  }));
  const help = error.helpMessage ? { help: error.helpMessage } : {};
  return { message: error.message, ...help, labels, source: error };
}

const nodeRequire = createRequire(import.meta.url);
const requireTsrxParser: (id: "@tsrx/oxc/parser") => typeof TsrxParser = nodeRequire;
const requirePackageJson: (id: string) => { version: string } = nodeRequire;
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

    return [{ type: "SyntheticDefault", declaration: decl }];
  }

  return [node];
}

function printBodyNode(source: string, node: BodyNode): string {
  if (node.type === "SyntheticDefault") {
    return `const ______default_that_does_not_conflict = ${sliceSource(source, node.declaration)};`;
  }

  return sliceSource(source, node);
}

type Range = { start: number; end: number };
function sliceSource(source: string, { start, end }: Range): string {
  return source.slice(start, end).trimEnd();
}
