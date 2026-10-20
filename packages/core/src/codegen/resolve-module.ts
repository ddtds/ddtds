import { getLogger } from "@logtape/logtape";
import { moduleOfLang, moduleOfPath } from "../language-registry.ts";
import type { CodeBlock } from "../fences/blocks.ts";
import type { ModuleSyntax } from "../fences/parse.ts";
import type { ModuleSystem } from "./adapter.ts";

const logger = getLogger(["ddtds", "module"]);

export function resolveModule(
  block: CodeBlock,
  { syntax, fallback }: { syntax: ModuleSyntax; fallback: ModuleSystem },
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
  if (syntax === "esm") return choose("esm", "it has import, export or import.meta");
  return choose(fallback, "of the default module system");
}
