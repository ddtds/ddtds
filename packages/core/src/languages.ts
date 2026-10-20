/** Code fence languages supported by the fence parser. */
export type Lang =
  | "ts"
  | "typescript"
  | "js"
  | "javascript"
  | "tsx"
  | "jsx"
  | "tsrx"
  | "mjs"
  | "mts"
  | "cjs"
  | "cts";

/** Parser used for a code fence language. */
export type Parser = "ts" | "js" | "tsx" | "jsx" | "tsrx";

/** Extension of the generated test file for a code fence language. */
export type OutputExtension = "ts" | "tsx" | "tsrx";
