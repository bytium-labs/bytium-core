import { Transferable } from "@bytium-core/common";

/** An immutable 2D vector; every operation returns a new vector. */
@Transferable()
export class Vector2 {
  constructor(
    public x: number,
    public y: number,
  ) {}

  /** Builds a vector from an `[x, y]` tuple. */
  static fromArray([x, y]: number[]): Vector2 {
    return new Vector2(x, y);
  }

  /** Builds a vector from a plain `{ x, y }` object. */
  static fromSimpleObject(obj: { x: number; y: number }): Vector2 {
    return new Vector2(obj.x, obj.y);
  }

  /** Returns the vector as an `[x, y]` tuple. */
  toArray(): [number, number] {
    return [this.x, this.y];
  }

  /** Returns the vector as a plain `{ x, y }` object. */
  toSimpleObject(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /** Component-wise sum with `vector`. */
  add(vector: Vector2): Vector2 {
    return new Vector2(this.x + vector.x, this.y + vector.y);
  }

  /** Component-wise difference with `vector`. */
  subtract(vector: Vector2): Vector2 {
    return new Vector2(this.x - vector.x, this.y - vector.y);
  }

  /** Scales the vector by `scalar`. */
  multiply(scalar: number): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  /** Divides the vector by `scalar`. */
  divide(scalar: number): Vector2 {
    return new Vector2(this.x / scalar, this.y / scalar);
  }

  /** Dot product with `vector`. */
  dot(vector: Vector2): number {
    return this.x * vector.x + this.y * vector.y;
  }

  /** 2D cross product with `vector` - the scalar z-component of the 3D cross. */
  cross(vector: Vector2): number {
    return this.x * vector.y - this.y * vector.x;
  }

  /** Linearly interpolates toward `vector` by `t` (0 returns this, 1 returns `vector`). */
  lerp(vector: Vector2, t: number): Vector2 {
    return new Vector2(this.x + (vector.x - this.x) * t, this.y + (vector.y - this.y) * t);
  }

  /** Squared distance to `vector` - cheaper than {@link distanceTo} when only comparing distances. */
  distanceToSquared(vector: Vector2): number {
    const dx = this.x - vector.x;
    const dy = this.y - vector.y;

    return dx * dx + dy * dy;
  }

  /** Euclidean distance to `vector`. */
  distanceTo(vector: Vector2): number {
    return Math.sqrt(this.distanceToSquared(vector));
  }

  /** Magnitude of the vector. */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  /** Unit vector in the same direction, or a zero vector when the length is 0. */
  normalize(): Vector2 {
    const len = this.length();

    if (len === 0) return new Vector2(0, 0);

    return this.divide(len);
  }
}
