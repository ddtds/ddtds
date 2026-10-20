import { expect, test } from "vitest";
import { cli, encode, fixture, type Outcomes, type Report } from "./index.ts";

const source = (outcomes: Outcomes, code = 0): string =>
  `console.log(${JSON.stringify(encode(outcomes, {}))});${code ? `\nprocess.exitCode = ${code};` : ""}`;

const scripted = (script: string) => (): [string, ...string[]] => [process.execPath, "-e", script];

const run = async (script: string): Promise<Report> => {
  await using dir = fixture({});
  return await cli({ name: "fake", command: scripted(script) }).run(dir.root, []);
};

const accepted: [string, Outcomes, number][] = [
  ["passing", { "doc.md:1": "passed" }, 0],
  ["failing", { "doc.md:1": "failed" }, 1],
];

test.each(accepted)("accepts %s outcomes", async (_title, outcomes, code) => {
  await expect(run(source(outcomes, code))).resolves.toEqual({ outcomes, failures: {} });
});

const rejected: [string, Outcomes, number, string][] = [
  ["failures with exit 0", { "doc.md:1": "failed" }, 0, "fake exited 0 after 1 failing outcome(s)"],
  ["a pass with exit 1", { "doc.md:1": "passed" }, 1, "fake exited 1 with no failing outcomes"],
];

test.each(rejected)("rejects %s", async (_title, outcomes, code, message) => {
  await expect(run(source(outcomes, code))).rejects.toThrow(message);
});

const invalid: [string, string, string][] = [
  [
    "a crash with stderr",
    `console.error("boom"); process.exitCode = 2;`,
    "fake exited with code 2 without reporting outcomes\nstderr:\nboom",
  ],
  ["an unreadable report", `console.log("not json");`, "fake wrote an unreadable report: not json"],
];

test.each(invalid)("rejects %s", async (_title, script, message) => {
  await expect(run(script)).rejects.toThrow(message);
});
