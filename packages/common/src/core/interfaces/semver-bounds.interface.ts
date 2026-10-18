import { SemverVersionType } from "@core/types/semver-version.type";

export interface SemverBoundsInterface {
  min: SemverVersionType;
  maxExclusive?: SemverVersionType;
}
