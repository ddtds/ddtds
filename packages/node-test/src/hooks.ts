import { readFileSync } from "node:fs";
import { findPackageJSON, setSourceMapsSupport, type RegisterHooksOptions } from "node:module";
import { extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DdtSession, resolveLogLevel, type ModuleSystem, type StaticImport } from "@ddtds/core";
import { configureSync, getLogger } from "@logtape/logtape";
import { defaultGlobals, nodeTestAdapter } from "./adapter.ts";

// works with both built and source
const runtimeUrl = new URL(`./runtime${extname(import.meta.filename)}`, import.meta.url).href;

const logger = getLogger(["ddtds", "hooks"]);

function configureLogging(): void {
  if (process.env.DDT_LOG_LEVEL === undefined) return;
  configureSync({
    reset: true,
    sinks: {
      stderr: (record) =>
        process.stderr.write(`ddtds ${record.level}: ${record.message.join("")}\n`),
    },
    loggers: [
      { category: ["ddtds"], lowestLevel: resolveLogLevel(), sinks: ["stderr"] },
      { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["stderr"] },
    ],
  });
}

export type HookOptions = {
  module?: ModuleSystem;
  globals?: readonly StaticImport[];
};

export function ddtHooks(root: string, options: HookOptions = {}): RegisterHooksOptions {
  setSourceMapsSupport(true);
  configureLogging();
  const adapter = nodeTestAdapter(defaultModule(root, options), options.globals ?? defaultGlobals);
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

      const commonjs = module.module === "cjs" && !session.isEntry(id);
      return {
        format: commonjs ? "commonjs-typescript" : "module-typescript",
        source: `${module.code}\n//# sourceMappingURL=${module.map.toUrl()}`,
        shortCircuit: true,
      };
    },
  };
}

function defaultModule(root: string, options: HookOptions): ModuleSystem {
  const [module, from]: [ModuleSystem, string] = options.module
    ? [options.module, "the module option"]
    : [moduleSystem(root), "the nearest package.json type"];
  logger.debug("default module system is {module} from {from}", { module, from });
  return module;
}

/** Node reads `type` from the closest package.json to pick CommonJS or ESM */
function moduleSystem(root: string): ModuleSystem {
  const path = findPackageJSON(pathToFileURL(root + "/").href);
  if (path === undefined || !path.endsWith("package.json")) return "esm";
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
