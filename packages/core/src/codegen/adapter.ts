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
   * @example
   * ```ts run
   * import { renderImport, typedImports } from "@ddtds/core";
   *
   * const importFromVitest = typedImports<typeof import("vitest")>("vitest");
   * expect(renderImport(importFromVitest("test"), "esm")).toBe("import { test } from 'vitest';");
   * ```
   */
  testImport: StaticImport;
  /** Imports for fences, e.g. `expect`
   *
   * @example
   * ```ts run
   * import { renderImport, typedImports } from "@ddtds/core";
   *
   * const importFromVitest = typedImports<typeof import("vitest")>("vitest");
   * expect(renderImport(importFromVitest("expect"), "esm")).toBe("import { expect } from 'vitest';");
   * ```
   */
  fenceImports: readonly StaticImport[];
  /** Module system fence modules are written in. Defaults to `"esm"` */
  module?: ModuleSystem;
  forModule?: (module: ModuleSystem) => TestAdapter;
}>;
