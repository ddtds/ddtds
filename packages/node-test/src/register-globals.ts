import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { join } from "node:path";
import { ddtHooks } from "./index.ts";

const globals = JSON.parse(readFileSync(join(process.cwd(), "globals.json"), "utf8"));

registerHooks(ddtHooks(process.cwd(), { globals }));
