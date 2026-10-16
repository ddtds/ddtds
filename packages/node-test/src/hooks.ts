import type { LoadFnOutput, RegisterHooksOptions } from "node:module";
import { extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DdtSession, isSourceFile } from "@ddtds/core";
import { nodeTestAdapter } from "./adapter.ts";

// works with both built and source
const runtimeUrl = new URL(`./runtime${extname(import.meta.filename)}`, import.meta.url).href;

export function ddtHooks(root: string, entry?: string): RegisterHooksOptions {
  const session = DdtSession.fromSources(nodeTestAdapter, new Map(), root);
  const entryPath = entry === undefined ? undefined : resolve(root, entry);

  return {
    resolve(specifier, context, next) {
      // load ddtds runtime
      if (specifier === nodeTestAdapter.runtime) return { url: runtimeUrl, shortCircuit: true };
      // hand off to node if not a relevent fence
      if (!session.index.fence(specifier)) return next(specifier, context);
      // if its a fence, map to markdown source instead of passing to node resolver
      return { url: pathToFileURL(specifier).href, shortCircuit: true };
    },
    load(url, context, next) {
      const path = filePath(url);
      // ignore if not a file
      if (path === undefined) return next(url, context);

      if (isSourceFile(path) && path === entryPath) {
        return withFenceTests(session, path, next(url, context));
      }

      // load or reload doc
      session.refresh(path);
      const module = session.module(path);
      if (!module) return next(url, context);

      return {
        format: "module-typescript",
        source: module.code,
        shortCircuit: true,
      };
    },
  };
}

function withFenceTests(session: DdtSession, path: string, loaded: LoadFnOutput): LoadFnOutput {
  if (!loaded.format || !loaded.source) return loaded;
  const source = session.withSourceTests(path, sourceText(loaded.source));
  return source === undefined ? loaded : { ...loaded, source };
}

function sourceText(source: string | ArrayBuffer | NodeJS.ArrayBufferView): string {
  return typeof source === "string" ? source : new TextDecoder().decode(source);
}

function filePath(url: string): string | undefined {
  return URL.parse(url)?.protocol === "file:" ? fileURLToPath(url) : undefined;
}
