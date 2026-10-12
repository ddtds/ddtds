import { parseLogLevel, type LogLevel } from "@logtape/logtape";

export type { LogLevel };

export function resolveLogLevel(fallback?: LogLevel): LogLevel {
  return parseLogLevel(process.env.DDT_LOG_LEVEL ?? fallback ?? "info");
}
