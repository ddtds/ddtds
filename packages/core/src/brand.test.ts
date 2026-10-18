import { expect, test } from "vitest";
import { brand, type Brand } from "./brand.ts";

type Meters = Brand<{ readonly value: number }, "Meters">;

test("brand keeps the value as it is", () => {
  const meters = brand<Meters>({ value: 3 });
  expect(meters).toEqual({ value: 3 });
});

test("a plain value of the same shape is not branded", () => {
  // @ts-expect-error only brand makes a Meters
  const plain: Meters = { value: 3 };
  expect(plain.value).toBe(3);
});

test("brands with different names do not mix", () => {
  type Feet = Brand<{ readonly value: number }, "Feet">;
  const feet = brand<Feet>({ value: 3 });
  // @ts-expect-error a Feet is not a Meters
  const meters: Meters = feet;
  expect(meters.value).toBe(3);
});
