# Twoslash compatibility

Exploration for whether ddtds should adopt Twoslash's conventions. Experiment script:
`packages/core/twoslash-compat.mts` (needs a docs repo with dependencies installed).

## How Twoslash type checks

- `twoslash` (0.3.x) depends on `@typescript/vfs`: a TypeScript language service over a virtual
  file system backed by the real one. Snippets are virtual files; types come from the real
  `node_modules`. This is the same approach as ddtds's `typecheck`.
- Peer dependency `typescript ^5.5 || ^6`: it needs the classic compiler API, so no TypeScript 7.
- Compiler options come from the site's config (Bombshell passes `module`, `moduleResolution`,
  `paths` in `astro.config.mjs`) plus inline `// @flag: value` comments. Not from `tsconfig.json`.
- An error in a snippet that isn't listed in `// @errors` throws, which fails the site build.

## Notations (from the twoslash source)

| Notation                                                                           | Meaning in Twoslash                  | What it would mean in ddtds                                    |
| ---------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| `// ---cut---`, `---cut-before---`                                                 | hide code above from output          | nothing to do: hidden code still runs, the marker is a comment |
| `// ---cut-after---`                                                               | hide code below                      | same                                                           |
| `// ---cut-start---` / `// ---cut-end---`                                          | hide a range                         | same                                                           |
| `// @errors: 2322 2345`                                                            | these errors are expected            | typecheck passes when only these codes appear                  |
| `// @noErrors`                                                                     | don't report errors                  | skip typecheck for the fence, still run it                     |
| `// @filename: a.ts`                                                               | split the fence into virtual files   | split into modules; imports between them must resolve          |
| `// @strict: false` (any compiler option)                                          | per-snippet compiler option          | per-fence typecheck options                                    |
| `// ^?`, `// ^\|`, `// ^^^`                                                        | query type / completions / highlight | comments; `^?` could become a type assertion                   |
| handbook flags: `noErrorValidation`, `showEmit`, `keepNotations`, `noErrorsCutted` | output and validation options        | mostly not applicable                                          |

## Bombshell docs (137 `ts twoslash` fences)

Same TypeScript 6 and Node types on both sides:

| Result                       | Fences |
| ---------------------------- | ------ |
| both pass                    | 119    |
| both fail                    | 1      |
| Twoslash passes, ddtds fails | 17     |

- 16 of the 17 are `Cannot find module 'zod'`: Twoslash gets a `paths` override from the site
  config, ddtds only reads `tsconfig.json`.
- 1 is a real type difference from different strictness settings (site options vs Astro's strict
  tsconfig).
- Without `types: ["node"]`, both failed 61 fences on `process`: TypeScript 6+ defaults `types` to
  `[]`.
- Notation use: 11 `@errors`, 1 `@noErrors`, 1 `---cut---`, no `@filename`.
- Speed: Twoslash 4.0 s, ddtds 0.56 s (one program for all fences vs a language service query per
  fence).

## Takeaways

1. Twoslash and ddtds agree when they get the same compiler options. Every difference came from
   where options come from, so ddtds should accept compiler options beyond `tsconfig.json`
   (a plugin option, and inline `// @flag` comments).
2. Adopt the notations, not the package: the package can't run on TypeScript 7, is about 7x
   slower here, and only type checks. Cuts already work; `@errors` and `@noErrors` map onto
   typecheck cleanly; `@filename` is the only expensive one and Bombshell doesn't use it.
3. `@errors` fences show misuse on purpose, so they likely shouldn't run (`no_run` semantics) unless
   annotated `run`.
4. `// ^? string` could become a type assertion, giving docs type tests for free.
