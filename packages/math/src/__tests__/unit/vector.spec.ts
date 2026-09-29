import { Vector2, Vector3 } from "@math";

describe("Vector2", () => {
  it("should convert to and from arrays and simple objects", () => {
    expect(Vector2.fromArray([1, 2]).toArray()).toEqual([1, 2]);
    expect(Vector2.fromSimpleObject({ x: 1, y: 2 }).toSimpleObject()).toEqual({ x: 1, y: 2 });
  });

  it("should add, subtract, multiply and divide", () => {
    expect(new Vector2(1, 2).add(new Vector2(3, 4)).toArray()).toEqual([4, 6]);
    expect(new Vector2(5, 5).subtract(new Vector2(1, 2)).toArray()).toEqual([4, 3]);
    expect(new Vector2(2, 3).multiply(2).toArray()).toEqual([4, 6]);
    expect(new Vector2(4, 6).divide(2).toArray()).toEqual([2, 3]);
  });

  it("should be immutable - operations return a new vector", () => {
    const original = new Vector2(1, 2);

    original.add(new Vector2(3, 4));

    expect(original.toArray()).toEqual([1, 2]);
  });

  it("should compute the dot product", () => {
    expect(new Vector2(1, 2).dot(new Vector2(3, 4))).toBe(11);
  });

  it("should compute the 2D cross product (scalar)", () => {
    expect(new Vector2(1, 0).cross(new Vector2(0, 1))).toBe(1);
    expect(new Vector2(2, 3).cross(new Vector2(4, 5))).toBe(-2);
  });

  it("should linearly interpolate toward another vector", () => {
    const from = new Vector2(0, 0);
    const to = new Vector2(10, 20);

    expect(from.lerp(to, 0).toArray()).toEqual([0, 0]);
    expect(from.lerp(to, 0.5).toArray()).toEqual([5, 10]);
    expect(from.lerp(to, 1).toArray()).toEqual([10, 20]);
  });

  it("should compute squared distance and distance", () => {
    expect(new Vector2(0, 0).distanceToSquared(new Vector2(3, 4))).toBe(25);
    expect(new Vector2(0, 0).distanceTo(new Vector2(3, 4))).toBe(5);
  });

  it("should compute length and normalize", () => {
    expect(new Vector2(3, 4).length()).toBe(5);

    const normalized = new Vector2(3, 4).normalize();

    expect(normalized.x).toBeCloseTo(0.6);
    expect(normalized.y).toBeCloseTo(0.8);

    expect(new Vector2(0, 0).normalize().toArray()).toEqual([0, 0]);
  });
});

describe("Vector3", () => {
  it("should convert to and from arrays and simple objects", () => {
    expect(Vector3.fromArray([1, 2, 3]).toArray()).toEqual([1, 2, 3]);
    expect(Vector3.fromSimpleObject({ x: 1, y: 2, z: 3 }).toSimpleObject()).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("should add and subtract", () => {
    expect(new Vector3(1, 2, 3).add(new Vector3(4, 5, 6)).toArray()).toEqual([5, 7, 9]);
    expect(new Vector3(4, 5, 6).subtract(new Vector3(1, 2, 3)).toArray()).toEqual([3, 3, 3]);
  });

  it("should compute the dot product", () => {
    expect(new Vector3(1, 2, 3).dot(new Vector3(4, 5, 6))).toBe(32);
  });

  it("should compute the cross product", () => {
    expect(new Vector3(1, 0, 0).cross(new Vector3(0, 1, 0)).toArray()).toEqual([0, 0, 1]);
    expect(new Vector3(0, 1, 0).cross(new Vector3(1, 0, 0)).toArray()).toEqual([0, 0, -1]);
  });

  it("should linearly interpolate toward another vector", () => {
    expect(new Vector3(0, 0, 0).lerp(new Vector3(2, 4, 6), 0.5).toArray()).toEqual([1, 2, 3]);
  });

  it("should compute squared distance and distance", () => {
    expect(new Vector3(0, 0, 0).distanceToSquared(new Vector3(1, 2, 2))).toBe(9);
    expect(new Vector3(0, 0, 0).distanceTo(new Vector3(1, 2, 2))).toBe(3);
  });

  it("should compute length and normalize", () => {
    expect(new Vector3(0, 3, 4).length()).toBe(5);
    expect(new Vector3(0, 0, 0).normalize().toArray()).toEqual([0, 0, 0]);
  });
});
