#!/usr/bin/env node
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
import { configureLogging, consoleSink } from "@ddtds/core/log";
import { getLogger, parseLogLevel } from "@logtape/logtape";
import { moduleFiles } from "@ddtds/vitest";

const logger = getLogger(["ddtds", "cli"]);

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
    configureLogging(parseLogLevel(process.env.DDT_LOG_LEVEL ?? "info"), consoleSink);
    const { root, include, exclude } = resolveDocsOptions({
      root: process.cwd(),
      include: argv._.include,
      exclude: argv.flags.exclude,
    });
    const moduleDir = resolve(root, argv.flags.output ?? defaultOutDir);
    const index = DocIndex.fromSources(readDocs(root, include, exclude), {
      root,
      moduleDir,
    });
    writeFiles(moduleDir, moduleFiles(index));
    logger.info("Total: {size} tests", { size: index.size });
  },
);

void cli({
  name: "ddt",
  commands: [buildCmd],
});
