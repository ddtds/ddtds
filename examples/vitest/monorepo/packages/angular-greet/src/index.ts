import { Component, Input } from "@angular/core";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

@Component({
  selector: "ddtds-greeting",
  template: "<p>{{ message }}</p>",
})
export class Greeting {
  @Input({ required: true }) public name = "";

  protected get message(): string {
    return greet(this.name);
  }
}
