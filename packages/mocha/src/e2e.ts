import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { cli, type Mode, type Runner } from "@ddtds/test-utils";

const require = createRequire(import.meta.url);
const mocha = join(dirname(require.resolve("mocha/package.json")), "bin/mocha.js");
const register = join(import.meta.dirname, "register.ts");
const reporter = join(import.meta.dirname, "reporter.ts");

export const mochaRunner: Runner = cli({
  name: "mocha",
  command(docs: string[], mode: Mode): [string, ...string[]] {
    const args = [mocha, "--require", register, "--reporter", reporter, "--full-trace"];
    if (mode === "watch") {
      // parallel mode reloads specs with `import()`, which sync `require` cannot (mochajs/mocha#4374)
      args.push("--watch", "--parallel", "--jobs", "2");
      for (const glob of ["md", "ts", "js", "cts", "cjs", "mts", "mjs"]) {
        args.push("--watch-files", `**/*.${glob}`);
      }
    }
    return [process.execPath, ...args, ...docs];
  },
});
