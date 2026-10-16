import { spawn as launch } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import * as v from "valibot";

export type Mode = "run" | "watch";

const message = v.object({
  type: v.literal("outcomes"),
  outcomes: v.record(v.string(), v.string()),
});

export type Outcomes = v.InferOutput<typeof message>["outcomes"];

const decoded = v.fallback(v.pipe(v.string(), v.parseJson(), message), {
  type: "outcomes",
  outcomes: {},
});

export class Lines extends EventEmitter {
  #completed = 0;
  #last: string | undefined;

  public constructor(stream: Readable) {
    super();
    createInterface({ input: stream }).on("line", (line: string) => {
      if (!line) return;
      this.#completed += 1;
      this.#last = line;
      this.emit("line");
    });
  }

  public get completed(): number {
    return this.#completed;
  }

  public get last(): string | undefined {
    return this.#last;
  }
}

export type Watcher = {
  next(): Promise<Outcomes>;
  close(): Promise<void>;
};

export type Runner = {
  name: string;
  prepare?(root: string): void;
  run(root: string, docs: string[]): Promise<Outcomes>;
  watch?(root: string, docs: string[]): Promise<Watcher>;
};

export type Session = AsyncDisposable & {
  root: string;
  run(): Promise<Outcomes>;
  watch(): Promise<Outcomes>;
  edit(file: string, content: string): Promise<Outcomes>;
};

type Command = (docs: string[], mode: Mode) => readonly [string, ...string[]];

export function fence(code: string, annotation = "run", lang = "ts"): string {
  return `\`\`\`${lang} ${annotation}\n${code}\n\`\`\`\n\n`;
}

export function encode(outcomes: Outcomes): string {
  return `${JSON.stringify({ type: "outcomes", outcomes })}\n`;
}

function environment(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", ...env };
  for (const [key, value] of Object.entries(result)) {
    if (value === undefined) delete result[key];
  }
  return result;
}

function outcomesOf(stdout: Lines): Outcomes {
  return v.parse(decoded, stdout.last).outcomes;
}

function watcher(
  name: string,
  command: Command,
  env: NodeJS.ProcessEnv | undefined,
  root: string,
  docs: string[],
): Watcher {
  const [bin, ...args] = command(docs, "watch");
  const child = launch(bin, args, {
    cwd: root,
    env: environment(env),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = new Lines(child.stdout);
  child.stderr.resume();

  const exited = (): boolean => child.exitCode !== null || child.signalCode !== null;
  let seen = 0;

  function until(condition: () => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const stop = (): void => {
        clearTimeout(timer);
        stdout.off("line", check);
      };
      const check = (): void => {
        if (!condition()) return;
        stop();
        resolve();
      };
      const timer = setTimeout(() => {
        stop();
        reject(new Error(`${name} did not rerun`));
      }, 20_000);
      stdout.on("line", check);
      check();
    });
  }

  return {
    async next(): Promise<Outcomes> {
      await until(() => stdout.completed > seen);
      seen = stdout.completed;
      return outcomesOf(stdout);
    },
    async close(): Promise<void> {
      if (exited()) return;
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), delay(2_000)]);
      if (!exited()) child.kill("SIGKILL");
    },
  };
}

async function execute(
  command: Command,
  env: NodeJS.ProcessEnv | undefined,
  root: string,
  docs: string[],
): Promise<Outcomes> {
  const [bin, ...args] = command(docs, "run");
  const child = launch(bin, args, {
    cwd: root,
    env: environment(env),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = new Lines(child.stdout);
  child.stderr.resume();
  await once(child, "close");
  return outcomesOf(stdout);
}

export function cli(spec: {
  name: string;
  env?: NodeJS.ProcessEnv;
  prepare?(root: string): void;
  command: Command;
}): Runner {
  return {
    name: spec.name,
    prepare: (root: string): void => spec.prepare?.(root),
    run: (root, docs) => execute(spec.command, spec.env, root, docs),
    watch: async (root, docs) => watcher(spec.name, spec.command, spec.env, root, docs),
  };
}

function create(files: Record<string, string>): string {
  const root = mkdtempSync(join(import.meta.dirname, "../.fixture-"));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return root;
}

export function fixture(files: Record<string, string>): AsyncDisposable & { root: string } {
  const root = create(files);
  return {
    root,
    async [Symbol.asyncDispose](): Promise<void> {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

/** Where a doc's markdown lives: a markdown file or a JSDoc comment */
export type Kind = {
  /** Runner file for a markdown file */
  file(markdown: string): string;
  content(markdown: string): string;
  /** Reported id for a fence on `line` of a markdown file */
  id(markdown: string, line: number): string;
};

export const markdown: Kind = {
  file: (name) => name,
  content: (text) => text,
  id: (name, line) => `${name}:${line}`,
};

/** JSDoc in a `.extension` file followed by `code`, which CommonJS files need to change */
export function jsdocIn(extension: string, code = "export {};"): Kind {
  const file = (name: string): string => name.replace(/\.mdx?$/, `.${extension}`);
  return {
    file,
    content(text) {
      const lines = text
        .replace(/\n$/, "")
        .split("\n")
        .map((line) => (line === "" ? " *" : ` * ${line}`));
      return ["/**", ...lines, " */", code, ""].join("\n");
    },
    // `/**` sits one line above the markdown
    id: (name, line) => `${file(name)}:${line + 1}`,
  };
}

export const jsdoc: Kind = jsdocIn("ts");

const isMarkdown = (file: string): boolean => /\.mdx?$/.test(file);

/**
 * Project from `files` plus a session to run or watch it. `kind` places markdown files, which the
 * session still names as markdown. `docs` go to the runner, defaulting to the markdown files
 */
export function spawn(
  runner: Runner,
  files: Record<string, string>,
  { kind = markdown, docs }: { kind?: Kind; docs?: string[] } = {},
): Session {
  const placed = (file: string, text: string): [string, string] =>
    isMarkdown(file) ? [kind.file(file), kind.content(text)] : [file, text];
  const root = create(Object.fromEntries(Object.entries(files).map(([f, t]) => placed(f, t))));
  const handed =
    docs ??
    Object.keys(files)
      .filter(isMarkdown)
      .map((file) => kind.file(file));
  runner.prepare?.(root);
  let watching: Watcher | undefined;

  const rerun = (): Promise<Outcomes> => (watching ? watching.next() : runner.run(root, handed));

  return {
    root,
    run: () => runner.run(root, handed),
    async watch(): Promise<Outcomes> {
      watching = await runner.watch?.(root, handed);
      return rerun();
    },
    async edit(file: string, content: string): Promise<Outcomes> {
      const [path, text] = placed(file, content);
      writeFileSync(join(root, path), text);
      return rerun();
    },
    async [Symbol.asyncDispose](): Promise<void> {
      await watching?.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
