import { Bundle, MagicString, SourceMap, type SourceMapSegment } from "magic-string";
import { DdtCompileError, type CodeBlock, type DocIndex, type Fence } from "@ddtds/core";

type DdtVitestExports = keyof typeof import("./index.ts");

function ddtImport(...names: readonly DdtVitestExports[]): string {
  return `import { ${names.join(", ")} } from '@ddtds/vitest';`;
}

/** Generated text, or a piece of the fence's code that maps back to the markdown */
type Piece = string | MagicString;
type FenceCode = { imports: Piece[]; body: Piece[] };
export type GeneratedModule = { code: string; map: SourceMap };

function compileErrorCode(error: DdtCompileError): FenceCode {
  const cause =
    error.cause === undefined ? "" : `, { cause: ${JSON.stringify(serializeCause(error.cause))} }`;
  const body = `throw new DdtCompileError(${JSON.stringify(error.details)}${cause});`;
  return { imports: [ddtImport("DdtCompileError")], body: [body] };
}

function serializeCause(cause: unknown): unknown {
  if (!(cause instanceof Error)) return cause;
  const code = "code" in cause ? { code: cause.code } : {};
  return { name: cause.name, message: cause.message, ...code };
}

function compiledCode(): FenceCode {
  return {
    imports: [],
    body: ['throw new Error("expected a compile_fail block to fail to compile");'],
  };
}

function indent(piece: Piece): Piece {
  if (piece instanceof MagicString) return piece.indent("  ");
  return piece
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function blockCode(block: CodeBlock): FenceCode {
  const { imports, body } = block.splitImports();
  if (!block.shouldFail()) return { imports, body };
  const rejects = ["await expect(async () => {", ...body.map(indent), "}).rejects.toThrow();"];
  return { imports, body: rejects };
}

function fenceCode({ block }: Fence): FenceCode {
  try {
    const code = blockCode(block);
    return block.shouldFailToCompile() ? compiledCode() : code;
  } catch (error) {
    if (!(error instanceof DdtCompileError)) throw error;
    if (block.shouldFailToCompile() && error.details.phase === "parse") {
      return { imports: [], body: [] };
    }
    return compileErrorCode(error);
  }
}

/** Shift a map of the fence's code to where that code sits in the markdown */
function shiftToFence(mappings: SourceMapSegment[][], { block }: Fence): SourceMapSegment[][] {
  const { line, details } = block;
  return mappings.map((segments) =>
    segments.map((segment) => {
      if (segment.length === 1) return segment;
      const [column, source, sourceLine, sourceColumn] = segment;
      return [column, source, sourceLine + line, sourceColumn + details.indent];
    }),
  );
}

export function fenceModule(fence: Fence): GeneratedModule {
  const { imports, body } = fenceCode(fence);
  const pieces = [
    "import { expect } from 'vitest';",
    ...imports,
    ...(body.length === 0
      ? ["export default async function () {}"]
      : ["export default async function () {", ...body.map(indent), "}"]),
  ];
  const bundle = new Bundle({ separator: "\n" });
  for (const piece of pieces) {
    if (typeof piece === "string") bundle.addSource(new MagicString(piece));
    else bundle.addSource({ filename: fence.doc, content: piece });
  }
  const { mappings } = bundle.generateDecodedMap({ hires: true });
  const map = new SourceMap({
    sources: [fence.doc],
    names: [],
    mappings: shiftToFence(mappings, fence),
  });
  return { code: bundle.toString(), map };
}

export function docModule(fences: readonly Fence[]): GeneratedModule {
  const lines = [
    "import { test } from 'vitest';",
    "const fences = await Promise.all([",
    ...fences.map(
      ({ id }) =>
        `  import(${JSON.stringify(id)}).then(\n    ({ default: run }) => run,\n    (error) => () => {\n      throw error;\n    },\n  ),`,
    ),
    "]);",
  ].flatMap((line) => line.split("\n"));
  const mappings: SourceMapSegment[][] = lines.map(() => []);
  for (const [i, { block }] of fences.entries()) {
    const name = JSON.stringify(`${block.details.file}:${block.line}`);
    lines.push(`test(${name}, fences[${i}]);`);
    // Vitest locates a test where test() is called, so point the call at its fence
    mappings.push([[0, 0, block.line - 1, block.details.indent]]);
  }
  const sources = fences.map(({ doc }) => doc).slice(0, 1);
  return { code: lines.join("\n"), map: new SourceMap({ sources, names: [], mappings }) };
}

export function moduleFiles(index: DocIndex): Map<string, string> {
  const files = new Map<string, string>();
  for (const [doc, fences] of index.docs()) {
    for (const fence of fences) files.set(fence.id, fenceModule(fence).code);
    files.set(index.docModuleId(doc), docModule(fences).code);
  }
  return files;
}
