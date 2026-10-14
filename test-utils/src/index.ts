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

export type Runner = {
  name: string;
  env?: NodeJS.ProcessEnv;
  prepare?(root: string): void;
  command(docs: string[], mode: Mode): readonly [string, ...string[]];
  completed?(stdout: Lines): number;
  outcomes?(stdout: Lines): Outcomes;
};

export type Session = AsyncDisposable & {
  root: string;
  run(): Promise<Outcomes>;
  watch(): Promise<Outcomes>;
  edit(file: string, content: string): Promise<Outcomes>;
};

type Watcher = {
  next(): Promise<Outcomes>;
  close(): Promise<void>;
};

export function fence(code: string, annotation = "run"): string {
  return `\`\`\`ts ${annotation}\n${code}\n\`\`\`\n\n`;
}

export function encode(outcomes: Outcomes): string {
  return `${JSON.stringify({ type: "outcomes", outcomes })}\n`;
}

function environment(runner: Runner): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", ...runner.env };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete env[key];
  }
  return env;
}

function completedOf(runner: Runner, stdout: Lines): number {
  return runner.completed?.(stdout) ?? stdout.completed;
}

function outcomesOf(runner: Runner, stdout: Lines): Outcomes {
  return runner.outcomes?.(stdout) ?? v.parse(decoded, stdout.last).outcomes;
}

function watcher(runner: Runner, root: string, docs: string[]): Watcher {
  const [bin, ...args] = runner.command(docs, "watch");
  const child = launch(bin, args, {
    cwd: root,
    env: environment(runner),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = new Lines(child.stdout);
  child.stderr.resume();

  const completed = (): number => completedOf(runner, stdout);
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
        reject(new Error(`${runner.name} did not rerun`));
      }, 20_000);
      stdout.on("line", check);
      check();
    });
  }

  return {
    async next(): Promise<Outcomes> {
      await until(() => completed() > seen);
      seen = completed();
      return outcomesOf(runner, stdout);
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
  runner: Runner,
  root: string,
  docs: string[],
  mode: Mode,
): Promise<Outcomes> {
  const [bin, ...args] = runner.command(docs, mode);
  const child = launch(bin, args, {
    cwd: root,
    env: environment(runner),
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = new Lines(child.stdout);
  child.stderr.resume();
  await once(child, "close");
  return outcomesOf(runner, stdout);
}

export function spawn(runner: Runner, files: Record<string, string>): Session {
  const root = mkdtempSync(join(import.meta.dirname, "../.fixture-"));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  runner.prepare?.(root);
  const docs = Object.keys(files).filter((file) => /\.mdx?$/.test(file));
  let watching: Watcher | undefined;

  return {
    root,
    run: () => execute(runner, root, docs, "run"),
    async watch(): Promise<Outcomes> {
      watching = watcher(runner, root, docs);
      return watching.next();
    },
    async edit(file: string, content: string): Promise<Outcomes> {
      writeFileSync(join(root, file), content);
      return watching ? watching.next() : execute(runner, root, docs, "run");
    },
    async [Symbol.asyncDispose](): Promise<void> {
      await watching?.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
