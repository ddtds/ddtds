import {
  configureSync,
  getConfig,
  getLogger,
  type Logger,
  type LogRecord,
  type Sink,
} from "@logtape/logtape";

const LOG_LEVELS = ["silent", "error", "info", "debug", "trace"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

function isLogLevel(value: string): value is LogLevel {
  return LOG_LEVELS.some((level) => level === value);
}

export function parseLogLevel(value: string | undefined): LogLevel {
  if (value === undefined) return "info";

  const normalized = value.trim().toLowerCase();
  if (!isLogLevel(normalized)) {
    throw new Error(`Invalid log level "${value}". Must be one of: ${LOG_LEVELS.join(", ")}.`);
  }
  return normalized;
}

/** ddtds logs under the `ddtds` LogTape category, which applications can route themselves */
export const logger: Logger = getLogger(["ddtds"]);

/** A log line's text, without LogTape's timestamp and category */
export function renderMessage({ message }: LogRecord): string {
  return message.join("");
}

/** The LogTape config ddtds set, to tell it apart from an application's own */
let ours: ReturnType<typeof getConfig> = null;

/**
 * Sends ddtds logs at `level` and above to `sink`. Leaves LogTape alone when the application
 * configured it, so ddtds logs follow the application's own config.
 */
export function configureLogging(level: LogLevel, sink: Sink): void {
  const current = getConfig();
  if (current !== null && current !== ours) return;
  const route = level === "silent" ? { sinks: [] } : { lowestLevel: level, sinks: ["ddtds"] };
  configureSync({
    reset: true,
    sinks: { ddtds: sink },
    loggers: [
      { category: ["ddtds"], ...route },
      { category: ["logtape", "meta"], sinks: [] },
    ],
  });
  ours = getConfig();
}

export const consoleSink: Sink = (record) => {
  if (record.level === "error" || record.level === "fatal") console.error(renderMessage(record));
  else console.log(renderMessage(record));
};
