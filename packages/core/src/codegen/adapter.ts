import type { StaticImport } from "./static-import.ts";

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
   * ```ts run
   * import { typedImports } from "@ddtds/core";
   *
   * const importFromVitest = typedImports<typeof import("vitest")>("vitest");
   * const testImport = importFromVitest("test");
   * expect(testImport.locals).toEqual(["test"]);
   * ```
   *
   * @example raw
   * ```ts run
   * import { staticImport } from "@ddtds/core";
   *
   * const testImport = staticImport("import { test } from 'vitest'", "test");
   * expect(testImport.locals).toEqual(["test"]);
   * ```
   */
  testImport: StaticImport;
  /** Imports for fences, e.g. `expect`
   *
   * @example typesafe
   * ```ts run
   * import { typedImports } from "@ddtds/core";
   *
   * const importFromVitest = typedImports<typeof import("vitest")>("vitest");
   * const fenceImport = importFromVitest("expect");
   * expect(fenceImport.locals).toEqual(["expect"]);
   * ```
   *
   * @example raw
   * ```ts run
   * import { staticImport } from "@ddtds/core";
   *
   * const fenceImports = [staticImport("import { expect } from 'vitest'", "expect")];
   * expect(fenceImports[0]?.locals).toEqual(["expect"]);
   * ```
   */
  fenceImports: readonly StaticImport[];
  /** Module system fence modules are written in. Defaults to `"esm"` */
  module?: ModuleSystem;
  forModule?: (module: ModuleSystem) => TestAdapter;
}>;
