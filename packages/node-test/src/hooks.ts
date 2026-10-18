import { readFileSync } from "node:fs";
import { findPackageJSON, setSourceMapsSupport, type RegisterHooksOptions } from "node:module";
import { extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DdtSession, resolveLogLevel, type ModuleSystem, type TestAdapter } from "@ddtds/core";
import { configureSync, getLogger } from "@logtape/logtape";
import { nodeTestAdapter } from "./adapter.ts";

/** How a test runner differs from `node:test` for the hooks */
export type HookRunner = {
  adapter(module: ModuleSystem): TestAdapter;
  /** Where the adapter's runtime module is served from */
  runtimeUrl: string;
  /** Whether the runner itself, not user code, loads a spec from `parentURL` */
  loadsSpec(parentURL: string | undefined): boolean;
  /** Whether the runner fails on a spec that is not JavaScript, so a fenceless doc needs a stand-in */
  scriptOnly?: boolean;
  /** Source of a stand-in spec that reports a doc ddtds cannot parse, so one bad doc does not abort the run */
  brokenDoc?(path: string, message: string): string;
};

// works with both built and source
const runtimeUrl = new URL(`./runtime${extname(import.meta.filename)}`, import.meta.url).href;

/** `node --test` runs each spec as the entry file of its own process */
const nodeTestRunner: HookRunner = {
  adapter: nodeTestAdapter,
  runtimeUrl,
  loadsSpec: (parentURL) => parentURL === undefined,
};

const logger = getLogger(["ddtds", "hooks"]);

/** Debug logs go to stderr, and only when DDT_LOG_LEVEL asks for them */
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

const requireMessage = "ddtds loads docs with import(), not require()";

export type HookOptions = {
  /** Module system for fences that name none, instead of the closest package.json `type` */
  module?: ModuleSystem;
};

export function ddtHooks(
  root: string,
  runner: HookRunner = nodeTestRunner,
  options: HookOptions = {},
): RegisterHooksOptions {
  setSourceMapsSupport(true);
  configureLogging();
  const adapter = runner.adapter(defaultModule(root, options));
  const session = DdtSession.open(adapter, root);

  return {
    resolve(specifier, context, next) {
      // load ddtds runtime
      if (specifier === adapter.runtime) return { url: runner.runtimeUrl, shortCircuit: true };
      // the runner's spec file runs as its doc module
      if (runner.loadsSpec(context.parentURL) && /^(\.{0,2}\/|file:)/.test(specifier)) {
        const path = fileURLToPath(
          new URL(specifier, context.parentURL ?? pathToFileURL(root + "/")),
        );
        let entry: string | undefined;
        let failure: unknown;
        try {
          entry = session.entry(path);
        } catch (error) {
          if (runner.brokenDoc === undefined) throw error;
          failure = error;
        }
        // an entry differs from its doc only by a query, which `require` drops, so `import` it
        const isDoc = entry !== undefined || failure !== undefined || /\.mdx?$/.test(path);
        if (isDoc && context.conditions.includes("require")) throw new Error(requireMessage);
        if (failure !== undefined && runner.brokenDoc !== undefined) {
          const message = failure instanceof Error ? failure.message : JSON.stringify(failure);
          const source = encodeURIComponent(runner.brokenDoc(path, message));
          return { url: `data:text/javascript,${source}`, shortCircuit: true };
        }
        if (entry !== undefined) return { url: fileUrl(entry), shortCircuit: true };
        if (isDoc && runner.scriptOnly) return { url: "data:text/javascript,", shortCircuit: true };
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

      // doc modules always import; a fence module follows its own module system
      const commonjs = module.module === "cjs" && !session.isEntry(id);
      return {
        format: commonjs ? "commonjs-typescript" : "module-typescript",
        source: `${module.code}\n//# sourceMappingURL=${module.map.toUrl()}`,
        shortCircuit: true,
      };
    },
  };
}

/** The module system for fences that name none, and what chose it */
function defaultModule(root: string, options: HookOptions): ModuleSystem {
  const fromEnv = moduleFromEnv();
  const [module, from]: [ModuleSystem, string] = options.module
    ? [options.module, "the module option"]
    : fromEnv
      ? [fromEnv, "DDTDS_MODULE"]
      : [moduleSystem(root), "the nearest package.json type"];
  logger.debug("default module system is {module} from {from}", { module, from });
  return module;
}

/** `DDTDS_MODULE=esm|cjs` sets the default module system where `register` cannot take options */
function moduleFromEnv(): ModuleSystem | undefined {
  const value = process.env.DDTDS_MODULE;
  if (value === undefined || value === "") return undefined;
  if (value === "esm" || value === "cjs") return value;
  throw new Error(`DDTDS_MODULE must be "esm" or "cjs", got "${value}"`);
}

/** Node reads `type` from the closest package.json to pick CommonJS or ESM */
function moduleSystem(root: string): ModuleSystem {
  const path = findPackageJSON(pathToFileURL(root + "/").href);
  // with no package.json above, Node can answer with the directory itself
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
