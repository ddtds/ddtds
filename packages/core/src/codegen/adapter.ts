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
}>;

/**
 * Typesafe `import { names } from 'module'`
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
    (...names: (keyof Module)[]): string =>
      `import { ${names.join(", ")} } from '${module}';`;

export function runtimeImport(adapter: TestAdapter): string {
  return `import { runtime } from '${adapter.runtime}';`;
}
