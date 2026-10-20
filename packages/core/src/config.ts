import { brand, type Brand } from "./brand.ts";
import { DOC_GLOB } from "./fences/doc-kinds.ts";
import type { LogLevel } from "./log-level.ts";

/**
 * Only `typedImports` builds one for users, so the module and its names always agree
 *
 * @example
 * ```ts run
 * import { typedImports, type StaticImport } from "@ddtds/core/config";
 *
 * const importFromPath = typedImports<typeof import("node:path")>("node:path");
 * const basename: StaticImport = importFromPath("basename");
 * expect(basename).toEqual({ module: "node:path", name: "basename" });
 * ```
 */
export type StaticImport = Brand<
  Readonly<{ module: string; name: string; alias?: string }>,
  "StaticImport"
>;

type TypedImporter<Module> = (name: keyof Module, options?: { alias?: string }) => StaticImport;

export function typedImports<Module>(module: string): TypedImporter<Module> {
  return (name, { alias } = {}) => {
    const imported =
      alias === undefined ? { module, name: String(name) } : { module, name: String(name), alias };
    return brand<StaticImport>(imported);
  };
}

/** Markdown docs, and source files whose JSDoc comments hold code fences */
export const defaultDocsInclude: string[] = [DOC_GLOB];
export const defaultDocsExclude: string[] = [
  "**/node_modules/**",
  "**/CHANGELOG.md",
  "**/dist/**",
  "**/*.d.ts",
  "**/*.d.mts",
  "**/*.d.cts",
  "**/__ddtds__/**",
];

export type DocsOptions = {
  /** Globs of docs to test, relative to the root. Defaults to `defaultDocsInclude` when unset or empty. */
  include?: string[];
  /** Globs of docs to skip, relative to the root. Replaces `defaultDocsExclude` unless unset or empty. */
  exclude?: string[];
};

export type DocsConfig = DocsOptions & {
  /** Directory that `include` and `exclude` are relative to. */
  root: string;
};

export type DdtOptions = {
  /**
   * Precedence (highest to lowest):
   *   1. `DDT_LOG_LEVEL` environment variable
   *   2. `logLevel` option
   *   3. `"info"` (default)
   */
  logLevel?: LogLevel;
  globals?: readonly StaticImport[];
};
