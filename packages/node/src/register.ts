import { registerHooks } from "node:module";
import { ddtHooks } from "./hooks.ts";

/**
 * `node --enable-source-maps --test --import @ddtds/node/register "docs/*.md"` runs fences in
 * markdown docs. Stacks point at the markdown either way; node:test only places tests at their
 * fences with `--enable-source-maps`.
 */
process.setSourceMapsEnabled(true);
registerHooks(ddtHooks(process.cwd()));
