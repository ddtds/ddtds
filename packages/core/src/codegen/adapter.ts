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
  /** How a host appends fence tests to a source file it runs itself, when it does */
  inSource?: Readonly<{
    /** Statement placed before the tests that makes `test` available, per module kind */
    imports?(kind: "esm" | "cjs"): string;
    /** Expression for `test` inside the source file */
    test: string;
    /** Expression for `describe`, which loads fences inside the suite instead of up front */
    suite?: string;
    /** Wraps the generated tests so the host runs them only when it wants to */
    wrap(tests: string): string;
  }>;
}>;

/**
 * Typesafe `import { name } from 'module'`, or `import { name as local } from 'module'`
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
    (name: keyof Module, alias?: string): string =>
      `import { ${String(name)}${alias ? ` as ${alias}` : ""} } from '${module}';`;

export function runtimeImport(adapter: TestAdapter): string {
  return `import { runtime } from '${adapter.runtime}';`;
}
