import { getLogger } from "@logtape/logtape";
import { moduleOfLang, moduleOfPath } from "../constants.ts";
import type { CodeBlock } from "../fences/blocks.ts";
import type { ModuleSystem } from "./adapter.ts";

const logger = getLogger(["ddtds", "module"]);

/**
 * The module system a fence is served as, from the first that names one:
 * 1. its language (`cjs`, `mts`), then the extension of the file holding it
 * 2. ESM syntax that survives type erasure, which cannot run as CommonJS
 * 3. `fallback`: the global default, else the nearest package.json `type`
 *
 * It is a hint: the test framework decides what to do with it.
 */
export function resolveModule(
  block: CodeBlock,
  { esmSyntax, fallback }: { esmSyntax: boolean; fallback: ModuleSystem },
): ModuleSystem {
  const where = `${block.details.file}:${block.line}`;
  const choose = (module: ModuleSystem, because: string): ModuleSystem => {
    logger.debug("{where}: {module} because {because}", { where, module, because });
    return module;
  };
  const fromLang = moduleOfLang(block.lang);
  if (fromLang) return choose(fromLang, `its language is "${block.lang}"`);
  const fromPath = moduleOfPath(block.details.file);
  if (fromPath) return choose(fromPath, `its file is "${block.details.file}"`);
  if (esmSyntax) return choose("esm", "it has import, export or import.meta");
  return choose(fallback, "of the default module system");
}
