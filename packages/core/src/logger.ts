import {
  configureSync,
  getConfig,
  getConsoleSink,
  getTextFormatter,
  type LogLevel,
  type Sink,
} from "@logtape/logtape";

/** Prints only the message, without LogTape's timestamp, level and category */
export const consoleSink: Sink = getConsoleSink({
  formatter: getTextFormatter({ value: "bare", format: ({ message }) => message }),
  // console.trace would print a stack trace
  levelMap: {
    trace: "debug",
    debug: "debug",
    info: "info",
    warning: "warn",
    error: "error",
    fatal: "error",
  },
});

/** The LogTape config ddtds set, to tell it apart from an application's own */
let ours: ReturnType<typeof getConfig> = null;

/**
 * Sends logs under the `ddtds` LogTape category at `level` and above to `sink`. Leaves LogTape
 * alone when the application configured it, so ddtds logs follow the application's own config.
 */
export function configureLogging(level: LogLevel, sink: Sink): void {
  const current = getConfig();
  if (current !== null && current !== ours) return;
  configureSync({
    reset: true,
    sinks: { ddtds: sink },
    loggers: [
      { category: ["ddtds"], lowestLevel: level, sinks: ["ddtds"] },
      { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["ddtds"] },
    ],
  });
  ours = getConfig();
}
