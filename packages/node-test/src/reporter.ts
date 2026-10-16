import { resolve } from "node:path";
import { encode, framesOf, type Failures, type Outcomes } from "@ddtds/test-utils";

type Failure = {
  name?: string;
  code?: string;
  stack?: string;
  cause?: { name?: string; code?: string; stack?: string };
};
type TestData = {
  name?: string;
  file?: string;
  nesting?: number;
  details?: { error?: Failure };
};
type TestEvent = { type: string; data?: TestData };

function isEmptyFile({ name, file, nesting }: TestData): boolean {
  return nesting === 0 && name !== undefined && file !== undefined && resolve(name) === file;
}

function status(error?: Failure): string {
  if (!error) return "failed";
  const cause = error.cause;
  if (!cause) return error.name ?? "failed";
  return cause.code ? `${cause.name} ${cause.code}` : (cause.name ?? "failed");
}

export default async function* reporter(source: AsyncIterable<TestEvent>): AsyncGenerator<string> {
  let outcomes: Outcomes = {};
  let failures: Failures = {};
  for await (const event of source) {
    if (event.type === "test:plan") {
      yield encode(outcomes, failures);
      outcomes = {};
      failures = {};
      continue;
    }
    const data = event.data;
    if (!data?.name) continue;
    if (event.type === "test:pass") {
      if (!isEmptyFile(data)) outcomes[data.name] = "passed";
    } else if (event.type === "test:fail") {
      const error = data.details?.error;
      outcomes[data.name] = status(error);
      failures[data.name] = framesOf((error?.cause ?? error)?.stack, process.cwd());
    }
  }
}
