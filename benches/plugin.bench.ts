import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "vitest";
import { DdtSession } from "@ddtds/core";
import { ddtPlugin } from "@ddtds/vitest";
import { adapter } from "./adapter.ts";
import { guide, sourceWithFences, sourceWithoutFences } from "./fixtures.ts";

/**
 * A package with a large module whose doc comments are mostly prose, with an example on
 * about a third of them, beside markdown guides. The plugin reads it from disk
 */
const root = join(import.meta.dirname, ".fixture-plugin");
const files: Record<string, string> = {
  "package.json": '{ "type": "module" }',
  "src/large.ts": `${sourceWithoutFences(170)}\n${sourceWithFences(80)}`,
};
for (let i = 0; i < 5; i++) files[`docs/guide-${i}.md`] = guide(10);
rmSync(root, { recursive: true, force: true });
for (const [path, text] of Object.entries(files)) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}
const include = ["src/**/*.ts", "docs/**/*.md"];
const fenceIds = Array.from(
  DdtSession.fromFiles(adapter, { root, include }).index.fences(),
  (fence) => fence.id,
);

/** Calls a plugin hook, which may be a function or `{ handler }`, with the context ddtds uses */
function call(hook: unknown, ...args: unknown[]): unknown {
  const handler =
    typeof hook === "object" && hook !== null && "handler" in hook ? hook.handler : hook;
  if (typeof handler !== "function") return undefined;
  return Reflect.apply(handler, { addWatchFile() {} }, args);
}

function plugin(): ReturnType<typeof ddtPlugin> {
  const created = ddtPlugin({ include, logLevel: "fatal" });
  call(created.config, { root }, { command: "serve", mode: "test" });
  return created;
}
const served = plugin();

/** What the vitest plugin costs a run, called through its hooks without starting Vitest */
test("vitest plugin", async ({ bench }) => {
  await bench("index a package with a large module and markdown guides", () => {
    plugin();
  }).run();

  // Vitest loads every module to key its fsModuleCache, even when the cache has it
  await bench("load every fence, as a warm fsModuleCache run does", () => {
    for (const id of fenceIds) call(served.load, id);
  }).run();

  // Vite serializes each module and its source map to send it to Vitest
  await bench("serve every fence module and serialize it", () => {
    for (const id of fenceIds) {
      const loaded = call(served.load, id);
      JSON.stringify(call(served.transform, "", id) ?? loaded);
    }
  }).run();
});
