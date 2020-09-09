import { D3Grapher } from "./zha-d3-grapher";
import { Zag } from "./zha-zag";
import { ZagDisplayConfig } from "./zha-zag-display-config";
import { Zig } from "./zha-zig";
import { ZigDisplayConfig } from "./zha-zig-display-config";

export enum GrapherType {
  VIS = "vis",
  D3 = "d3",
}

export interface Grapher {
  setData(zigs: Array<Zig>, zags: Array<Zag>): void;
  setSVGContainer(container: SVGSVGElement): void;
  updateConfig(
    zigDisplayConfig: ZigDisplayConfig,
    zagDisplayConfig: ZagDisplayConfig
  ): void;
  extractLayout(): Array<GrapherLayout>;
  injectLayout(_grapherLayout: Array<GrapherLayout>): void;
  resize(): void;
}

// Used to hold the layout of locked zigs to be saved externally
export interface GrapherLayout {
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
