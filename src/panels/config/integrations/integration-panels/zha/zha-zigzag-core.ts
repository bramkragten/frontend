import {
  css,
  CSSResult,
  html,
  internalProperty,
  LitElement,
  property,
  PropertyValues,
  TemplateResult,
} from "lit-element";
import { applyThemesOnElement } from "../../../../../common/dom/apply_themes_on_element";
import { fireEvent } from "../../../../../common/dom/fire_event";
import { debounce } from "../../../../../common/util/debounce";
import "../../../../../components/entity/ha-state-label-badge";
import { HomeAssistant, Route } from "../../../../../types";
import { installResizeObserver } from "../../../../lovelace/common/install-resize-observer";
import { DataSource, DataSourceFactory } from "./zha-datasource";
import { Grapher, GrapherFactory, GrapherZigPosition } from "./zha-grapher";
import { Zag } from "./zha-zag";
import { Zig } from "./zha-zig";

const grapherContainerID = "grapherContainer";

export abstract class ZigzagCore extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;

  @property({ type: Boolean }) public isWide!: boolean;

  @property({ type: Boolean }) public narrow!: boolean;

  @property({ type: Object }) public route!: Route;

  @internalProperty() private _zigs: Zig[] = [];

  private _dataSource!: DataSource;

  private _grapher!: Grapher;

  private _initialised = false;

  private _resizeObserver?: ResizeObserver;

  private _zigLayout: Array<GrapherZigPosition> = [];

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

  private async _initialise(): Promise<boolean> {
    // Guard against double initialisation.
    if (this._initialised) {
      return;
    }

    // Initalise the Grapher.
    this._grapher.setContainer(
      this.shadowRoot!.getElementById(grapherContainerID)! as HTMLElement
    );

    // Load the data.
    const {zigs, zags} = await this._dataSource.fetchData();
    
    this._zigs = zigs;

    this._grapher.injectData(this._zigs, zags);

    // Inject the zig layout if there is one
    if (Array.isArray(this._zigLayout)) {
      this._grapher.injectPositions(this._zigLayout);
      this._zigLayout = [];
    }

    this._initialised = true;

    this._attachObserver(this._HTMLElement.parentElement as HTMLElement);
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
    this._initialise();
  }

  protected render(): TemplateResult {
    return html`
      <div id="${grapherContainerID}" class="zigzag">
        ${this._zigs.map(
          (zig) =>
            html`<ha-state-label-badge
              .hass=${this.hass}
              .state=${this.hass.states[zig.primary_entity as string]}
              @click=${this._showMoreInfo}
              class="zig"
            ></ha-state-label-badge>`
        )}
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
      .zigzag {
        display: block;
        height: 100%;
        width: 100%;
      }

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
