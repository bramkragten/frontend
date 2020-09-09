import { HomeAssistant } from "../../../../../types";
import { ZHADataSource } from "./zha-zhadatasource";
import { Zag } from "./zha-zag";
import { Zig } from "./zha-zig";

enum DataSourceType {
  ZHA = "zha",
  DECONZ = "deconz",
  ZWAVE = "zwave",
}

export interface DataSource {
  fetchData(zigs: Array<Zig>, zags: Array<Zag>): Promise<boolean>;
}

export class DataSourceFactory {
  public static create(
    hass: HomeAssistant,
    dataSourceType: string
  ): DataSource | undefined {
    switch (dataSourceType) {
      case DataSourceType.ZHA:
        return new ZHADataSource(hass);

      default:
        return undefined;
    }
  }
}
