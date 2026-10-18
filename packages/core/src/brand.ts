declare const tag: unique symbol;

/** A value only `brand` can make, so plain values of the same shape do not fit */
export type Brand<Value, Name extends string> = Value & { readonly [tag]: Name };

export function brand<Branded extends Brand<unknown, string>>(
  value: Omit<Branded, typeof tag>,
): Branded {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return value as Branded;
}
