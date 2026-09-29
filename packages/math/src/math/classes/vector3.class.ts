import { Transferable } from "@bytium-core/common";

/** An immutable 3D vector; every operation returns a new vector. */
@Transferable()
export class Vector3 {
  constructor(
    public x: number,
    public y: number,
    public z: number,
  ) {}

  /** Builds a vector from an `[x, y, z]` tuple. */
  static fromArray([x, y, z]: number[]): Vector3 {
    return new Vector3(x, y, z);
  }

  /** Builds a vector from a plain `{ x, y, z }` object. */
  static fromSimpleObject(obj: { x: number; y: number; z: number }): Vector3 {
    return new Vector3(obj.x, obj.y, obj.z);
  }

  /** Returns the vector as an `[x, y, z]` tuple. */
  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  /** Returns the vector as a plain `{ x, y, z }` object. */
  toSimpleObject(): { x: number; y: number; z: number } {
    return { x: this.x, y: this.y, z: this.z };
  }

  /** Component-wise sum with `vector`. */
  add(vector: Vector3): Vector3 {
    return new Vector3(this.x + vector.x, this.y + vector.y, this.z + vector.z);
  }

  /** Component-wise difference with `vector`. */
  subtract(vector: Vector3): Vector3 {
    return new Vector3(this.x - vector.x, this.y - vector.y, this.z - vector.z);
  }

  /** Scales the vector by `scalar`. */
  multiply(scalar: number): Vector3 {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  /** Divides the vector by `scalar`. */
  divide(scalar: number): Vector3 {
    return new Vector3(this.x / scalar, this.y / scalar, this.z / scalar);
  }

  /** Dot product with `vector`. */
  dot(vector: Vector3): number {
    return this.x * vector.x + this.y * vector.y + this.z * vector.z;
  }

  /** Cross product with `vector`. */
  cross(vector: Vector3): Vector3 {
    return new Vector3(
      this.y * vector.z - this.z * vector.y,
      this.z * vector.x - this.x * vector.z,
      this.x * vector.y - this.y * vector.x,
    );
  }

  /** Linearly interpolates toward `vector` by `t` (0 returns this, 1 returns `vector`). */
  lerp(vector: Vector3, t: number): Vector3 {
    return new Vector3(
      this.x + (vector.x - this.x) * t,
      this.y + (vector.y - this.y) * t,
      this.z + (vector.z - this.z) * t,
    );
  }

  /** Squared distance to `vector` - cheaper than {@link distanceTo} when only comparing distances. */
  distanceToSquared(vector: Vector3): number {
    const dx = this.x - vector.x;
    const dy = this.y - vector.y;
    const dz = this.z - vector.z;

    return dx * dx + dy * dy + dz * dz;
  }

  /** Euclidean distance to `vector`. */
  distanceTo(vector: Vector3): number {
    return Math.sqrt(this.distanceToSquared(vector));
  }

  /** Magnitude of the vector. */
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  /** Unit vector in the same direction, or a zero vector when the length is 0. */
  normalize(): Vector3 {
    const len = this.length();

    if (len === 0) return new Vector3(0, 0, 0);

    return this.divide(len);
  }
}
