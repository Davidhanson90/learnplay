import { describe, expect, it } from "vitest";
import {
  activate,
  activateDerivative,
  relu,
  reluDerivative,
  sigmoid,
  sigmoidDerivative
} from "./activations.js";

describe("activations", () => {
  it("relu zeros negatives and passes positives", () => {
    expect(relu(-2)).toBe(0);
    expect(relu(0)).toBe(0);
    expect(relu(3.5)).toBe(3.5);
  });

  it("reluDerivative is 0/1 step", () => {
    expect(reluDerivative(-1)).toBe(0);
    expect(reluDerivative(0)).toBe(0);
    expect(reluDerivative(0.1)).toBe(1);
  });

  it("sigmoid is bounded and symmetric around 0.5", () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 10);
    expect(sigmoid(20)).toBeGreaterThan(0.999);
    expect(sigmoid(-20)).toBeLessThan(0.001);
    expect(sigmoid(2) + sigmoid(-2)).toBeCloseTo(1, 10);
  });

  it("sigmoidDerivative peaks at 0.5", () => {
    expect(sigmoidDerivative(0.5)).toBeCloseTo(0.25, 10);
    expect(sigmoidDerivative(0)).toBe(0);
    expect(sigmoidDerivative(1)).toBe(0);
  });

  it("activate / activateDerivative dispatch by name", () => {
    expect(activate("relu", -1)).toBe(0);
    expect(activate("sigmoid", 0)).toBeCloseTo(0.5, 10);
    expect(activateDerivative("relu", 0, -1)).toBe(0);
    expect(activateDerivative("relu", 2, 2)).toBe(1);
    expect(activateDerivative("sigmoid", 0.5)).toBeCloseTo(0.25, 10);
  });
});
