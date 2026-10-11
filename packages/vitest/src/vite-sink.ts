import type { LogRecord, Sink } from "@logtape/logtape";
import { renderMessage } from "@ddtds/core/log";

type ViteLogger = Record<"info" | "warn" | "error", (message: string) => void>;

/** Sends ddtds logs to Vite's logger, holding them until Vite resolves its config */
export class ViteSink {
  #logger: ViteLogger | undefined;
  readonly #pending: LogRecord[] = [];

  public readonly sink: Sink = (record) => {
    if (!this.#logger) {
      this.#pending.push(record);
      return;
    }
    const message = `[ddtds] ${renderMessage(record)}`;
    if (record.level === "error" || record.level === "fatal") this.#logger.error(message);
    else if (record.level === "warning") this.#logger.warn(message);
    else this.#logger.info(message);
  };

  public attach(logger: ViteLogger): void {
    this.#logger = logger;
    for (const record of this.#pending.splice(0)) this.sink(record);
  }
}
