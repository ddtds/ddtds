import { cli, command } from "cleye";
import { defaultDocsExclude, defaultDocsInclude, defaultOutputDir, generate } from "@ddtds/vitest";

const buildCmd = command(
  {
    name: "build",
    parameters: ["[include...]"],
    flags: {
      exclude: {
        type: [String],
        default: defaultDocsExclude,
        description: "Glob of docs to skip, replaces default",
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
      include: include.length > 0 ? include : defaultDocsInclude,
      exclude,
      outputDir: output,
    });
  },
);

void cli({
  name: "ddt",
  commands: [buildCmd],
});
