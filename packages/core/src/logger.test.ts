import { configureSync, getLogger, resetSync } from "@logtape/logtape";
import { createLogRecorder } from "@logtape/testing/recorder";
import { afterEach, expect, test } from "vitest";
import { configureLogging } from "./logger.ts";

afterEach(() => resetSync());

test("leaves LogTape alone when the application configured it", () => {
  const app = createLogRecorder();
  configureSync({
    sinks: { app: app.sink },
    loggers: [
      { category: ["ddtds"], sinks: ["app"] },
      { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["app"] },
    ],
  });
  const ours = createLogRecorder();
  configureLogging("info", ours.sink);
  getLogger(["ddtds", "test"]).debug("routed by the app");
  app.assertLogged({ level: "debug", message: "routed by the app" });
  expect(ours.records).toEqual([]);
});
