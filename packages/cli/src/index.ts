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
        placeholder: "<glob>",
        description: "Glob of docs to skip (repeatable, replaces default)",
      },
      output: {
        type: String,
        default: defaultOutputDir,
        placeholder: "<dir>",
        description: "Directory to write test files to",
      },
    },
    help: {
      description: "Write a test file for each runnable code fence in your docs",
      examples: [
        `ddt build                                  # docs matching ${defaultDocsInclude.join(" ")}`,
        'ddt build "docs/**/*.md" README.md         # only these docs',
        'ddt build --exclude "**/node_modules/**" --exclude "docs/api/**"',
      ],
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
  help: { description: "Run the code fences in your Markdown docs as tests" },
  commands: [buildCmd],
});
