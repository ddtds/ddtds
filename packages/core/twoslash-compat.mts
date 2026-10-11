// Experiment: compare Twoslash and ddtds typecheck on a docs repo's `twoslash` fences.
/* oxlint-disable no-console -- prints the comparison */
// Usage: node twoslash-compat.mts <docs root> <docs dir>
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import ts from "typescript6";
import { createTwoslasher } from "twoslash";
import { CodeBlock } from "./src/blocks.ts";
import { typecheck } from "./src/typecheck.ts";
import type { Fence } from "./src/docs.ts";

const [root = "", docsDir = ""] = process.argv.slice(2);
const files = readdirSync(join(root, docsDir), { recursive: true, encoding: "utf8" })
  .filter((file) => /\.mdx?$/.test(file))
  .map((file) => join(root, docsDir, file));

const fences: Fence[] = [];
for (const doc of files) {
  const source = readFileSync(doc, "utf8");
  for (const match of source.matchAll(/^```(ts|tsx) twoslash[^\n]*\n([\s\S]*?)\n```$/gm)) {
    const line = source.slice(0, match.index).split("\n").length;
    const block = new CodeBlock({
      code: match[2],
      lang: match[1] === "tsx" ? "tsx" : "ts",
      annotation: "run",
      path: relative(root, doc),
      range: { start: { line, column: 1 }, end: { line, column: 1 } },
      indent: 0,
    });
    fences.push({ id: join(root, "__ddtds__", `f${fences.length}.${match[1]}`), doc, block });
  }
}

// Twoslash configured like the site: compiler options from its astro.config.mjs
const twoslasher = createTwoslasher({
  tsModule: ts,
  tsLibDirectory: dirname(createRequire(import.meta.url).resolve("typescript6/lib/lib.d.ts")),
  vfsRoot: root,
  compilerOptions: {
    module: 99,
    moduleResolution: 100,
    baseUrl: root,
    types: ["node"],
    paths: {
      "@bomb.sh/tty": ["node_modules/@bomb.sh/tty/esm/mod.d.ts"],
      zod: ["node_modules/.pnpm/node_modules/zod"],
    },
  },
});

const twoslashStart = performance.now();
const twoslash = new Map<string, string>();
for (const { id, block } of fences) {
  try {
    twoslasher(block.code, block.lang);
    twoslash.set(id, "ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    twoslash.set(id, `error: ${message.split("\n").find((l) => l.trim()) ?? ""}`.slice(0, 140));
  }
}

const twoslashMs = performance.now() - twoslashStart;
const ddtdsStart = performance.now();
const ddtds = await typecheck(root, "", fences);
const ddtdsMs = performance.now() - ddtdsStart;
console.log(`twoslash ${Math.round(twoslashMs)}ms, ddtds ${Math.round(ddtdsMs)}ms`);

const rows: string[] = [];
const tally = new Map<string, number>();
for (const { id, block } of fences) {
  const a = twoslash.get(id) === "ok" ? "ok" : "error";
  const b = ddtds.has(id) ? "error" : "ok";
  const key = `twoslash ${a} / ddtds ${b}`;
  tally.set(key, (tally.get(key) ?? 0) + 1);
  if (a !== b) {
    const why = ddtds.get(id)?.message.split("\n")[0] ?? twoslash.get(id) ?? "";
    rows.push(`${block.details.file}:${block.line}  ${key}  ${why.slice(0, 160)}`);
  }
}
console.log(`${fences.length} twoslash fences`);
for (const [key, count] of tally) console.log(`  ${count}  ${key}`);
console.log(rows.join("\n"));

const reasons = new Map<string, number>();
for (const { id } of fences) {
  const why = twoslash.get(id) ?? "";
  if (why === "ok") continue;
  const key = why.replaceAll(/'[^']*'|"[^"]*"|\d+/g, "_").slice(0, 110);
  reasons.set(key, (reasons.get(key) ?? 0) + 1);
}
console.log("twoslash errors:");
for (const [key, count] of [...reasons].toSorted((a, b) => b[1] - a[1]))
  console.log(`  ${count}  ${key}`);
const ddtdsReasons = new Map<string, number>();
for (const error of ddtds.values()) {
  const key = error.message
    .split("\n")[0]
    .replace(/^\S+ /, "")
    .replaceAll(/'[^']*'|"[^"]*"|\d+/g, "_")
    .slice(0, 110);
  ddtdsReasons.set(key, (ddtdsReasons.get(key) ?? 0) + 1);
}
console.log("ddtds errors:");
for (const [key, count] of [...ddtdsReasons].toSorted((a, b) => b[1] - a[1]).slice(0, 12))
  console.log(`  ${count}  ${key}`);
