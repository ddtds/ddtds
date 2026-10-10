import { cli, command } from "cleye";
import { defaultOutputDir, generate } from "@ddtds/vitest";

const buildCmd = command(
  {
    name: "build",
    parameters: ["[include...]"],
    flags: {
      exclude: {
        type: [String],
        description: "Glob of docs to skip (repeatable)",
      },
      output: {
        type: String,
        default: defaultOutputDir,
        description: "Directory for generated test files",
      },
    },
  },
  (argv) => {
    const { include } = argv._;
    const { exclude, output } = argv.flags;
    generate({
      root: process.cwd(),
      include: include.length > 0 ? include : undefined,
      exclude: exclude.length > 0 ? exclude : undefined,
      outputDir: output,
    });
  },
);

void cli({
  name: "ddt",
  commands: [buildCmd],
});
