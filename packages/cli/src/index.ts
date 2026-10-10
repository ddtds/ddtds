import { relative } from "node:path";
import { cli, command } from "cleye";
import {
  defaultDocsExclude,
  defaultOutputDir,
  indexDocs,
  readDocs,
  resolveDocsOptions,
  writeFiles,
  type Annotation,
  type DocIndex,
  type Lang,
} from "@ddtds/core";
import { createLoggerFromEnv } from "@ddtds/core/log";
import { moduleFiles } from "@ddtds/vitest";

const logger = createLoggerFromEnv();

const parameters: ["[include...]"] = ["[include...]"];
const flags = {
  exclude: {
    type: [String] as [StringConstructor],
    description: `Glob of docs to skip, replaces default (default: ${JSON.stringify(defaultDocsExclude)})`,
  },
  output: {
    type: String,
    description: `Directory for generated test files (default: ${JSON.stringify(defaultOutputDir)})`,
  },
};

type Loaded = { root: string; outputDir: string; index: DocIndex };

function load(include: string[], exclude?: string[], output?: string): Loaded {
  const options = resolveDocsOptions({ root: process.cwd(), include, exclude, outputDir: output });
  const sources = readDocs(options.root, options.include, options.exclude);
  return { ...options, index: indexDocs(sources, { ...options, logger }) };
}

type Entry = {
  file: string;
  line: number;
  lang: Lang;
  annotation: Annotation | null;
  module: string;
};

function entries({ root, index }: Loaded): Entry[] {
  return [...index.fences.values()].map(({ id, block }) => {
    const { file, lang, annotation } = block.details;
    return { file, line: block.line, lang, annotation, module: relative(root, id) };
  });
}

const buildCmd = command({ name: "build", parameters, flags }, (argv) => {
  const { root, outputDir, index } = load(argv._.include, argv.flags.exclude, argv.flags.output);
  writeFiles(outputDir, moduleFiles(index, root));
  logger.info(`Total: ${index.fences.size} tests in ${relative(root, outputDir)}`);
});

const listCmd = command(
  {
    name: "list",
    parameters,
    flags: { ...flags, json: { type: Boolean, description: "Print as JSON" } },
  },
  (argv) => {
    const list = entries(load(argv._.include, argv.flags.exclude, argv.flags.output));
    const lines = argv.flags.json
      ? [JSON.stringify(list, null, 2)]
      : list.map(({ file, line, lang, annotation }) => `${file}:${line} ${lang} ${annotation}`);
    logger.info(lines.join("\n"));
  },
);

void cli({
  name: "ddt",
  commands: [buildCmd, listCmd],
});
