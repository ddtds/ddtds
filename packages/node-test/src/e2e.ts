import { join } from "node:path";
import type { Mode, Outcomes, Run, Runner } from "@ddtds/test-utils";

const register = join(import.meta.dirname, "register.ts");
const plans = /^1\.\.\d+$/gm;

function tap(output: string): Outcomes {
  const results: Outcomes = {};
  for (const [, ok, name] of output.matchAll(/^(ok|not ok) \d+ - (.+)$/gm)) {
    if (name) results[name] = ok === "ok" ? "passed" : "failed";
  }
  return results;
}

export const nodeTest: Runner = {
  name: "node:test",
  command(docs: string[], mode: Mode): [string, ...string[]] {
    const args = ["--test", "--test-reporter=tap", "--import", register];
    if (mode === "watch") args.push("--watch");
    return [process.execPath, ...args, ...docs];
  },
  completed(output: string): number {
    return [...output.matchAll(plans)].length;
  },
  outcomes({ stdout }: Run): Outcomes {
    const found = [...stdout.matchAll(plans)];
    const start = found.at(-2)?.index ?? 0;
    const end = found.at(-1)?.index ?? stdout.length;
    return tap(stdout.slice(start, end));
  },
};
