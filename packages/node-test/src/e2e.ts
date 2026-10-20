import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StaticImport } from "@ddtds/core/imports";
import { cli, type Mode, type Runner } from "@ddtds/test-utils";
import type { Globals } from "@ddtds/test-utils/conformance";

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

const importSource = ({ module, name, alias }: StaticImport): string =>
  `typedImports(${JSON.stringify(module)})(${JSON.stringify(name)}, ${JSON.stringify({ alias })})`;

// .mts keeps the file ESM inside a CommonJS fixture package
const registerSource = ({ defaults, extra }: Globals): string =>
  [
    `import { registerHooks } from "node:module";`,
    `import { ddtHooks, defaultGlobals, typedImports } from ${JSON.stringify(index)};`,
    `const globals = [${[...(defaults ? ["...defaultGlobals"] : []), ...extra.map(importSource)].join(", ")}];`,
    `registerHooks(ddtHooks(process.cwd(), { globals }));`,
  ].join("\n");

export function nodeTestWithGlobals(globals: Globals): Runner {
  return cli({
    name: "node:test with globals",
    prepare: (root) => writeFileSync(join(root, "register.mts"), registerSource(globals)),
    command: command("./register.mts"),
  });
}
