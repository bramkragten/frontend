import {
  CSSResult,
  LitElement,
  PropertyValues,
  TemplateResult,
  css,
  html,
  internalProperty,
  property,
} from "lit-element";
import { applyThemesOnElement } from "../../../../../common/dom/apply_themes_on_element";
import { DataSource, DataSourceFactory } from "./zha-datasource";
import { Grapher, GrapherFactory, GrapherZigPosition } from "./zha-grapher";
import { HomeAssistant, Route } from "../../../../../types";
import type { HaStateLabelBadge } from "../../../../../components/entity/ha-state-label-badge";
import "../../../../../components/entity/ha-state-label-badge";
import { fireEvent } from "../../../../../common/dom/fire_event";

import { Zag } from "./zha-zag";
import { Zig } from "./zha-zig";
import { debounce } from "../../../../../common/util/debounce";
import { installResizeObserver } from "../../../../lovelace/common/install-resize-observer";

const grapherContainerID = "grapherContainer";

export abstract class ZigzagCore extends LitElement {
  @internalProperty() private _badges?: HaStateLabelBadge[] = [];

  private _dataSource!: DataSource;

  private _grapher!: Grapher;

  private _HTMLElement: HTMLElement | null = null;

  private _initialised = false;

  private _resizeObserver?: ResizeObserver;

  private _zags: Array<Zag> = [];

  private _zigLayout: Array<GrapherZigPosition> = [];

  private _zigs: Array<Zig> = [];

  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ type: Boolean }) public isWide!: boolean;

  @property({ type: Boolean }) public narrow!: boolean;

  @property({ type: Object }) public route!: Route;

  private async _attachObserver(_svgElement: HTMLElement): Promise<void> {
    if (!this._resizeObserver) {
      await installResizeObserver();
      this._resizeObserver = new ResizeObserver(
        debounce(() => this._resize(), 250, false)
      );
      // Watch for changes in size
      this._resizeObserver.observe(_svgElement);
    }
  }

  private _createBadge(zig: Zig) {
    // If the Zig has an entity, then we will use it to create a LovelaceBadge.
    // if (zig.primary_entity) {
    const element = document.createElement("ha-state-label-badge");
    if (element.localName !== "hui-error-card") {
      if (this.hass) {
        element.hass = this.hass;
        element.state = this.hass.states[zig.primary_entity as string];
        // Hook up the onClick handler.
        // The Grapher will hook up any events it wants to handle.
        element.onclick = this._showMoreInfo;
      }

      // Store the Badge element in the Zig so we can easily find it for updating its position.
      zig.badge = element;

      // Add a Zig class so we can easily style the badge.
      element.classList.add("zig");

      // Add the badge to our collection.
      this._badges = [...(this._badges as HaStateLabelBadge[]), zig.badge];
    }
    // }
  }

  private _createDatastore(): boolean {
    const _dataSource = DataSourceFactory.create(this.hass, "zha");
    if (_dataSource) {
      this._dataSource = _dataSource;
      return true;
    }
    return false;
  }

  private _createGrapher(): boolean {
    // Create a new Grapher
    const _grapher = GrapherFactory.create("d3");

    if (_grapher) {
      this._grapher = _grapher;
      return true;
    }

    return false;
  }

  private _initialise(): boolean {
    // Guard against double initialisation.
    if (this._initialised) {
      return true;
    }

    // Check to see if we can find the html element where the graph is to be displayed.
    if (this.shadowRoot) {
      this._HTMLElement = this.shadowRoot.getElementById(grapherContainerID);

      if (this._HTMLElement !== null && this._HTMLElement !== undefined) {
        // Initalise the Grapher.
        this._grapher.setContainer(
          (this._HTMLElement as unknown) as HTMLElement
        );

        // Load the data.
        // eslint-disable-next-line prettier/prettier
        this._dataSource.fetchData(this._zigs, this._zags).then(() => {
          // Create a set of badge entities, one for each zig.
          this._zigs.forEach((_zig: Zig) => {
            this._createBadge(_zig);
          });

          this._grapher.injectData(this._zigs, this._zags);

          // Inject the zig layout if there is one
          if (Array.isArray(this._zigLayout)) {
            this._grapher.injectPositions(this._zigLayout);
            this._zigLayout = [];
          }

          this._initialised = true;
        });

        this._attachObserver(this._HTMLElement.parentElement as HTMLElement);
        this.requestUpdate();
      }
    }
    return this._initialised;
  }

  private _resize() {
    if (this._grapher) {
      this._grapher.resize();
    }
  }

  private async _restoreZigLayout(): Promise<void> {
    // Ask for the zigzag-layout
    const _result = await this.hass!.callWS<{
      value: Array<GrapherZigPosition> | null;
    }>({
      type: "frontend/get_user_data",
      key: "zigzag-layout",
    });

    if (_result.value) {
      // If we are initalised then we inject the layout.
      if (this._initialised) {
        this._grapher.injectPositions(_result.value);
      } else {
        // otherwise we store it to be injected later.
        this._zigLayout = _result.value;
      }
    }
  }

  private _showMoreInfo(ev) {
    fireEvent(this, "hass-more-info", {
      entityId: ev.currentTarget.state.entity_id,
    });
  }

  public connectedCallback(): void {
    super.connectedCallback();

    if (!this._createDatastore() || !this._createGrapher()) {
      // TODO - raise an error.
    }

    this._restoreZigLayout();
  }

  public async disconnectedCallback(): Promise<void> {
    super.disconnectedCallback();
    this._initialised = false;

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();

      if (this._grapher) {
        const _layout: Array<GrapherZigPosition> = this._grapher.extractPositions();

        // Store Zigzag data
        await this.hass!.callWS({
          type: "frontend/set_user_data",
          key: "zigzag-layout",
          value: _layout,
        });
      }
    }
  }

  // Called the first time the zigzag card is put into the DOM.
  protected firstUpdated(changedProps: PropertyValues): void {
    super.firstUpdated(changedProps);
    if (this._initialise()) {
      // TODO - How to handle failure.
    }
  }

  protected render(): TemplateResult | void {
    return html`
      <div
        id="${grapherContainerID}"
        class="zigzag"
        style="display: block; height: 100%; width: 100%;"
      >
        ${this._badges}
      </div>
    `;
  }

  // Called when connectedCallback is invoked.
  protected shouldUpdate(): boolean {
    // TODO - Change so we only update if required. */
    return true;
  }

  public static get styles(): CSSResult {
    return css`
      svg.zags {
        width: 100%;
        height: 100%;
      }

      .zagpath {
        stroke-width: 3;
        fill: transparent;
      }

      .zag-lqi-poor {
        stroke: var(--error-color);
      }

      .zag-lqi-moderate {
        stroke: var(--warning-color);
      }

      .zag-lqi-good {
        stroke: var(--success-color);
      }

      div.zigzag.dim .zag:not(.highlight) {
        opacity: 0.1;
      }

      div.zigzag.dim .zig:not(.highlight) {
        filter: blur(5px);
      }
    `;
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);
    if (!this.hass) {
      return;
    }

    // If we have children elements then let them know about the update.
    if (this._badges && changedProps.has("hass")) {
      for (const element of this._badges) {
        element.hass = this.hass;
      }
    }

    const oldHass = changedProps.get("hass") as HomeAssistant | undefined;

    if (!oldHass || oldHass.themes !== this.hass.themes) {
      applyThemesOnElement(this, this.hass.themes);
    }
  }
}
