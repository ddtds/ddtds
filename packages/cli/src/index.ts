import { cli, command } from "cleye";
import { defaultDocsExclude, defaultDocsInclude, defaultOutputDir, generate } from "@ddtds/vitest";

const buildCmd = command(
  {
    name: "build",
    parameters: ["[include...]"],
    help: {
      usage: `ddt build [flags...] [include...] (default: ${defaultDocsInclude.join(", ")})`,
    },
    flags: {
      exclude: {
        type: [String],
        description: `Glob of docs to skip, replaces default (default: ${defaultDocsExclude.join(", ")})`,
      },
      output: {
        type: String,
        description: `Directory for generated test files (default: ${defaultOutputDir})`,
      },
    },
  },
  (argv) => {
    generate({
      root: process.cwd(),
      include: argv._.include,
      exclude: argv.flags.exclude,
      outputDir: argv.flags.output,
    });
  },
);

void cli({
  name: "ddt",
  commands: [buildCmd],
});
