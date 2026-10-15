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

/**
 * Creates a project from `files` and a session to run or watch it. `docs` are the paths or globs
 * handed to the runner, and default to the markdown files.
 */
export function spawn(
  runner: Runner,
  files: Record<string, string>,
  { docs = Object.keys(files).filter((file) => /\.mdx?$/.test(file)) }: { docs?: string[] } = {},
): Session {
  const root = create(files);
  runner.prepare?.(root);
  let watching: Watcher | undefined;

  return {
    root,
    run: () => runner.run(root, docs),
    async watch(): Promise<Outcomes> {
      watching = await runner.watch?.(root, docs);
      return watching ? watching.next() : runner.run(root, docs);
    },
    async edit(file: string, content: string): Promise<Outcomes> {
      writeFileSync(join(root, file), content);
      return watching ? watching.next() : runner.run(root, docs);
    },
    async [Symbol.asyncDispose](): Promise<void> {
      await watching?.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
