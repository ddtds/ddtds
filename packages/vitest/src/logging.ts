import {
  configureSync,
  getConfig,
  getTextFormatter,
  type LogLevel,
  type LogRecord,
  type Sink,
} from "@logtape/logtape";

type ViteLogger = Record<"info" | "warn" | "error", (message: string) => void>;

const format = getTextFormatter({ value: "bare", format: ({ message }) => message });

export interface ViteSink extends Sink {
  attach(logger: ViteLogger): void;
}

export function createViteSink(): ViteSink {
  let logger: ViteLogger | undefined;
  const pending: LogRecord[] = [];

  function sink(record: LogRecord): void {
    if (!logger) {
      pending.push(record);
      return;
    }
    const message = `[ddtds] ${format(record)}`;
    if (record.level === "error" || record.level === "fatal") logger.error(message);
    else if (record.level === "warning") logger.warn(message);
    else logger.info(message);
  }

  return Object.assign(sink, {
    attach(next: ViteLogger): void {
      logger = next;
      for (const record of pending.splice(0)) sink(record);
    },
  });
}

let ours: ReturnType<typeof getConfig> = null;

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
