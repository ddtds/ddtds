#!/usr/bin/env node
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { cli, command } from "cleye";
import {
  DocIndex,
  defaultDocsExclude,
  defaultOutDir,
  readDocs,
  resolveDocsOptions,
} from "@ddtds/core";
import { getLogger } from "@logtape/logtape";
import { moduleFiles } from "@ddtds/vitest";
import { configureLogging } from "./logging.ts";

const logger = getLogger(["ddtds", "cli"]);

function writeFiles(dir: string, files: ReadonlyMap<string, string>): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of files) writeFileSync(path, content);
}

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
    configureLogging();
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
