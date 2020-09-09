import "../../../../../layouts/hass-tabs-subpage";

import { TemplateResult, customElement, html } from "lit-element";

import { ZigzagCore } from "./zha-zigzag-core";
import { zhaTabs } from "./zha-config-dashboard";
@customElement("zha-zigzag-page")
export class ZHAZigzagPage extends ZigzagCore {
  protected render(): TemplateResult {
    return html`
      <hass-tabs-subpage
        .hass=${this.hass}
        .narrow=${this.narrow}
        .route=${this.route}
        .tabs=${zhaTabs}
        back-path="/config/integrations"
      >
        ${super.render()}
      </hass-tabs-subpage>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "zha-zigzag-page": ZHAZigzagPage;
  }
}
