import type { Annotation, Lang, Parser } from "../constants.ts";

/** An error as the parser reports it, with offsets into the fence's code. */
export type ParserError = {
  message: string;
  helpMessage: string | null;
  labels: { message: string | null; start: number; end: number }[];
};

/** A line and column in a file, 1 indexed unless the name says otherwise. */
export type Position = {
  /** 1 indexed line in the source markdown file */
  line: number;
  /** 1 indexed column in the source markdown file */
  column: number;
};

/** Where something starts and ends in a file. */
export type SourceRange = { start: Position; end: Position };

/** A span of a fence that a diagnostic points at. */
export type CompileLabel = { message?: string; start: Position; end: Position };

/** One problem found in a fence, with the spans it points at. */
export type CompileDiagnostic = {
  message: string;
  help?: string;
  labels: CompileLabel[];
  source?: ParserError;
};

/** A fence as errors and hosts see it, with its range in the file. */
export type BlockDetails = {
  file: string;
  lang: Lang;
  annotation: Annotation | null;
  range: SourceRange;
  contents: string;
};

/** The parser that read a fence. */
export type ParserDetails = { name: Parser; package: string; version: string };

/** Where compiling stopped: a syntax error, or a crash in the parser. */
export type CompilePhase = "parse" | "parser-crash";

/** Everything known about why a fence did not compile. */
export type CompileErrorDetails = {
  block: BlockDetails;
  parser: ParserDetails;
  phase: CompilePhase;
  diagnostics: CompileDiagnostic[];
};

/** Thrown when a fence does not compile, with `details` for hosts to report. */
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
