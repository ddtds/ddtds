export type ModuleSystem = "esm" | "cjs";

/** Controls runtime function path and imports */
export type TestAdapter = Readonly<{
  /**
   * The runtime module reexport path, e.g. `"@ddtds/vitest/runtime"`. Runtime
   * functions are reexported in plugins so clients don't need to manage peers
   */
  runtime: string;
  /** Imports `test` for doc modules
   *
   * @example typesafe
   * ```ts
   * const importFromVitest = typedImports<typeof import("vitest")>("vitest");
   * const statement = importFromVitest("test");
   * ```
   *
   * @example raw string
   * ```ts
   * "import { test } from 'vitest'"
   * ```
   */
  testImport: string;
  /** Imports for fences, e.g. `expect`
   *
   * @example typesafe
   * ```ts
   * const importFromVitest = typedImports<typeof import("vitest")>("vitest");
   * const statement = importFromVitest("expect");
   * ```
   *
   * @example raw string
   * ```ts
   * ["import { expect } from 'vitest'"]
   * ```
   */
  fenceImports: readonly string[];
  /** Module system fence modules are written in. Defaults to `"esm"` */
  module?: ModuleSystem;
}>;

const importers: Record<ModuleSystem, (module: string, name: string, alias?: string) => string> = {
  esm: (module, name, alias) =>
    `import { ${name}${alias ? ` as ${alias}` : ""} } from '${module}';`,
  cjs: (module, name, alias) =>
    `const { ${name}${alias ? `: ${alias}` : ""} } = require('${module}');`,
};

/**
 * @example esm
 * ```ts
 * const importFromVitest = typedImports<typeof import("vitest")>("vitest");
 * expect(importFromVitest("test")).toBe("import { test } from 'vitest';");
 * ```
 *
 * @example cjs with alias
 * ```ts
 * const importFromAssert = typedImports<typeof import("node:assert")>("node:assert");
 * const statement = importFromAssert("strict", { alias: "assert", type: "cjs" });
 * expect(statement).toBe("const { strict: assert } = require('node:assert');");
 * ```
 */
export const typedImports =
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters this is fine and needed to make the function type safe
  <Module>(module: string) =>
    (
      name: keyof Module,
      { alias, type = "esm" }: { alias?: string; type?: ModuleSystem } = {},
    ): string =>
      importers[type](module, String(name), alias);

/** Doc modules always `import`; fence modules follow the adapter's module system */
export function runtimeImport(
  adapter: TestAdapter,
  system: ModuleSystem = adapter.module ?? "esm",
): string {
  return importers[system](adapter.runtime, "runtime");
}
