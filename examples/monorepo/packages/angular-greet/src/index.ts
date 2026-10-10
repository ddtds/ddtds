import { computed, type Signal } from "@angular/core";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

export function greeting(name: Signal<string>): Signal<string> {
  return computed(() => greet(name()));
}
