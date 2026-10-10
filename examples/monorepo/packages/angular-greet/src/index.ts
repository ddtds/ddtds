import { Component, computed, input } from "@angular/core";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

@Component({
  selector: "ddtds-greeting",
  template: "<p>{{ message() }}</p>",
})
export class Greeting {
  public readonly name = input.required<string>();
  protected readonly message = computed(() => greet(this.name()));
}
