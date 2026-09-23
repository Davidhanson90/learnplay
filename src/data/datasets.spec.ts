import { describe, expect, it } from "vitest";
import {
  generateCircles,
  generateDataset,
  generateMoons,
  generateXor,
  pointsToMatrices
} from "./datasets.js";

describe("datasets", () => {
  it("generateMoons produces n labeled points with both classes", () => {
    const pts = generateMoons(100, 0.05, 1);
    expect(pts).toHaveLength(100);
    const labels = new Set(pts.map((p) => p.label));
    expect(labels.has(0)).toBe(true);
    expect(labels.has(1)).toBe(true);
    for (const p of pts) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it("generateXor has four clusters / both labels", () => {
    const pts = generateXor(80, 0.1, 2);
    expect(pts).toHaveLength(80);
    expect(pts.filter((p) => p.label === 0).length).toBeGreaterThan(20);
    expect(pts.filter((p) => p.label === 1).length).toBeGreaterThan(20);
  });

  it("generateCircles keeps inner and outer rings", () => {
    const pts = generateCircles(100, 0.05, 3);
    expect(pts).toHaveLength(100);
    const inner = pts.filter((p) => p.label === 0);
    const outer = pts.filter((p) => p.label === 1);
    const meanR = (arr: typeof pts) =>
      arr.reduce((s, p) => s + Math.hypot(p.x, p.y), 0) / arr.length;
    expect(meanR(outer)).toBeGreaterThan(meanR(inner));
  });

  it("generateDataset dispatches by name and is deterministic for a seed", () => {
    const a = generateDataset("moons", 40, 11);
    const b = generateDataset("moons", 40, 11);
    expect(a).toEqual(b);
    expect(generateDataset("xor", 10).length).toBe(10);
    expect(generateDataset("circles", 10).length).toBe(10);
  });

  it("pointsToMatrices packs rows correctly", () => {
    const { inputs, targets, rows } = pointsToMatrices([
      { x: 1, y: 2, label: 0 },
      { x: 3, y: 4, label: 1 }
    ]);
    expect(rows).toBe(2);
    expect(Array.from(inputs)).toEqual([1, 2, 3, 4]);
    expect(Array.from(targets)).toEqual([0, 1]);
  });
});
