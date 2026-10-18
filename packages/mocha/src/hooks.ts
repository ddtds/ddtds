import type { RegisterHooksOptions } from "node:module";
import { extname, relative } from "node:path";
import { ddtHooks as nodeHooks, type HookOptions, type HookRunner } from "@ddtds/node-test";
import { mochaAdapter } from "./adapter.ts";

// works with both built and source
const runtimeUrl = new URL(`./runtime${extname(import.meta.filename)}`, import.meta.url).href;

/** Mocha loads each spec itself, from its own `lib` */
const mochaRunner: HookRunner = {
  adapter: mochaAdapter,
  runtimeUrl,
  scriptOnly: true,
  brokenDoc: (path, message) =>
    `it(${JSON.stringify(relative(process.cwd(), path))}, () => { throw new Error(${JSON.stringify(message)}); });`,
  loadsSpec: (parentURL) =>
    parentURL !== undefined && /\/mocha\/lib\/nodejs\/esm-utils\./.test(parentURL),
};

export function ddtHooks(root: string, options?: HookOptions): RegisterHooksOptions {
  return nodeHooks(root, mochaRunner, options);
}
