import { brand, type Brand } from "../brand.ts";
import type { ImportBinding } from "../fences/parse.ts";
import type { ModuleSystem } from "./adapter.ts";
import { importStatement } from "./module-system.ts";

/** Only `typedImports` builds one for users, so the module and its names always agree */
export type StaticImport = Brand<
  Readonly<{ module: string; name: string; alias?: string }>,
  "StaticImport"
>;

export function staticImport(module: string, name: string, alias?: string): StaticImport {
  return brand<StaticImport>(alias === undefined ? { module, name } : { module, name, alias });
}

export function localName({ name, alias }: StaticImport): string {
  return alias ?? name;
}

export function renderImport({ module, name, alias }: StaticImport, system: ModuleSystem): string {
  return importStatement(system, module, name, alias);
}

export function unshadowed(
  injected: readonly StaticImport[],
  taken: readonly string[],
): StaticImport[] {
  return injected.filter((staticImport) => !taken.includes(localName(staticImport)));
}

/** Type-only bindings are erased, so they never clash with an injected import */
export function runtimeNames(bindings: readonly ImportBinding[]): string[] {
  return bindings.filter(({ kind }) => kind === "value").map(({ local }) => local);
}

type TypedImporter<Module> = (name: keyof Module, options?: { alias?: string }) => StaticImport;

/**
 * @example esm
 * ```ts run
 * import { renderImport, typedImports } from "@ddtds/core";
 *
 * const importFromVitest = typedImports<typeof import("vitest")>("vitest");
 * expect(renderImport(importFromVitest("test"), "esm")).toBe("import { test } from 'vitest';");
 * ```
 *
 * @example cjs with alias
 * ```ts run
 * import { renderImport, typedImports } from "@ddtds/core";
 *
 * const importFromAssert = typedImports<typeof import("node:assert")>("node:assert");
 * const strict = importFromAssert("strict", { alias: "assert" });
 * expect(renderImport(strict, "cjs")).toBe("const { strict: assert } = require('node:assert');");
 * ```
 */
export function typedImports<Module>(module: string): TypedImporter<Module> {
  return (name, { alias } = {}) => staticImport(module, String(name), alias);
}
