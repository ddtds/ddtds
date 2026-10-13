import { readFileSync } from "node:fs";
import type { RegisterHooksOptions } from "node:module";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DocIndex, docModule, fenceModule } from "@ddtds/core";
import { nodeTestAdapter } from "./adapter.ts";

const docExtension = /\.mdx?$/;
const runtimeUrl = new URL(`./runtime${extname(import.meta.filename)}`, import.meta.url).href;

export function ddtHooks(root: string): RegisterHooksOptions {
  let index = DocIndex.fromSources(new Map(), { root, moduleDir: join(root, "__ddtds__") });

  return {
    resolve(specifier, context, next) {
      if (specifier === nodeTestAdapter.runtime) return { url: runtimeUrl, shortCircuit: true };
      if (!index.fence(specifier)) return next(specifier, context);
      return { url: pathToFileURL(specifier).href, shortCircuit: true };
    },
    load(url, context, next) {
      if (!url.startsWith("file:")) return next(url, context);
      const path = fileURLToPath(url);
      if (docExtension.test(path)) {
        index = index.withDoc(path, readFileSync(path, "utf8"));
        const { code } = docModule(nodeTestAdapter, path, index.fencesOf(path), {
          source: index.sourceOf(path),
        });
        return { format: "module", source: code, shortCircuit: true };
      }
      const fence = index.fence(path);
      if (!fence) return next(url, context);
      const { code } = fenceModule(nodeTestAdapter, fence, index.sourceOf(fence.doc));
      return { format: "module-typescript", source: code, shortCircuit: true };
    },
  };
}
