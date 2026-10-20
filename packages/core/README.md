# @ddtds/core

Framework-agnostic doctest engine: document discovery, fence parsing, code
generation, source maps, and watch-mode session tracking.

## Subpaths

- `@ddtds/core` (`DdtSession`) — track docs and serve generated test modules.
- `@ddtds/core/config` — `typedImports`, `StaticImport`, docs/DDT options and defaults.
- `@ddtds/core/codegen` — `TestAdapter`, `ModuleSystem`, `moduleFor`.
- `@ddtds/core/docs` — `DocIndex`, `IndexOptions`.
- `@ddtds/core/fences` — `parseCodeFences`, `CodeBlock`, `ANNOTATIONS`, languages.
- `@ddtds/core/errors` — `DdtCompileError` and compile-error types.
- `@ddtds/core/log` — `configureLogging`.
- `@ddtds/core/runtime` — runtime helpers used by generated tests.

## Adapters

Framework packages (`@ddtds/vitest`, `@ddtds/node-test`) build a `TestAdapter`
and drive a `DdtSession`. See their READMEs.
