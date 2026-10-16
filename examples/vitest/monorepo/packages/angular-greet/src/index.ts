import { Component, Input } from "@angular/core";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

/**
 * Renders a greeting in a paragraph.
 *
 * ```ts run
 * import { render, screen } from "@testing-library/angular";
 * import { Greeting } from "@ddtds/angular-greet";
 *
 * await render(Greeting, { inputs: { name: "Grace" } });
 *
 * expect(screen.getByText("Hello, Grace!")).toBeInTheDocument();
 * ```
 */
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
