import { join } from "node:path";
import type { Mode, Outcomes, Run, Runner } from "@ddtds/test-utils";

const register = join(import.meta.dirname, "register.ts");
const reporter = join(import.meta.dirname, "reporter.ts");

function parse(stdout: string): Outcomes {
  const outcomes: Outcomes = {};
  const last = stdout.split("\n").findLast((line) => line.startsWith("{"));
  if (!last) return outcomes;
  const parsed: unknown = JSON.parse(last);
  if (typeof parsed !== "object" || parsed === null) return outcomes;
  for (const [name, status] of Object.entries(parsed)) {
    if (typeof status === "string") outcomes[name] = status;
  }
  return outcomes;
}

function completed(output: string): number {
  return output.split("\n").filter((line) => line.startsWith("{")).length;
}

export const nodeTest: Runner = {
  name: "node:test",
  command(docs: string[], mode: Mode): [string, ...string[]] {
    const args = ["--test", `--test-reporter=${reporter}`, "--import", register];
    if (mode === "watch") args.push("--watch");
    return [process.execPath, ...args, ...docs];
  },
  completed,
  outcomes({ stdout }: Run): Outcomes {
    return parse(stdout);
  },
};
