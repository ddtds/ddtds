import { getConsoleSink, getTextFormatter } from "@logtape/logtape";
import { configureLogging as configure } from "@ddtds/core";

const formatter = getTextFormatter({ value: "bare", format: ({ message }) => message });

export function configureLogging(): void {
  configure(getConsoleSink({ formatter }));
}
