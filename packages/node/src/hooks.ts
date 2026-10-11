import { readFileSync } from "node:fs";
import type { RegisterHooksOptions } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DocIndex, docModule, fenceModule, type GeneratedModule } from "@ddtds/core";
import { createLogger, parseLogLevel } from "@ddtds/core/log";
import { nodeRunner } from "./runner.ts";

const docExtension = /\.mdx?$/;
/** Generated code finds the runtime even when the project's packages can't resolve it */
const runtimeUrl = import.meta.resolve("./runtime.ts");

/** Module hooks that turn markdown docs into node:test modules, in memory */
export function ddtHooks(root: string): RegisterHooksOptions {
  const logger = createLogger(parseLogLevel(process.env.DDT_LOG_LEVEL));
  let index = DocIndex.fromSources(new Map(), { root, moduleDir: join(root, "__ddtds__"), logger });

  return {
    resolve(specifier, context, next) {
      if (specifier === nodeRunner.runtime) return { url: runtimeUrl, shortCircuit: true };
      if (!index.fence(specifier)) return next(specifier, context);
      return { url: pathToFileURL(specifier).href, shortCircuit: true };
    },
    load(url, context, next) {
      if (!url.startsWith("file:")) return next(url, context);
      const path = fileURLToPath(url);
      if (docExtension.test(path)) {
        index = index.withDoc(path, readFileSync(path, "utf8"));
        const source = withMap(docModule(nodeRunner, path, index.fencesOf(path)));
        return { format: "module", source, shortCircuit: true };
      }
      const fence = index.fence(path);
      if (!fence) return next(url, context);
      const source = withMap(fenceModule(nodeRunner, fence));
      return { format: "module-typescript", source, shortCircuit: true };
    },
  };
}

/** Node maps stacks and test locations back to the markdown with an inline source map */
function withMap({ code, map }: GeneratedModule): string {
  return `${code}\n//# sourceMappingURL=${map.toUrl()}`;
}
