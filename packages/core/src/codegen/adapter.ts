import type { StaticImport } from "./imports.ts";

export type ModuleSystem = "esm" | "cjs";

/** Controls runtime function path and imports */
export type TestAdapter = Readonly<{
  /**
   * The runtime module reexport path, e.g. `"@ddtds/vitest/runtime"`. Runtime
   * functions are reexported in plugins so clients don't need to manage peers
   */
  runtime: string;
  /** Imports `test` for doc modules */
  testImport: StaticImport;
  /** Imports for fences, e.g. `expect` */
  fenceImports: readonly StaticImport[];
  /** Module system fence modules are written in. Defaults to `"esm"` */
  module?: ModuleSystem;
  forModule?: (module: ModuleSystem) => TestAdapter;
}>;
