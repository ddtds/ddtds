import { configureSync, resetSync } from "@logtape/logtape";
import { afterEach, expect, test } from "vitest";
import { configureLogging, logger, renderMessage } from "./logger.ts";

afterEach(() => resetSync());

function collect(): {
  lines: string[];
  sink: (record: Parameters<typeof renderMessage>[0]) => void;
} {
  const lines: string[] = [];
  return { lines, sink: (record) => void lines.push(`${record.level}: ${renderMessage(record)}`) };
}

test("sends ddtds logs at the level and above to the sink", () => {
  const { lines, sink } = collect();
  configureLogging("info", sink);
  logger.debug("hidden");
  logger.info("shown");
  logger.error("also shown");
  expect(lines).toEqual(["info: shown", "error: also shown"]);
});

test("silent sends nothing", () => {
  const { lines, sink } = collect();
  configureLogging("silent", sink);
  logger.error("hidden");
  expect(lines).toEqual([]);
});

test("leaves LogTape alone when the application configured it", () => {
  const app = collect();
  configureSync({
    sinks: { app: app.sink },
    loggers: [
      { category: ["ddtds"], sinks: ["app"] },
      { category: ["logtape", "meta"], sinks: [] },
    ],
  });
  const ours = collect();
  configureLogging("info", ours.sink);
  logger.info("routed by the app");
  expect({ app: app.lines, ours: ours.lines }).toEqual({
    app: ["info: routed by the app"],
    ours: [],
  });
});
