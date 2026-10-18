import type { ImportBinding } from "../fences/parse.ts";
import type { ModuleSystem } from "./adapter.ts";
import { importStatement } from "./module-system.ts";

class Import {
  readonly #made = true;
  public readonly statement: string;
  public readonly locals: readonly string[];

  public constructor(statement: string, locals: readonly string[]) {
    this.statement = statement;
    this.locals = locals;
  }
}

/** Only `typedImports` builds one for users, so the statement and its names always agree */
export type StaticImport = Import;

export function staticImport(statement: string, ...locals: string[]): StaticImport {
  return new Import(statement, locals);
}

export function unshadowed(
  injected: readonly StaticImport[],
  taken: readonly string[],
): StaticImport[] {
  return injected.filter(({ locals }) => !locals.some((local) => taken.includes(local)));
}

/** Type-only bindings are erased, so they never clash with an injected import */
export function runtimeNames(bindings: readonly ImportBinding[]): string[] {
  return bindings.filter(({ kind }) => kind === "value").map(({ local }) => local);
}

type TypedImporter<Module> = (
  name: keyof Module,
  options?: { alias?: string; type?: ModuleSystem },
) => StaticImport;

/**
 * @example esm
 * ```ts run
 * import { typedImports } from "@ddtds/core";
 *
 * const importFromVitest = typedImports<typeof import("vitest")>("vitest");
 * expect(importFromVitest("test").statement).toBe("import { test } from 'vitest';");
 * ```
 *
 * @example cjs with alias
 * ```ts run
 * import { typedImports } from "@ddtds/core";
 *
 * const importFromAssert = typedImports<typeof import("node:assert")>("node:assert");
 * const { statement } = importFromAssert("strict", { alias: "assert", type: "cjs" });
 * expect(statement).toBe("const { strict: assert } = require('node:assert');");
 * ```
 */
export function typedImports<Module>(module: string): TypedImporter<Module> {
  return (name, { alias, type = "esm" } = {}) => {
    const imported = String(name);
    return staticImport(importStatement(type, module, imported, alias), alias ?? imported);
  };
}
