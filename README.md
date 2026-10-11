# ddtds

[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://codspeed.io/ddtds/ddtds?utm_source=badge)

ddtds doctests that don't suck

runs your code blocks as tests with your framework of choice

## Architecture

1. parse codeblocks + tags
2. build testfiles
3. run with repo config

Takes advantage of existing test config instead of a separate compiler config or test config

## Packages

- `./packages` has ddtdts library and cli code
  - core has agnostic logic for parsing codefences
  - vitest is vitest specific logic and plugin
  - cli is light glue to run it all
  - e2e is tests
- `./examples` has react, typescript, javascript examples

## Alternatives

TODO verify these claims and also find more alternatives

typescript-docs-verifier typechecks with a custom config, I don't believe it allows for custom compilers so react is off the table

markdown-doctest seems pretty old looking and only works with js

## Roadmap

Must haves

1. support vitest
2. CLI
3. hide boilerplate (should it be # or other syntax)
4. annotations (run, fail, skip, compile_fail, no_run)
5. --max-failures to ratchet down build failures incrementally
6. agent skill to aid with migration and fixing build failures (prefer adding hidden imports to compile, do not add assertions??)
7. ignore config (maybe file?)
8. Hoisting imports (what if conflicting? should we just rewrite to dynamic imports??? one file per test?)
9. dynamic imports/relative paths
10. test isolation (users ideally shouldn't be setting globals in tests, should we deal with this ourselves?)
11. monorepo with multiple testing roots (I think doctest package would be best here to avoid polluting the dev deps in root)
12. strip export/export default
13. don't crash process on compile failure

Nice to haves

1. generic template string to add generic top level imports and test func
2. other framework support like node builtin support or jest
3. error handling (if fails to compile, how to point at source?)
4. watch mode
5. JSON output for ratcheting/LLM consumption/MCP
6. JSDOC stuff

### features that may come up

- ESM vs Commonjs?
- max warnings to allow projects with build failures to crank them down
- maybe force assertions?
- pass through flags

### testing to do

- MDX
- md
- general larger repos
- vitest/jest
- various frameworks (react, solid, vue)
