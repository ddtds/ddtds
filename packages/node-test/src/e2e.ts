import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, type Globals, type Mode, type Runner } from "@ddtds/test-utils";

const register = join(import.meta.dirname, "register.ts");
const index = join(import.meta.dirname, "index.ts");
const reporter = join(import.meta.dirname, "reporter.ts");

const command = (hooks: string) =>
  function (docs: string[], mode: Mode): [string, ...string[]] {
    const args = ["--test", `--test-reporter=${reporter}`, "--import", hooks];
    if (mode === "watch") args.push("--watch");
    return [process.execPath, ...args, ...docs];
  };

export const nodeTest: Runner = cli({ name: "node:test", command: command(register) });

export function nodeTestWithGlobals({ defaults, extra }: Globals): Runner {
  const globals = defaults
    ? `[...defaultGlobals, ...${JSON.stringify(extra)}]`
    : JSON.stringify(extra);
  return cli({
    name: "node:test with globals",
    prepare(root) {
      writeFileSync(
        join(root, "register.mts"),
        [
          `import { registerHooks } from "node:module";`,
          `import { ddtHooks, defaultGlobals } from ${JSON.stringify(index)};`,
          `registerHooks(ddtHooks(process.cwd(), { globals: ${globals} }));`,
        ].join("\n"),
      );
    },
    command: command("./register.mts"),
  });
}
