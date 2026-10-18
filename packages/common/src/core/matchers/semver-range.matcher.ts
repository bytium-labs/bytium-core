import { SemverBoundsInterface } from "@core/interfaces/semver-bounds.interface";
import { SemverVersionType } from "@core/types/semver-version.type";

export class SemverRangeMatcher {
  static readonly #VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;
  static readonly #WILDCARD_PATTERN = /^[xX*]$/;

  static isValidVersion(version: string): boolean {
    return this.#VERSION_PATTERN.test(version);
  }

  static isValidRange(range: string): boolean {
    return this.#toBounds(range) !== undefined;
  }

  static satisfies(version: string, range: string): boolean {
    const parsed = this.#parseVersion(version);
    const bounds = this.#toBounds(range);

    if (!parsed || !bounds) {
      return false;
    }

    return (
      this.#compare(parsed, bounds.min) >= 0 &&
      (bounds.maxExclusive === undefined || this.#compare(parsed, bounds.maxExclusive) < 0)
    );
  }

  static #toBounds(range: string): SemverBoundsInterface | undefined {
    if (range.startsWith(">=")) {
      const min = this.#parseVersion(range.slice(2));

      return min && { min };
    }

    if (range.startsWith("^")) {
      const min = this.#parseVersion(range.slice(1));

      return min && { min, maxExclusive: this.#caretCeiling(min) };
    }

    if (range.startsWith("~")) {
      const min = this.#parseVersion(range.slice(1));

      return min && { min, maxExclusive: [min[0], min[1] + 1, 0] };
    }

    const exact = this.#parseVersion(range);

    if (exact) {
      return { min: exact, maxExclusive: [exact[0], exact[1], exact[2] + 1] };
    }

    return this.#wildcardBounds(range);
  }

  // a 0.x major treats the minor (and a 0.0.x minor the patch) as the breaking position
  static #caretCeiling([major, minor, patch]: SemverVersionType): SemverVersionType {
    if (major > 0) {
      return [major + 1, 0, 0];
    }

    return minor > 0 ? [0, minor + 1, 0] : [0, 0, patch + 1];
  }

  static #wildcardBounds(range: string): SemverBoundsInterface | undefined {
    const parts = range.split(".");
    const wildcardAt = parts.findIndex((part) => this.#WILDCARD_PATTERN.test(part));

    if (parts.length > 3 || wildcardAt === -1) {
      return undefined;
    }

    const fixed = parts.slice(0, wildcardAt);

    if (
      parts.slice(wildcardAt).some((part) => !this.#WILDCARD_PATTERN.test(part)) ||
      fixed.some((part) => !/^\d+$/.test(part))
    ) {
      return undefined;
    }

    const [major, minor] = fixed.map(Number);

    if (major === undefined) {
      return { min: [0, 0, 0] };
    }

    if (minor === undefined) {
      return { min: [major, 0, 0], maxExclusive: [major + 1, 0, 0] };
    }

    return { min: [major, minor, 0], maxExclusive: [major, minor + 1, 0] };
  }

  static #parseVersion(version: string): SemverVersionType | undefined {
    const match = this.#VERSION_PATTERN.exec(version);

    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : undefined;
  }

  static #compare(left: SemverVersionType, right: SemverVersionType): number {
    return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
  }
}
