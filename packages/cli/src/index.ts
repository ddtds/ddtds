import { resolve } from "node:path";
import { cli, command } from "cleye";
import {
  DocIndex,
  defaultDocsExclude,
  defaultOutDir,
  readDocs,
  resolveDocsOptions,
  writeFiles,
} from "@ddtds/core";
import { createLoggerFromEnv } from "@ddtds/core/log";
import { moduleFiles } from "@ddtds/vitest";

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
        description: `Directory for generated test files (default: ${JSON.stringify(defaultOutDir)})`,
      },
    },
  },
  (argv) => {
    const logger = createLoggerFromEnv();
    const { root, include, exclude } = resolveDocsOptions({
      root: process.cwd(),
      include: argv._.include,
      exclude: argv.flags.exclude,
    });
    const moduleDir = resolve(root, argv.flags.output ?? defaultOutDir);
    const index = DocIndex.fromSources(readDocs(root, include, exclude), {
      root,
      moduleDir,
      logger,
    });
    writeFiles(moduleDir, moduleFiles(index));
    logger.info(`Total: ${index.size} tests`);
  },
);

void cli({
  name: "ddt",
  commands: [buildCmd],
});
