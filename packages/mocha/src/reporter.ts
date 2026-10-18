import { statSync } from "node:fs";
import type { Runner, Test } from "mocha";
import { encode, framesOf, type Failures, type Outcomes } from "@ddtds/test-utils";

function status(error: Error): string {
  return error.name || "failed";
}

// the harness reads one JSON line per run, so drop mocha's watch-mode chatter and cursor escapes
const report = process.stdout.write.bind(process.stdout);
process.stdout.write = (): boolean => true;

// mocha reruns every spec on a change, but the harness expects only the edited doc to rerun
const seen = new Map<string, number>();

function changed(test: Test): boolean {
  const file = test.file;
  if (file === undefined) return true;
  const modified = statSync(file).mtimeMs;
  return seen.get(file) !== modified;
}

function remember(files: Set<string>): void {
  for (const file of files) seen.set(file, statSync(file).mtimeMs);
}

export default class Reporter {
  public constructor(runner: Runner) {
    const outcomes: Outcomes = {};
    const failures: Failures = {};
    const files = new Set<string>();
    runner.on("pass", (test: Test) => {
      if (test.file !== undefined) files.add(test.file);
      if (changed(test)) outcomes[test.title] = "passed";
    });
    runner.on("fail", (test: Test, error: Error) => {
      if (test.file !== undefined) files.add(test.file);
      if (!changed(test)) return;
      outcomes[test.title] = status(error);
      failures[test.title] = framesOf(error.stack, process.cwd());
    });
    runner.once("end", () => {
      remember(files);
      report(encode(outcomes, failures));
    });
  }
}
