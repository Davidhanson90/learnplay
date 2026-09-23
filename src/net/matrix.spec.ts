import { describe, expect, it } from "vitest";
import {
  createMatrix,
  get,
  matMul,
  matMulTransposeA,
  matMulTransposeB,
  matrixFrom,
  set,
  hadamard,
  addBias,
  sgdUpdate,
  cloneMatrix,
  zerosLike,
  randomMatrix,
  sumRows,
  mapMatrix,
  mean
} from "./matrix.js";

describe("matrix", () => {
  it("matMul multiplies correctly", () => {
    const a = matrixFrom(2, 3, [1, 2, 3, 4, 5, 6]);
    const b = matrixFrom(3, 2, [7, 8, 9, 10, 11, 12]);
    const c = matMul(a, b);
    expect(c.rows).toBe(2);
    expect(c.cols).toBe(2);
    expect(get(c, 0, 0)).toBe(58);
    expect(get(c, 0, 1)).toBe(64);
    expect(get(c, 1, 0)).toBe(139);
    expect(get(c, 1, 1)).toBe(154);
  });

  it("matMulTransposeA and matMulTransposeB", () => {
    const a = matrixFrom(2, 3, [1, 2, 3, 4, 5, 6]);
    const b = matrixFrom(2, 2, [1, 0, 0, 1]);
    const atb = matMulTransposeA(a, b);
    expect(atb.rows).toBe(3);
    expect(atb.cols).toBe(2);
    expect(get(atb, 0, 0)).toBe(1);
    expect(get(atb, 1, 1)).toBe(5);

    const c = matrixFrom(2, 3, [1, 0, 0, 0, 1, 0]);
    const abt = matMulTransposeB(a, c);
    expect(abt.rows).toBe(2);
    expect(abt.cols).toBe(2);
    expect(get(abt, 0, 0)).toBe(1);
    expect(get(abt, 1, 1)).toBe(5);
  });

  it("addBias broadcasts a row", () => {
    const a = matrixFrom(2, 2, [1, 2, 3, 4]);
    const bias = matrixFrom(1, 2, [10, 20]);
    const out = addBias(a, bias);
    expect(Array.from(out.data)).toEqual([11, 22, 13, 24]);
  });

  it("hadamard and sgdUpdate work in place / elementwise", () => {
    const a = matrixFrom(1, 3, [1, 2, 3]);
    const b = matrixFrom(1, 3, [4, 5, 6]);
    expect(Array.from(hadamard(a, b).data)).toEqual([4, 10, 18]);
    const m = createMatrix(1, 2);
    set(m, 0, 0, 1);
    set(m, 0, 1, 2);
    const g = matrixFrom(1, 2, [0.5, 1]);
    sgdUpdate(m, g, 0.1);
    expect(get(m, 0, 0)).toBeCloseTo(0.95, 10);
    expect(get(m, 0, 1)).toBeCloseTo(1.9, 10);
  });

  it("clone, zerosLike, random, sumRows, map, mean", () => {
    const m = matrixFrom(2, 2, [1, 2, 3, 4]);
    const c = cloneMatrix(m);
    expect(Array.from(c.data)).toEqual([1, 2, 3, 4]);
    c.data[0] = 99;
    expect(m.data[0]).toBe(1);

    const z = zerosLike(m);
    expect(Array.from(z.data)).toEqual([0, 0, 0, 0]);

    let i = 0;
    const rng = () => {
      i += 1;
      return i % 2 === 0 ? 1 : 0;
    };
    const r = randomMatrix(2, 2, 0.5, rng);
    expect(r.rows).toBe(2);
    expect(r.data.length).toBe(4);

    const sums = sumRows(m);
    expect(Array.from(sums.data)).toEqual([4, 6]);

    const mapped = mapMatrix(m, (v) => v * 2);
    expect(Array.from(mapped.data)).toEqual([2, 4, 6, 8]);

    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBe(0);
  });

  it("throws on shape mismatches", () => {
    expect(() => matrixFrom(1, 1, [1, 2])).toThrow();
    expect(() => matMul(createMatrix(2, 3), createMatrix(2, 2))).toThrow();
    expect(() => matMulTransposeA(createMatrix(2, 3), createMatrix(3, 2))).toThrow();
    expect(() => matMulTransposeB(createMatrix(2, 3), createMatrix(2, 2))).toThrow();
    expect(() => addBias(createMatrix(2, 2), createMatrix(1, 3))).toThrow();
    expect(() => hadamard(createMatrix(2, 2), createMatrix(1, 2))).toThrow();
    expect(() => sgdUpdate(createMatrix(2, 2), createMatrix(1, 2), 0.1)).toThrow();
  });
});
