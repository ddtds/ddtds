import { LitElement, html, type TemplateResult } from "lit";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

export class DdtdsGreeting extends LitElement {
  public static override properties = { name: { type: String } };
  declare public name: string;

  public constructor() {
    super();
    this.name = "World";
  }

  public override render(): TemplateResult {
    return html`<p>${greet(this.name)}</p>`;
  }
}

customElements.define("ddtds-greeting", DdtdsGreeting);
