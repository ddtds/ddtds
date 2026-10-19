import { configureSync, parseLogLevel, type LogLevel, type Sink } from "@logtape/logtape";

export type { LogLevel };

export function resolveLogLevel(fallback?: LogLevel): LogLevel {
  return parseLogLevel(process.env.DDT_LOG_LEVEL ?? fallback ?? "info");
}

/** Sends ddtds logs to `sink` at the level from `DDT_LOG_LEVEL`, then `logLevel`, then `"info"`. */
export function configureLogging(sink: Sink, logLevel?: LogLevel): void {
  configureSync({
    reset: true,
    sinks: { ddtds: sink },
    loggers: [
      { category: ["ddtds"], lowestLevel: resolveLogLevel(logLevel), sinks: ["ddtds"] },
      { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["ddtds"] },
    ],
  });
}
