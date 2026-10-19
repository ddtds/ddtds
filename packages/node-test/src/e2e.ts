import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cli, type Globals, type Mode, type Runner } from "@ddtds/test-utils";
import { defaultGlobals } from "./index.ts";

const register = join(import.meta.dirname, "register.ts");
const registerGlobals = join(import.meta.dirname, "register-globals.ts");
const reporter = join(import.meta.dirname, "reporter.ts");

const command = (hooks: string) =>
  function (docs: string[], mode: Mode): [string, ...string[]] {
    const args = ["--test", `--test-reporter=${reporter}`, "--import", hooks];
    if (mode === "watch") args.push("--watch");
    return [process.execPath, ...args, ...docs];
  };

export const nodeTest: Runner = cli({ name: "node:test", command: command(register) });

export function nodeTestWithGlobals({ defaults, extra }: Globals): Runner {
  return cli({
    name: "node:test with globals",
    prepare(root) {
      const globals = [...(defaults ? defaultGlobals : []), ...extra];
      writeFileSync(join(root, "globals.json"), JSON.stringify(globals));
    },
    command: command(registerGlobals),
  });
}
