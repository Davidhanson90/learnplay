import { describe, expect, it } from "vitest";
import { createMatrix, matrixFrom } from "./matrix.js";
import {
  createMlp,
  forward,
  trainStep,
  binaryCrossEntropy,
  binaryCrossEntropyGrad,
  mse,
  mseGrad,
  predictProba,
  setLearningRate,
  accuracy
} from "./mlp.js";

function xorBatch() {
  const inputs = matrixFrom(4, 2, [0, 0, 0, 1, 1, 0, 1, 1]);
  const targets = matrixFrom(4, 1, [0, 1, 1, 0]);
  return { inputs, targets };
}

describe("mlp", () => {
  it("forward returns shape batch x 1", () => {
    const mlp = createMlp({ sizes: [2, 4, 1], seed: 1, learningRate: 0.2 });
    const input = createMatrix(3, 2);
    input.data.set([0.1, -0.2, 0.5, 0.5, -0.3, 0.8]);
    const out = forward(mlp, input);
    expect(out.rows).toBe(3);
    expect(out.cols).toBe(1);
    for (const v of out.data) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("one backprop step reduces loss on XOR", () => {
    const mlp = createMlp({ sizes: [2, 8, 8, 1], seed: 123, learningRate: 0.5 });
    const { inputs, targets } = xorBatch();

    const before = forward(mlp, inputs);
    const lossBefore = binaryCrossEntropy(before, targets);

    let last = lossBefore;
    for (let i = 0; i < 80; i++) {
      const { loss } = trainStep(mlp, inputs, targets, "bce");
      last = loss;
    }
    expect(last).toBeLessThan(lossBefore);
    expect(last).toBeLessThan(0.4);
  });

  it("trainStep accuracy improves toward solving XOR", () => {
    const mlp = createMlp({ sizes: [2, 8, 1], seed: 99, learningRate: 0.8 });
    const { inputs, targets } = xorBatch();
    let acc = 0;
    for (let i = 0; i < 200; i++) {
      acc = trainStep(mlp, inputs, targets, "bce").accuracy;
    }
    expect(acc).toBeGreaterThanOrEqual(0.75);
  });

  it("mse loss path also trains", () => {
    const mlp = createMlp({ sizes: [2, 6, 1], seed: 5, learningRate: 0.3 });
    const { inputs, targets } = xorBatch();
    const pred0 = forward(mlp, inputs);
    const loss0 = mse(pred0, targets);
    for (let i = 0; i < 40; i++) {
      trainStep(mlp, inputs, targets, "mse");
    }
    const pred1 = forward(mlp, inputs);
    expect(mse(pred1, targets)).toBeLessThan(loss0);
    const g = mseGrad(pred0, targets);
    expect(g.rows).toBe(4);
  });

  it("bce helpers and accuracy edge cases", () => {
    const pred = matrixFrom(2, 1, [0.9, 0.1]);
    const target = matrixFrom(2, 1, [1, 0]);
    expect(binaryCrossEntropy(pred, target)).toBeLessThan(0.2);
    const grad = binaryCrossEntropyGrad(pred, target);
    expect(grad.data.length).toBe(2);
    expect(accuracy(pred, target)).toBe(1);
    expect(accuracy(createMatrix(0, 1), createMatrix(0, 1))).toBe(0);
    expect(() => binaryCrossEntropy(pred, createMatrix(3, 1))).toThrow();
  });

  it("predictProba and setLearningRate", () => {
    const mlp = createMlp({ sizes: [2, 4, 1], seed: 2 });
    expect(predictProba(mlp, [])).toEqual([]);
    const scores = predictProba(mlp, [
      [0, 0],
      [1, 1]
    ]);
    expect(scores).toHaveLength(2);
    setLearningRate(mlp, 0.42);
    expect(mlp.learningRate).toBe(0.42);
  });

  it("rejects invalid sizes", () => {
    expect(() => createMlp({ sizes: [2] })).toThrow();
    expect(() => createMlp({ sizes: [3, 4, 1] })).toThrow();
  });

  it("uses sigmoid hidden when configured", () => {
    const mlp = createMlp({
      sizes: [2, 3, 1],
      hiddenActivation: "sigmoid",
      seed: 8
    });
    expect(mlp.layers[0]!.activation).toBe("sigmoid");
    expect(mlp.layers[1]!.activation).toBe("sigmoid");
  });
});
