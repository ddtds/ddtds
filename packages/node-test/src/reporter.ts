import { resolve } from "node:path";
import { encode, type Outcomes } from "@ddtds/test-utils";

type Failure = { name?: string; code?: string; cause?: { name?: string; code?: string } };
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
  for await (const event of source) {
    if (event.type === "test:plan") {
      yield encode(outcomes);
      outcomes = {};
      continue;
    }
    const data = event.data;
    if (!data?.name) continue;
    if (event.type === "test:pass") {
      if (!isEmptyFile(data)) outcomes[data.name] = "passed";
    } else if (event.type === "test:fail") {
      outcomes[data.name] = status(data.details?.error);
    }
  }
}
