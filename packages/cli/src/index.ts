import { cli, command } from "cleye";
import { defaultDocsExclude, defaultOutputDir, generate } from "@ddtds/vitest";

const buildCmd = command(
  {
    name: "build",
    parameters: ["[include...]"],
    flags: {
      exclude: {
        type: [String],
        description: `Glob of docs to skip, replaces default (default: ${JSON.stringify(defaultDocsExclude)})`,
      },
      output: {
        type: String,
        description: `Directory for generated test files (default: ${JSON.stringify(defaultOutputDir)})`,
      },
    },
  },
  (argv) => {
    const { include } = argv._;
    const { exclude, output } = argv.flags;
    generate({
      root: process.cwd(),
      include,
      exclude,
      outputDir: output,
    });
  },
);

void cli({
  name: "ddt",
  commands: [buildCmd],
});
