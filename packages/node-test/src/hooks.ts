import { readFileSync } from "node:fs";
import { findPackageJSON, type RegisterHooksOptions } from "node:module";
import { extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DdtSession, type ModuleSystem } from "@ddtds/core";
import { nodeTestAdapter } from "./adapter.ts";

// works with both built and source
const runtimeUrl = new URL(`./runtime${extname(import.meta.filename)}`, import.meta.url).href;

export function ddtHooks(root: string): RegisterHooksOptions {
  const adapter = nodeTestAdapter(moduleSystem(root));
  const session = DdtSession.open(adapter, root);

  return {
    resolve(specifier, context, next) {
      // load ddtds runtime
      if (specifier === adapter.runtime) return { url: runtimeUrl, shortCircuit: true };
      // node's entry file runs as its doc module
      if (context.parentURL === undefined) {
        const entry = session.entry(fileURLToPath(new URL(specifier, pathToFileURL(root + "/"))));
        if (entry !== undefined) return { url: fileUrl(entry), shortCircuit: true };
      }
      const fence = session.resolve(specifier);
      if (fence === undefined) return next(specifier, context);
      return { url: fileUrl(fence), shortCircuit: true };
    },
    load(url, context, next) {
      const parsed = URL.parse(url);
      if (parsed?.protocol !== "file:") return next(url, context);
      const id = fileURLToPath(parsed) + parsed.search;
      const module = session.load(id);
      if (!module) return next(url, context);

      // doc modules always import; fence modules follow the package's module system
      const commonjs = adapter.module === "cjs" && !session.isEntry(id);
      return {
        format: commonjs ? "commonjs-typescript" : "module-typescript",
        source: module.code,
        shortCircuit: true,
      };
    },
  };
}

/** Node reads `type` from the closest package.json to pick CommonJS or ESM */
function moduleSystem(root: string): ModuleSystem {
  const path = findPackageJSON(pathToFileURL(root + "/").href);
  if (path === undefined) return "esm";
  const pkg: unknown = JSON.parse(readFileSync(path, "utf8"));
  const commonjs =
    typeof pkg === "object" && pkg !== null && "type" in pkg && pkg.type === "commonjs";
  return commonjs ? "cjs" : "esm";
}

function fileUrl(id: string): string {
  const [path = id, query] = id.split("?");
  const url = pathToFileURL(path);
  if (query !== undefined) url.search = query;
  return url.href;
}
