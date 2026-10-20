import { brand, type Brand } from "../brand.ts";

/**
 * Only `typedImports` builds one for users, so the module and its names always agree
 *
 * @example
 * ```ts run
 * import { typedImports, type StaticImport } from "@ddtds/core/config";
 *
 * const importFromPath = typedImports<typeof import("node:path")>("node:path");
 * const basename: StaticImport = importFromPath("basename");
 * expect(basename).toEqual({ module: "node:path", name: "basename" });
 * ```
 */
export type StaticImport = Brand<
  Readonly<{ module: string; name: string; alias?: string }>,
  "StaticImport"
>;

function staticImport(module: string, name: string, alias?: string): StaticImport {
  return brand<StaticImport>(alias === undefined ? { module, name } : { module, name, alias });
}

type TypedImporter<Module> = (name: keyof Module, options?: { alias?: string }) => StaticImport;

export function typedImports<Module>(module: string): TypedImporter<Module> {
  return (name, { alias } = {}) => staticImport(module, String(name), alias);
}
