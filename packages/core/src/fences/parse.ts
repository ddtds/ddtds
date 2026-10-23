import { createRequire } from "node:module";
import { MagicString } from "magic-string";
import { parseSync, rawTransferSupported } from "oxc-parser";
import type * as TsrxParser from "@tsrx/oxc/parser";
import type { ExportDefaultDeclarationKind, Program } from "@oxc-project/types";
import { parserOf } from "../language-registry.ts";
import type { Lang, Parser } from "../languages.ts";
import {
  DdtCompileError,
  type BlockDetails,
  type CompileDiagnostic,
  type CompilePhase,
  type ParserDetails,
  type ParserError,
  type Position,
} from "./compile-error.ts";

export type ParseableBlock = {
  readonly code: string;
  readonly lang: Lang;
  readonly details: BlockDetails;
  positionAt(offset: number): Position;
};

type ParsedBodyNode = Program["body"][number];
type SyntheticDefaultNode = {
  kind: "synthetic-default";
  declaration: ExportDefaultDeclarationKind;
};
type BodyNode = ParsedBodyNode | SyntheticDefaultNode;

export type PreparedBlock = {
  imports: MagicString[];
  bindings: ImportBinding[];
  body: MagicString[];
  syntax: ModuleSyntax;
};

export function splitImportsAndBlock(block: ParseableBlock): PreparedBlock {
  const { program, staticImports, syntax } = parse(block);
  const source = new MagicString(block.code);

  const imports = staticImports.map((staticImport) => sliceSource(source, staticImport));
  const body = sanitizeProgram(program).map((node) => printBodyNode(source, node));

  return { imports, bindings: bindingsOf(staticImports), body, syntax };
}

/** "ambiguous" is not clearly ESM, will use other signals to decide how to run it */
export type ModuleSyntax = "esm" | "ambiguous";

export type ImportBinding = { local: string; kind: "type" | "value" };

type ParsedImport = Range & {
  entries: readonly { isType: boolean; localName: { value: string } }[];
};

function bindingsOf(staticImports: readonly ParsedImport[]): ImportBinding[] {
  return staticImports.flatMap(({ entries }) =>
    entries.map(({ isType, localName }) => ({
      local: localName.value,
      kind: isType ? "type" : "value",
    })),
  );
}

type ParsedBlock = { program: Program; staticImports: ParsedImport[]; syntax: ModuleSyntax };

function parse(block: ParseableBlock): ParsedBlock {
  const parser = parserOf(block.lang);
  const { program, module, errors } = runParser(block, parser);
  if (errors.length > 0 || !program || !module) {
    throw compileError(
      block,
      parser,
      "parse",
      errors.map((error) => toDiagnostic(block, error)),
    );
  }
  return { program, staticImports: module.staticImports, syntax: syntaxOf(module) };
}

type Statement = { entries: readonly { isType: boolean }[] };
type ModuleRecord = {
  staticImports: readonly Statement[];
  staticExports: readonly Statement[];
  importMetas: readonly unknown[];
};

const survives = ({ entries }: Statement): boolean =>
  entries.length === 0 || entries.some((entry) => !entry.isType);

function syntaxOf({ staticImports, staticExports, importMetas }: ModuleRecord): ModuleSyntax {
  const isEsm =
    staticImports.some(survives) || staticExports.some(survives) || importMetas.length > 0;
  return isEsm ? "esm" : "ambiguous";
}

type ParseResult = ReturnType<typeof parseSync> | ReturnType<typeof TsrxParser.parseSync>;

// reads the AST from shared memory instead of JSON; spread since oxc's types omit it
const rawTransfer = { experimentalRawTransfer: rawTransferSupported() };

function runParser(block: ParseableBlock, parser: Parser): ParseResult {
  const filename = `block.${parser}`;
  const options = { sourceType: "module", showSemanticErrors: true } as const;
  if (parser !== "tsrx") {
    return parseSync(filename, block.code, { ...options, lang: parser, ...rawTransfer });
  }

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
  block: ParseableBlock,
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

function toDiagnostic(block: ParseableBlock, error: ParserError): CompileDiagnostic {
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

    // An anonymous function or class is only valid as an expression
    if ((decl.type === "FunctionDeclaration" || decl.type === "ClassDeclaration") && decl.id) {
      return [decl];
    }

    return [{ kind: "synthetic-default", declaration: decl }];
  }

  return [node];
}

function printBodyNode(source: MagicString, node: BodyNode): MagicString {
  if ("kind" in node && node.kind === "synthetic-default") {
    return sliceSource(source, node.declaration)
      .prepend("const ______default_that_does_not_conflict = ")
      .append(";");
  }

  return sliceSource(source, node);
}

type Range = { start: number; end: number };
function sliceSource(source: MagicString, { start, end }: Range): MagicString {
  const trimmed = source.original.slice(start, end).trimEnd();
  return source.snip(start, start + trimmed.length);
}
