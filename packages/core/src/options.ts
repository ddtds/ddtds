import type { StaticImport } from "./codegen/static-import.ts";
import type { LogLevel } from "./log-level.ts";

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
