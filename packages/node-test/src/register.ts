import { registerHooks } from "node:module";
import { ddtHooks } from "./hooks.ts";

registerHooks(ddtHooks(process.cwd(), process.argv[1]));
