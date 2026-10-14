import { join } from "node:path";
import { cli, type Mode, type Runner } from "@ddtds/test-utils";

const register = join(import.meta.dirname, "register.ts");
const reporter = join(import.meta.dirname, "reporter.ts");

export const nodeTest: Runner = cli({
  name: "node:test",
  command(docs: string[], mode: Mode): [string, ...string[]] {
    const args = ["--test", `--test-reporter=${reporter}`, "--import", register];
    if (mode === "watch") args.push("--watch");
    return [process.execPath, ...args, ...docs];
  },
});
