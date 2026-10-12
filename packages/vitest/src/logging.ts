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

/**
 * Sends ddtds logs to Vite's logger, holding them until Vite resolves its config.
 */
export class ViteSink {
  #logger: ViteLogger | undefined;
  readonly #pending: LogRecord[] = [];

  public readonly sink: Sink = (record) => {
    const logger = this.#logger;
    if (!logger) {
      this.#pending.push(record);
      return;
    }
    const message = `[ddtds] ${format(record)}`;
    if (record.level === "error" || record.level === "fatal") logger.error(message);
    else if (record.level === "warning") logger.warn(message);
    else logger.info(message);
  };

  public attach(logger: ViteLogger): void {
    this.#logger = logger;
    for (const record of this.#pending.splice(0)) this.sink(record);
  }
}

/** The LogTape config ddtds set, to tell it apart from an application's own */
let ours: ReturnType<typeof getConfig> = null;

/**
 * Sends logs under the `ddtds` category at `level` and above to `sink`. Leaves LogTape
 * alone when the application configured it, so ddtds logs follow the application's config.
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
