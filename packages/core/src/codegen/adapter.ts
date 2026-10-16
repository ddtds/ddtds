export type ModuleSystem = "import" | "require";

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
  /** Imports for fences, e.g. `expect`, per module system
   *
   * @example typesafe
   * ```ts
   * const importFromVitest = typedImports<typeof import("vitest")>("vitest");
   * const statement = importFromVitest("expect");
   * ```
   *
   * @example raw string
   * ```ts
   * { import: ["import { expect } from 'vitest'"] }
   * ```
   */
  fenceImports: Readonly<{ import: readonly string[]; require?: readonly string[] }>;
  /** How fence modules load their imports: ESM `import` or CommonJS `require` */
  moduleType: ModuleSystem;
}>;

type ImportSpec = Readonly<{ module: string; name: string; alias?: string }>;

const formatters: Record<ModuleSystem, (spec: ImportSpec) => string> = {
  import: ({ module, name, alias }) =>
    `import { ${name}${alias ? ` as ${alias}` : ""} } from '${module}';`,
  require: ({ module, name, alias }) =>
    `const { ${name}${alias ? `: ${alias}` : ""} } = require('${module}');`,
};

/**
 * Typesafe `import { name } from 'module'`, or `import { name as local } from 'module'`. With
 * `type: "require"`, `const { name } = require('module')`
 *
 * @example
 * ```ts
 * const importFromVitest = typedImports<typeof import("vitest")>("vitest");
 * const statement = importFromVitest("test");
 * expect(statement).toBe("import { test } from 'vitest';");
 * ```
 */
export const typedImports =
  // oxlint-disable-next-line typescript/no-unnecessary-type-parameters this is fine and needed to make the function type safe
  <Module>(module: string) =>
    (
      name: keyof Module,
      { alias, type = "import" }: { alias?: string; type?: ModuleSystem } = {},
    ): string =>
      formatters[type]({ module, name: String(name), alias });

export function runtimeImport(adapter: TestAdapter, system: ModuleSystem): string {
  return formatters[system]({ module: adapter.runtime, name: "runtime" });
}
