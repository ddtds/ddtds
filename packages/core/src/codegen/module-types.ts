import type { SourceMap } from "magic-string";
import type { ModuleSystem } from "./adapter.ts";

export type GeneratedModule = { code: string; map: SourceMap; module: ModuleSystem };
