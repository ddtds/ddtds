import type { RegisterHooksOptions } from "node:module";
import { extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DdtSession } from "@ddtds/core";
import { nodeTestAdapter } from "./adapter.ts";

// works with both built and source
const runtimeUrl = new URL(`./runtime${extname(import.meta.filename)}`, import.meta.url).href;

export function ddtHooks(root: string): RegisterHooksOptions {
  const session = DdtSession.open(nodeTestAdapter, root);

  return {
    resolve(specifier, context, next) {
      // load ddtds runtime
      if (specifier === nodeTestAdapter.runtime) return { url: runtimeUrl, shortCircuit: true };
      // node's entry file runs as its doc module
      if (context.parentURL === undefined) {
        const entry = session.entry(fileURLToPath(new URL(specifier, pathToFileURL(root + "/"))));
        if (entry !== undefined) return { url: fileUrl(entry), shortCircuit: true };
      }
      // hand off to node if not a relevent fence
      if (!session.index.fence(specifier)) return next(specifier, context);
      // if its a fence, map to markdown source instead of passing to node resolver
      return { url: fileUrl(specifier), shortCircuit: true };
    },
    load(url, context, next) {
      const parsed = URL.parse(url);
      if (parsed?.protocol !== "file:") return next(url, context);
      const module = session.load(fileURLToPath(parsed) + parsed.search);
      if (!module) return next(url, context);

      return {
        format: "module-typescript",
        source: module.code,
        shortCircuit: true,
      };
    },
  };
}

function fileUrl(id: string): string {
  const [path = id, query] = id.split("?");
  const url = pathToFileURL(path);
  if (query !== undefined) url.search = query;
  return url.href;
}
