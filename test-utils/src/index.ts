import { spawn as launch, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export type Outcome = "passed" | "failed" | (string & {});
export type Outcomes = Record<string, Outcome>;
export type Mode = "run" | "watch";

export type Run = {
  root: string;
  docs: string[];
  status: number | null;
  stdout: string;
  stderr: string;
};

export type Runner = {
  name: string;
  env?: NodeJS.ProcessEnv;
  prepare?(root: string): void;
  command(docs: string[], mode: Mode): readonly [string, ...string[]];
  completed?(output: string): number;
  outcomes(run: Run): Outcomes;
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

function environment(runner: Runner): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", ...runner.env };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete env[key];
  }
  return env;
}

function watcher(runner: Runner, root: string, docs: string[]): Watcher {
  const [bin, ...args] = runner.command(docs, "watch");
  const child = launch(bin, args, {
    cwd: root,
    env: environment(runner),
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: string) => (stdout += chunk));
  child.stderr.on("data", (chunk: string) => (stderr += chunk));

  const completed = (): number => runner.completed?.(stdout) ?? 0;
  const exited = (): boolean => child.exitCode !== null || child.signalCode !== null;
  let seen = 0;

  function until(condition: () => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const stop = (): void => {
        clearTimeout(timer);
        child.stdout.off("data", check);
        child.stderr.off("data", check);
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
      child.stdout.on("data", check);
      child.stderr.on("data", check);
      check();
    });
  }

  return {
    async next(): Promise<Outcomes> {
      await until(() => completed() > seen);
      seen = completed();
      return runner.outcomes({ root, docs, status: null, stdout, stderr });
    },
    async close(): Promise<void> {
      if (exited()) return;
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), delay(2_000)]);
      if (!exited()) child.kill("SIGKILL");
    },
  };
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

  async function execute(mode: Mode): Promise<Outcomes> {
    const [bin, ...args] = runner.command(docs, mode);
    const result = spawnSync(bin, args, { cwd: root, encoding: "utf8", env: environment(runner) });
    return runner.outcomes({
      root,
      docs,
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  return {
    root,
    run: () => execute("run"),
    async watch(): Promise<Outcomes> {
      watching = watcher(runner, root, docs);
      return watching.next();
    },
    async edit(file: string, content: string): Promise<Outcomes> {
      writeFileSync(join(root, file), content);
      return watching ? watching.next() : execute("run");
    },
    async [Symbol.asyncDispose](): Promise<void> {
      await watching?.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
