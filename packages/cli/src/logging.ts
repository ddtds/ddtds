import { configureSync, getConsoleSink, getTextFormatter } from "@logtape/logtape";
import { resolveLogLevel } from "@ddtds/core";

const formatter = getTextFormatter({ value: "bare", format: ({ message }) => message });

export function configureLogging(): void {
  configureSync({
    sinks: { console: getConsoleSink({ formatter }) },
    loggers: [
      {
        category: ["ddtds"],
        lowestLevel: resolveLogLevel(),
        sinks: ["console"],
      },
      { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["console"] },
    ],
  });
}
