import { moduleOf, type ModuleSystem, type TestAdapter } from "./adapter.ts";

const statements: Record<ModuleSystem, (module: string, name: string, alias?: string) => string> = {
  esm: (module, name, alias) =>
    `import { ${name}${alias ? ` as ${alias}` : ""} } from '${module}';`,
  cjs: (module, name, alias) =>
    `const { ${name}${alias ? `: ${alias}` : ""} } = require('${module}');`,
};

export function importStatement(
  system: ModuleSystem,
  module: string,
  name: string,
  alias?: string,
): string {
  return statements[system](module, name, alias);
}

/** Doc modules always `import`; fence modules follow the adapter's module system */
export function runtimeImport(
  adapter: TestAdapter,
  system: ModuleSystem = moduleOf(adapter),
): string {
  return importStatement(system, adapter.runtime, "runtime");
}

export function adapterFor(adapter: TestAdapter, module: ModuleSystem): TestAdapter {
  if (module === moduleOf(adapter)) return adapter;
  return adapter.forModule?.(module) ?? adapter;
}
