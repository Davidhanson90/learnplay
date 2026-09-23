import { describe, expect, it } from "vitest";
import { createDenseLayer, forwardLayer, backwardLayer } from "./layer.js";
import { createMatrix, matrixFrom } from "./matrix.js";

describe("layer", () => {
  it("forward then backward updates weights", () => {
    const layer = createDenseLayer(2, 1, "sigmoid", () => 0.5);
    const input = matrixFrom(1, 2, [1, -1]);
    const out = forwardLayer(layer, input);
    expect(out.rows).toBe(1);
    const before = layer.weights.data[0]!;
    backwardLayer(layer, matrixFrom(1, 1, [0.5]), 0.1);
    expect(layer.weights.data[0]).not.toBe(before);
  });

  it("throws if backward before forward", () => {
    const layer = createDenseLayer(2, 1, "relu", () => 0.25);
    expect(() => backwardLayer(layer, createMatrix(1, 1), 0.1)).toThrow();
  });
});
