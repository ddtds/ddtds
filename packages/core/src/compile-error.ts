import type { Annotation, Lang, Parser } from "./constants.ts";

export type ParserError = {
  message: string;
  helpMessage: string | null;
  labels: { message: string | null; start: number; end: number }[];
};

export type Position = {
  /** 1 indexed line in the source markdown file */
  line: number;
  /** 1 indexed column in the source markdown file */
  column: number;
};

export type SourceRange = { start: Position; end: Position };

export type CompileLabel = { message?: string; start: Position; end: Position };

export type CompileDiagnostic = {
  message: string;
  help?: string;
  labels: CompileLabel[];
  source?: ParserError;
};

export type BlockDetails = {
  file: string;
  lang: Lang;
  annotation: Annotation | null;
  range: SourceRange;
  indent: number;
  contents: string;
};

export type ParserDetails = { name: Parser; package: string; version: string };

export type CompilePhase = "parse" | "parser-crash" | "imports";

export type CompileErrorDetails = {
  block: BlockDetails;
  parser: ParserDetails;
  phase: CompilePhase;
  diagnostics: CompileDiagnostic[];
};

export class DdtCompileError extends Error {
  public readonly details: CompileErrorDetails;

  public constructor(details: CompileErrorDetails, options?: ErrorOptions) {
    super(
      details.diagnostics.map((diagnostic) => renderDiagnostic(details, diagnostic)).join("\n\n"),
      options,
    );
    this.name = "DdtCompileError";
    this.details = details;
  }
}

function renderDiagnostic({ block }: CompileErrorDetails, diagnostic: CompileDiagnostic): string {
  const fenceLine = block.range.start.line;
  const start = diagnostic.labels[0]?.start;
  const where = start
    ? `${block.file}:${start.line}:${start.column}`
    : `${block.file}:${fenceLine}`;
  const header = `${where} ${diagnostic.message} (${block.lang} block at line ${fenceLine})`;
  const help = diagnostic.help ? [`help: ${diagnostic.help}`] : [];
  return [header, ...help].join("\n");
}
