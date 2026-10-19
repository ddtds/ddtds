import {
  configureSync,
  getLogger,
  parseLogLevel,
  type LogLevel,
  type Sink,
} from "@logtape/logtape";

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
  const source =
    process.env.DDT_LOG_LEVEL !== undefined
      ? "DDT_LOG_LEVEL"
      : logLevel === undefined
        ? "the default"
        : "the logLevel option";
  getLogger(["ddtds", "logging"]).debug("log level is {level} from {source}", () => ({
    level: resolveLogLevel(logLevel),
    source,
  }));
}
