import { registerHooks } from "node:module";
import { ddtHooks } from "./hooks.ts";

/** `node --test --import @ddtds/node/register "docs/*.md"` runs fences in markdown docs */
process.setSourceMapsEnabled(true);
registerHooks(ddtHooks(process.cwd()));
