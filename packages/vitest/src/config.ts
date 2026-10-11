/**
 * Defaults for the plugin's options, named like the ones `vitest/config` exports for Vitest.
 * Import them as a namespace so they don't clash with Vitest's:
 * `import * as ddtConfig from "@ddtds/vitest/config"`.
 */
export {
  defaultDocsInclude as defaultInclude,
  defaultDocsExclude as defaultExclude,
  defaultOutDir,
} from "@ddtds/core";
