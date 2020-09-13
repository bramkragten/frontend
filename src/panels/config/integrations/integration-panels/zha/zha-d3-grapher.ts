/* eslint-disable no-console */
import {
  forceCenter,
  ForceCenter,
  forceCollide,
  forceLink,
  forceSimulation,
  Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";
import Panzoom, { PanzoomObject, PanzoomOptions } from "@panzoom/panzoom";
import { HaStateLabelBadge } from "../../../../../components/entity/ha-state-label-badge";
import type { Grapher, GrapherZigPosition } from "./zha-grapher";
import type { Zag } from "./zha-zag";
import type { Zig } from "./zha-zig";
/**
 * Convienience alias for using d3 types.
 */
interface ZigDatum extends SimulationNodeDatum, Zig {}
/**
 * Convienience alias for using d3 types.
 */
interface ZagDatum extends SimulationLinkDatum<ZigDatum> {
  // Holds the svg element used to hold the Zig in the display.
  svgG?: SVGGElement;
  svgPath?: SVGPathElement;
  // Some Zags are bidirectional, this array allows us to hold 1 or 2 for each ZagDatum.
  zags: Array<Zag>;
}

/**
 *  Various constants used to configure the D3 simulation
 */
const _d3AlphaRestartValue = 0.3;
const _d3AlphaMin = 0.01;
const _d3AlphaDecay = 0.04;
const _d3RepelRadius = 200;
// const _d3BoundaryBorder = 50;

/**
 *  Used to configure the class of a Zag element so it can be styled differently based on LQI.
 
 */
const thresholdLowerLQI = 100;
const thresholdUpperLQI = 200;
const zagLQIPoor = "zag-lqi-poor";
const zagLQIModerate = "zag-lqi-moderate";
const zagLQIGood = "zag-lqi-good";

/**
 * Uses part of the d3 javascript suite to calculate layouts of Zigs & Zags.
 * The rendering of Zigs is left to Lovelace, the grapher updates the positions
 * of Zigs using CSS left & top values.
 * Zags are drawn from scratch using svg.
 */
export class D3Grapher implements Grapher {
  _d3ZagDatums: Array<ZagDatum> = [];

  _d3ZigDatums: Array<ZigDatum> = [];

  _divContainer?: HTMLElement;

  _height: any;

  _panzoom?: PanzoomObject;

  _simulation?: Simulation<ZigDatum, undefined>;

  // This is the SVGdotJS Dom.
  _svgContainer?: SVGSVGElement;

  _width: any;

  private _applySimulation() {
    // If we do not have a simulation running then exit.
    if (!this._simulation) {
      return;
    }

    // We iterate through the Zigs.
    this._d3ZigDatums.forEach((_zigD: ZigDatum) => {
      if (_zigD.badge) {
        // Constrain the Zig position to fall within the container.
        this._constrainZigPosition(_zigD);
        // Zigs are positioned using style absolute positioning.
        this._updateZigPosition(_zigD);
      }

      // We iterate through the Zags, drawing them.
      this._d3ZagDatums.forEach((_zagD) => {
        this._updateZag(_zagD);
      });
    });
  }

  private _attachDrag() {
    console.log("D3Grapher -> _attachDrag -> unimplemented");
  }

  private _attachMouseOver() {
    //
    this._d3ZigDatums.forEach((_zigD: ZigDatum) => {
      if (_zigD.badge) {
        _zigD.badge.onmouseover = (event) => this._handleMouseOver(event);
        _zigD.badge.onmouseleave = (event) => this._handleMouseLeave(event);
      }
    });
  }

  private _attachPanZoom() {
    console.log("D3Grapher -> _attachPanZoom -> unimplemented");
    /*     // Setup pan & zoom
    this._panzoom = Panzoom(this._divContainer!, {
      maxScale: 10,
    }); */
  }

  private _biZagPath(zagD: ZagDatum): string {
    // For a bi-zag, we draw two curves.
    // We need to calculate the position of the control point with some fancy maths.
    // Code adapted from https://stackoverflow.com/questions/49274176/how-to-create-a-curved-svg-path-between-two-points/49286885#49286885
    const _source = zagD.source as ZigDatum;
    const _target = zagD.target as ZigDatum;
    // Distance of control point from mid-point of line:
    const _offsetCP = 50;
    // Calculate mid-point of the line between the two Zig.
    const _mpx = (_source.x! + _target.x!) * 0.5;
    const _mpy = (_source.y! + _target.y!) * 0.5;

    // Calculate the angle of the perpendicular to this line:
    const _theta =
      Math.atan2(_target.y! - _source.y!, _target.x! - _source.x!) -
      Math.PI / 2;

    // Calculate the location of control points.
    const _cp1x = _mpx + _offsetCP * Math.cos(_theta);
    const _cp1y = _mpy + _offsetCP * Math.sin(_theta);
    const _cp2x = _mpx - _offsetCP * Math.cos(_theta);
    const _cp2y = _mpy - _offsetCP * Math.sin(_theta);

    // Assemble the path for the two curved lines.
    return `M${_source.x!},${_source.y!} Q${_cp1x},${_cp1y} ${_target.x!},${_target.y!} Q${_cp2x},${_cp2y} ${_source.x!},${_source.y!}`;
  }

  // Ensure a co-ordinate falls within a min & max
  private _constrainWithinBoundary(
    coordinate: number,
    low: number,
    high: number
  ): number {
    return Math.max(low, Math.min(high - low, coordinate));
  }

  private _constrainZigPosition(_zigD: ZigDatum) {
    _zigD.x = this._constrainWithinBoundary(
      _zigD.x as number,
      _zigD.badge.clientWidth / 2,
      this._width - _zigD.badge.clientWidth / 2
    );

    _zigD.y = this._constrainWithinBoundary(
      _zigD.y as number,
      _zigD.badge.clientWidth / 2,
      this._height - _zigD.badge.clientWidth / 2
    );
  }

  /**
   *
   * Create the Zag element structure.
   * The actual path command is created later.
   */
  private _createZagElement(zagD: ZagDatum) {
    // Create the common svg elements we need
    const _svgG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const _svgPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );

    this._svgContainer!.appendChild(_svgG);
    _svgG.appendChild(_svgPath);

    _svgG.classList.add("zag");
    _svgPath.classList.add("zagpath");

    // Set class based on LQI value.
    let _lqiClass = zagLQIPoor;
    if (zagD.zags[0].lqi_to > thresholdUpperLQI) {
      _lqiClass = zagLQIGood;
    } else if (zagD.zags[0].lqi_to > thresholdLowerLQI) {
      _lqiClass = zagLQIModerate;
    }
    _svgPath.classList.add(_lqiClass);

    // Store the elements in the Zag for easier reference when we update it.
    zagD.svgPath = _svgPath;
    zagD.svgG = _svgG;
  }

  private _createZagLabels(zagD: ZagDatum) {
    // Labels for uni zigs.
    // TODO - ensure the label orientation is correct.
    zagSelection
      .filter((_zagD: ZagDatum) => _zagD.zags.length === 1)
      .append("text")
      .classed("zag-label", true)
      .append("textPath")
      .attr("href", (_zagD: ZagDatum) => `#zagPath-${_zagD.index}-uni`)
      .style("text-anchor", "end")
      .attr("startOffset", "80%")
      .text((_zagD: ZagDatum) => _zagD.zags[0].relation);

    // The first label for a bi zag.
    zagSelection
      .filter((_zagD: ZagDatum) => _zagD.zags.length === 2)
      .append("text")
      .classed("zag-label", true)
      .append("textPath")
      .attr("href", (_zagD: ZagDatum) => `#zagPath-${_zagD.index}-bi`)
      .style("text-anchor", "end")
      .attr("startOffset", "40%")
      .text((_zagD: ZagDatum) => _zagD.zags[0].relation);

    // The second label for a bi zag.
    zagSelection
      .filter((_zagD: ZagDatum) => _zagD.zags.length === 2)
      .append("text")
      .classed("zag-label", true)
      .append("textPath")
      .attr("href", (_zagD: ZagDatum) => `#zagPath-${_zagD.index}-bi`)
      .style("text-anchor", "end")
      .attr("startOffset", "90%")
      .text((_zagD: ZagDatum) => _zagD.zags[1].relation);
  }

  private _handleMouseLeave(event) {
    const _badge: HaStateLabelBadge = event.currentTarget;

    _badge.parentElement!.classList.remove("dim");

    this._d3ZagDatums.forEach((_zagD) => {
      if ((_zagD.source as Zig).badge === _badge) {
        _zagD.svgG?.classList.remove("highlight");
        (_zagD.target as Zig).badge.classList.remove("highlight");
      } else if ((_zagD.target as Zig).badge === _badge) {
        _zagD.svgG?.classList.remove("highlight");
        (_zagD.source as Zig).badge.classList.remove("highlight");
      }
    });

    _badge.classList.remove("highlight");
  }

  /**
   * mouseOver behaviour is to focus on the Zig.
   * The Zig itself, all the connected Zags and the Zigs at the other end of the Zag
   * are all highlighted.
   * The other Zigs & Zags are dimmed.
   * This is achieved by setting/resetting highlight & dim classes on various elements.
   */
  private _handleMouseOver(event) {
    const _badge: HaStateLabelBadge = event.currentTarget;
    // Highlight the current Zig.
    _badge.classList.add("highlight");

    // Highlight any connected Zags and the Zig at the other end.
    this._d3ZagDatums.forEach((_zagD) => {
      if ((_zagD.source as Zig).badge === _badge) {
        _zagD.svgG?.classList.add("highlight");
        (_zagD.target as Zig).badge.classList.add("highlight");
      } else if ((_zagD.target as Zig).badge === _badge) {
        _zagD.svgG?.classList.add("highlight");
        (_zagD.source as Zig).badge.classList.add("highlight");
      }
    });

    // Dim everything else.
    _badge.parentElement!.classList.add("dim");
  }

  private _importData(zigs: Array<Zig>, zags: Array<Zag>) {
    // Create the zig & zag object structures d3 requires.
    zigs.forEach((_zig: Zig) => {
      // d3 requires a unique id for each ZigDatum so we will add it.
      this._d3ZigDatums.push({ ..._zig, id: _zig.ieee });
    });

    //
    zags.forEach((_zagToAdd: Zag) => {
      // Check to see if we already have a ZagDatum for the opposite direction
      let _existingZagD: ZagDatum | undefined = this._d3ZagDatums.find(
        (_zagD: ZagDatum) =>
          _zagD.zags[0].from === _zagToAdd.to &&
          _zagD.zags[0].to === _zagToAdd.from
      );

      // If nothing found then create a new one and add it
      if (!_existingZagD) {
        _existingZagD = {
          source: _zagToAdd.from,
          target: _zagToAdd.to,
          zags: [],
        };
        // Create a new ZagDatum and add to our collection
        this._d3ZagDatums.push(_existingZagD);
      }

      // By now we have either found or added a new ZagDatum.
      // We add the _zagToAdd to it.
      _existingZagD.zags.push(_zagToAdd);
    });
  }

  private _initSimulation() {
    // If we have yet to receive the size of the bounding container, exit.
    if (this._width === 0 || this._height === 0) {
      return;
    }

    // clean up the old simulation if there is one.
    if (this._simulation) {
      this._simulation.stop();
    }

    // Create and configure the d3 simulation/force model.
    this._simulation = forceSimulation(this._d3ZigDatums) // https://github.com/d3/d3-force
      .alphaMin(_d3AlphaMin) // When alpha drops below this, the simulation stops.
      .alphaDecay(_d3AlphaDecay)
      .force(
        "center",
        forceCenter()
          .x(this._width / 2)
          .y(this._height / 2)
      ) // Zigs will tend towards the centre. */ // Sets how much the alpha value drops per iteration of the simulation. // Zags have a spring-like force that pull Zigs together. // Zigs will repel one another.
      .force(
        "link",
        forceLink(this._d3ZagDatums).id((zig) => (zig as ZigDatum).id)
      )
      .force("repel", forceCollide().radius(_d3RepelRadius).strength(1));
    // When the simulation ticks, we update the positions of Zigs & Zags.
    this._simulation.on("tick", () => {
      this._applySimulation();
    });
  }

  private _uniZagPath(zagD: ZagDatum): string {
    return `M${(zagD.source as ZigDatum).x as number},${
      (zagD.source as ZigDatum).y as number
    } L${(zagD.target as ZigDatum).x as number},${
      (zagD.target as ZigDatum).y as number
    }`;
  }

  private _updateSimulation() {
    if (this._simulation !== undefined) {
      this._simulation!.force<ForceCenter<ZigDatum>>("center")!
        .x(this._width / 2)
        .y(this._height / 2);

      this._simulation.alpha(_d3AlphaRestartValue).restart();
    } else {
      this._initSimulation();
    }
  }

  private _updateZag(zagD: ZagDatum): void {
    const _isBiZag: boolean = zagD.zags.length === 2;

    // Generate the svg path.
    const _path = _isBiZag ? this._biZagPath(zagD) : this._uniZagPath(zagD);

    // We add or update the SVG path element for the Zag.
    // If the Zag has no existing path element, then create one.
    if (zagD.svgG === undefined) {
      this._createZagElement(zagD);
    }
    zagD.svgPath!.setAttribute(
      "id",
      `${zagD.index}-${_isBiZag ? "bi" : "uni"}`
    );
    zagD.svgPath!.setAttribute("d", _path);

    // Add the labels.
  }

  /**
   * Apply the position of the Zag by adjusting the style top & left of its badge element.
   *
   */
  private _updateZigPosition(_zigD: ZigDatum) {
    _zigD.badge.setAttribute(
      "style",
      `position: absolute; top: ${
        _zigD.y! - _zigD.badge.clientWidth / 2
      }px; left: ${_zigD.x! - _zigD.badge.clientWidth / 2}px`
    );
  }

  // Provide the layout data, intended to be used to persist the layout externally.
  public extractPositions(): Array<GrapherZigPosition> {
    // Return the coordinates of all locked zigs.
    const _zigLayout: Array<GrapherZigPosition> = [];
    this._d3ZigDatums.forEach((_zigD: ZigDatum) => {
      // if fx & fy then the zig is locked and we will include it in the returned layout data.
      if (_zigD.fx && _zigD.fy) {
        _zigLayout.push({ id: _zigD.id, x: _zigD.fx, y: _zigD.fy });
      }
    });
    return _zigLayout;
  }

  public injectData(zigsIn: Array<Zig>, zagsIn: Array<Zag>): void {
    this._importData(zigsIn, zagsIn);

    this._attachMouseOver();
    this._attachDrag();
    this._attachPanZoom();

    // Setup the force simulation.
    this._initSimulation();
  }

  // Inject the layout data and update zigs.
  public injectPositions(layout: Array<GrapherZigPosition>): void {
    try {
      for (const _zigPosition of layout) {
        const _zigToLock: ZigDatum | undefined = this._d3ZigDatums!.find(
          (_zigD) => _zigD.id === _zigPosition.id
        );
        // If we have found the zig.
        if (_zigToLock !== undefined) {
          // Update the fx & fy positions of the zig.
          _zigToLock.fx = _zigPosition.x;
          _zigToLock.fy = _zigPosition.y;
        }
      }

      // Restart the simulation so that the graph is redrawn.
      if (this._simulation) {
        this._simulation.alpha(_d3AlphaRestartValue).restart();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(
        "Zigzag encoutered a problem restoring the layout data: D3Grapher -> injectLayout",
        layout,
        err
      );
    }
  }

  // If the container has been resized we need to modify some of the simulation settings and restart.
  public resize(): void {
    const _newWidth = this._divContainer!.getBoundingClientRect().width;
    const _newHeight = this._divContainer!.getBoundingClientRect().height;

    if (this._width !== _newWidth || this._height !== _newHeight) {
      this._width = _newWidth;
      this._height = _newHeight;
      this._updateSimulation();
    }
  }

  // Set the HTML container that contains the elements the Grapher will position.
  public setContainer(divContainer: HTMLElement): void {
    this._divContainer = divContainer;
    this._width = this._divContainer.getBoundingClientRect().width;
    this._height = this._divContainer.getBoundingClientRect().height;

    this._svgContainer = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );
    divContainer.appendChild(this._svgContainer);
    this._svgContainer.setAttribute("class", "zags");
  }
}
