import type { RegisterHooksOptions } from "node:module";
import { extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DdtSession } from "@ddtds/core";
import { nodeTestAdapter } from "./adapter.ts";

const runtimeUrl = new URL(`./runtime${extname(import.meta.filename)}`, import.meta.url).href;

export function ddtHooks(root: string): RegisterHooksOptions {
  const session = DdtSession.fromSources(nodeTestAdapter, new Map(), root);

  return {
    resolve(specifier, context, next) {
      if (specifier === nodeTestAdapter.runtime) return { url: runtimeUrl, shortCircuit: true };
      if (!session.index.fence(specifier)) return next(specifier, context);
      return { url: pathToFileURL(specifier).href, shortCircuit: true };
    },
    load(url, context, next) {
      const path = filePath(url);
      if (path === undefined) return next(url, context);
      session.refresh(path);
      const module = session.module(path);
      if (!module) return next(url, context);
      return {
        format: session.index.hasDoc(path) ? "module" : "module-typescript",
        source: module.code,
        shortCircuit: true,
      };
    },
  };
}

function filePath(url: string): string | undefined {
  return URL.parse(url)?.protocol === "file:" ? fileURLToPath(url) : undefined;
}
