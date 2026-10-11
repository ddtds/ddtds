import { defineConfig } from "tsdown";

// A command line tool: published through `bin`, with no module to import or type
export default defineConfig({ exports: false, attw: false });
