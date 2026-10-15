import { Component, Input } from "@angular/core";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

/**
 * Renders a greeting in a paragraph.
 *
 * ```ts run
 * import { createComponent } from "@angular/core";
 * import { createApplication } from "@angular/platform-browser";
 * import { Greeting } from "@ddtds/angular-greet";
 *
 * const app = await createApplication();
 * const greeting = createComponent(Greeting, { environmentInjector: app.injector });
 * greeting.setInput("name", "Grace");
 * greeting.changeDetectorRef.detectChanges();
 *
 * expect(greeting.location.nativeElement.textContent).toBe("Hello, Grace!");
 * app.destroy();
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
