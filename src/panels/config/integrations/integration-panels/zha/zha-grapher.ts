import { D3Grapher } from "./zha-d3-grapher";
import { Zag } from "./zha-zag";
// import { ZagDisplayConfig } from "./zha-zag-display-config";
import { Zig } from "./zha-zig";
// import { ZigDisplayConfig } from "./zha-zig-display-config";

export enum GrapherType {
  VIS = "vis",
  D3 = "d3",
  CYTOSCAPE = "cytoscape",
}

export interface Grapher {
  injectData(zigs: Array<Zig>, zags: Array<Zag>): void;
  setContainer(container: HTMLElement): void;
  /*   updateConfig(
    zigDisplayConfig: ZigDisplayConfig,
    zagDisplayConfig: ZagDisplayConfig
  ): void; */
  extractPositions(): Array<GrapherZigPosition>;
  injectPositions(_grapherLayout: Array<GrapherZigPosition>): void;
  resize(): void;
}

// Used to hold the layout of locked zigs to be saved externally
export interface GrapherZigPosition {
  id: string;
  x: number;
  y: number;
}

export class GrapherFactory {
  public static create(grapherType: string): Grapher | undefined {
    switch (grapherType) {
      case GrapherType.D3:
        return new D3Grapher();

      default:
        return undefined;
    }
  }
}
