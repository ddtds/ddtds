import type { LoadFnOutput, RegisterHooksOptions } from "node:module";
import { extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DdtSession, isSourceFile, sourceTests } from "@ddtds/core";
import { nodeTestAdapter } from "./adapter.ts";

// works with both built and source
const runtimeUrl = new URL(`./runtime${extname(import.meta.filename)}`, import.meta.url).href;

const moduleFormats = new Set(["module", "module-typescript"]);

export function ddtHooks(root: string): RegisterHooksOptions {
  const session = DdtSession.fromSources(nodeTestAdapter, new Map(), root);
  // node:test runs each test file in its own process, so the entry file is the one under test
  const entry = process.argv[1] === undefined ? undefined : resolve(root, process.argv[1]);

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

      // a source file only registers its fences when it is the test file itself; the files it
      // imports are loaded as usual
      if (isSourceFile(path) && path === entry) {
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

/** The loaded source with its fences registered as tests after its own code */
function withFenceTests(session: DdtSession, path: string, loaded: LoadFnOutput): LoadFnOutput {
  if (loaded.source === undefined || !moduleFormats.has(loaded.format ?? "")) return loaded;
  const source =
    typeof loaded.source === "string" ? loaded.source : new TextDecoder().decode(loaded.source);
  session.update(path, source);
  const fences = session.index.fencesOf(path);
  if (fences.length === 0) return loaded;
  const tests = sourceTests(nodeTestAdapter, fences, '(await import("node:test")).test');
  return { ...loaded, source: `${source}\n${tests}` };
}

function filePath(url: string): string | undefined {
  return URL.parse(url)?.protocol === "file:" ? fileURLToPath(url) : undefined;
}
