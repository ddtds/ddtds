import { configureSync, getConsoleSink, getTextFormatter, parseLogLevel } from "@logtape/logtape";

/** Prints only the message, without LogTape's timestamp, level and category */
const formatter = getTextFormatter({ value: "bare", format: ({ message }) => message });

/** Sends logs under the `ddtds` category to the console, at `DDT_LOG_LEVEL` or above. */
export function configureLogging(): void {
  configureSync({
    sinks: { console: getConsoleSink({ formatter }) },
    loggers: [
      {
        category: ["ddtds"],
        lowestLevel: parseLogLevel(process.env.DDT_LOG_LEVEL ?? "info"),
        sinks: ["console"],
      },
      { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["console"] },
    ],
  });
}
