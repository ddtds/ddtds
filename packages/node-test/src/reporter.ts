import { encode, type Outcomes } from "@ddtds/test-utils";

type Failure = { name?: string; code?: string; cause?: { name?: string; code?: string } };
type TestEvent = {
  type: string;
  data?: { name?: string; file?: string; nesting?: number; details?: { error?: Failure } };
};

/** A file without any tests is reported as one passing test named after the file */
function isEmptyFile({ name, file, nesting }: NonNullable<TestEvent["data"]>): boolean {
  return nesting === 0 && name !== undefined && file?.endsWith(name) === true;
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
    const name = event.data?.name;
    if (name && event.type === "test:pass") {
      if (!event.data || !isEmptyFile(event.data)) outcomes[name] = "passed";
    } else if (name && event.type === "test:fail")
      outcomes[name] = status(event.data?.details?.error);
    else if (event.type === "test:plan") {
      yield encode(outcomes);
      outcomes = {};
    }
  }
}
