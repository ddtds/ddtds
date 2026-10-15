import { LitElement, html, type TemplateResult } from "lit";
import { greet } from "@ddtds/greet";

export * from "@ddtds/greet";

/**
 * Renders a greeting in a paragraph.
 *
 * ```ts run
 * import { DdtdsGreeting } from "@ddtds/lit-greet";
 *
 * const el = new DdtdsGreeting();
 * el.name = "Grace";
 * document.body.append(el);
 * await el.updateComplete;
 *
 * expect(el.shadowRoot?.textContent).toBe("Hello, Grace!");
 * el.remove();
 * ```
 */
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
