import type { ModuleSystem } from "./codegen/adapter.ts";
import type { Lang, OutputExtension, Parser } from "./languages.ts";

type LangInfo = { parser: Parser; extension: OutputExtension; module?: ModuleSystem };

const LANGS: Record<Lang, LangInfo> = {
  ts: { parser: "ts", extension: "ts" },
  typescript: { parser: "ts", extension: "ts" },
  js: { parser: "js", extension: "ts" },
  javascript: { parser: "js", extension: "ts" },
  tsx: { parser: "tsx", extension: "tsx" },
  jsx: { parser: "jsx", extension: "tsx" },
  tsrx: { parser: "tsrx", extension: "tsrx" },
  mjs: { parser: "js", extension: "ts", module: "esm" },
  mts: { parser: "ts", extension: "ts", module: "esm" },
  cjs: { parser: "js", extension: "ts", module: "cjs" },
  cts: { parser: "ts", extension: "ts", module: "cjs" },
};

export function isLang(s: string): s is Lang {
  return Object.hasOwn(LANGS, s);
}

export function parserOf(lang: Lang): Parser {
  return LANGS[lang].parser;
}

export function extensionOf(lang: Lang): OutputExtension {
  return LANGS[lang].extension;
}

export function moduleOfLang(lang: Lang): ModuleSystem | undefined {
  return LANGS[lang].module;
}

const ESM_PATH = /\.m[jt]s$/;
const CJS_PATH = /\.c[jt]s$/;

export function moduleOfPath(path: string): ModuleSystem | undefined {
  if (ESM_PATH.test(path)) return "esm";
  if (CJS_PATH.test(path)) return "cjs";
  return undefined;
}
