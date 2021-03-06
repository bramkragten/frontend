import { LovelaceConfig } from "../../../src/data/lovelace";
import { Entity } from "../../../src/fake_data/entity";
import { LocalizeFunc } from "../../../src/common/translations/localize";

export interface DemoConfig {
  index?: number;
  name: string;
  authorName: string;
  authorUrl: string;
  lovelace: (localize: LocalizeFunc) => LovelaceConfig;
  entities: (localize: LocalizeFunc) => Entity[];
  theme: () => { [key: string]: string } | null;
}
