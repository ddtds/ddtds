import { relative, resolve } from "node:path";
import { cli, command, type Flags } from "cleye";
import {
  defaultDocsExclude,
  defaultOutDir,
  readDocs,
  resolveDocsOptions,
  writeFiles,
  type Annotation,
  DocIndex,
  type Lang,
} from "@ddtds/core";
import { createLoggerFromEnv } from "@ddtds/core/log";
import { moduleFiles } from "@ddtds/vitest";

const logger = createLoggerFromEnv();

const flags = {
  exclude: {
    type: [String],
    description: `Glob of docs to skip, replaces default (default: ${JSON.stringify(defaultDocsExclude)})`,
  },
  outDir: {
    type: String,
    description: `Directory for generated test files (default: ${JSON.stringify(defaultOutDir)})`,
  },
} satisfies Flags;

type Loaded = { root: string; outDir: string; index: DocIndex };

function load(include: string[], exclude?: string[], out = defaultOutDir): Loaded {
  const { root, ...docs } = resolveDocsOptions({ root: process.cwd(), include, exclude });
  const outDir = resolve(root, out);
  const sources = readDocs(root, docs.include, docs.exclude);
  return {
    root,
    outDir,
    index: DocIndex.fromSources(sources, { root, moduleDir: outDir, logger }),
  };
}

type Entry = {
  file: string;
  line: number;
  lang: Lang;
  annotation: Annotation | null;
  module: string;
};

function entries({ root, index }: Loaded): Entry[] {
  return [...index.fences()].map(({ id, block }) => {
    const { file, lang, annotation } = block.details;
    return { file, line: block.line, lang, annotation, module: relative(root, id) };
  });
}

const buildCmd = command({ name: "build", parameters: ["[include...]"], flags }, (argv) => {
  const { root, outDir, index } = load(argv._.include, argv.flags.exclude, argv.flags.outDir);
  writeFiles(outDir, moduleFiles(index, root));
  logger.info(`Total: ${index.size} tests in ${relative(root, outDir)}`);
});

const listCmd = command(
  {
    name: "list",
    parameters: ["[include...]"],
    flags: { ...flags, json: { type: Boolean, description: "Print as JSON" } },
  },
  (argv) => {
    const list = entries(load(argv._.include, argv.flags.exclude, argv.flags.outDir));
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
