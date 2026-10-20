import { configureSync, getLogger, resetSync } from "@logtape/logtape";
import { createLogRecorder } from "@logtape/testing/recorder";
import { afterEach, expect, test } from "vitest";
import { DdtSession } from "@ddtds/core";
import { parseCodeFences } from "@ddtds/core/fences";
import { defaultGlobals, vitestAdapter } from "./adapter.ts";
import { configureLogging } from "./logging.ts";

const CONFLICTING_ANNOTATIONS = /more than one annotation/;
const FENCE_MAPPING = /guide\.md.:1 -> .__ddtds__\/guide\.md_1/;

afterEach(() => resetSync());

test("routes core logs to the configured sink", () => {
  const recorder = createLogRecorder();
  configureLogging(recorder.sink, "info");
  parseCodeFences("```ts run fail\n1;\n```\n", "t.md");
  expect(recorder.records).toHaveLength(1);
  recorder.assertLogged({ level: "warning", message: CONFLICTING_ANNOTATIONS });
});

test("debug logs where each fence is generated", () => {
  const recorder = createLogRecorder();
  configureLogging(recorder.sink, "debug");
  const sources = new Map([["/root/guide.md", "```ts run\n1;\n```\n"]]);
  DdtSession.fromSources(vitestAdapter(defaultGlobals), sources, "/root");
  expect(recorder.records.length).toBeGreaterThan(0);
  recorder.assertLogged({ level: "debug", message: FENCE_MAPPING });
});

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
  configureLogging(ours.sink, "info");
  getLogger(["ddtds", "test"]).debug("routed by the app");
  app.assertLogged({ level: "debug", message: "routed by the app" });
  expect(ours.records).toEqual([]);
});
