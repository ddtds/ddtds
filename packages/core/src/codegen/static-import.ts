import type { ImportBinding } from "../fences/parse.ts";
import type { ModuleSystem } from "./adapter.ts";
import type { StaticImport } from "./imports.ts";
import { importStatement } from "./module-system.ts";

export function localName({ name, alias }: StaticImport): string {
  return alias ?? name;
}

export function renderImport({ module, name, alias }: StaticImport, system: ModuleSystem): string {
  return importStatement(system, module, name, alias);
}

export function unshadowed(
  injected: readonly StaticImport[],
  taken: readonly string[],
): StaticImport[] {
  return injected.filter((staticImport) => !taken.includes(localName(staticImport)));
}

/** Type-only bindings are erased, so they never clash with an injected import */
export function runtimeNames(bindings: readonly ImportBinding[]): string[] {
  return bindings.filter(({ kind }) => kind === "value").map(({ local }) => local);
}
