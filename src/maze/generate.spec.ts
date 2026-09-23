import { describe, expect, it } from "vitest";
import {
  createFixedTestMaze,
  generateMaze,
  listOpenCells,
  reachableOpenCells
} from "./generate.js";
import { isExit, isOpen, isWall } from "./types.js";

describe("generateMaze", () => {
  it("produces odd dimensions and exactly one exit on an open cell", () => {
    const maze = generateMaze({ size: 15, random: seeded(42) });
    expect(maze.rows).toBe(15);
    expect(maze.cols).toBe(15);
    expect(isOpen(maze, maze.exit)).toBe(true);
    expect(isExit(maze, maze.exit)).toBe(true);
    expect(maze.walls.filter((w) => !w).length).toBeGreaterThan(10);
  });

  it("normalizes even size up to odd", () => {
    const maze = generateMaze({ size: 14, random: seeded(1) });
    expect(maze.rows % 2).toBe(1);
    expect(maze.cols).toBe(maze.rows);
  });

  it("keeps all open cells mutually reachable (perfect maze)", () => {
    const maze = generateMaze({ size: 11, random: seeded(7) });
    const open = listOpenCells(maze);
    expect(open.length).toBeGreaterThan(0);
    const from = open[0]!;
    const reached = reachableOpenCells(maze, from);
    expect(reached.length).toBe(open.length);
    expect(reached.some((p) => p.row === maze.exit.row && p.col === maze.exit.col)).toBe(
      true
    );
  });

  it("has consistent border walls", () => {
    const maze = generateMaze({ size: 9, random: seeded(3) });
    for (let c = 0; c < maze.cols; c++) {
      expect(isWall(maze, { row: 0, col: c })).toBe(true);
      expect(isWall(maze, { row: maze.rows - 1, col: c })).toBe(true);
    }
    for (let r = 0; r < maze.rows; r++) {
      expect(isWall(maze, { row: r, col: 0 })).toBe(true);
      expect(isWall(maze, { row: r, col: maze.cols - 1 })).toBe(true);
    }
  });
});

describe("createFixedTestMaze", () => {
  it("exposes a tiny solvable layout with one exit", () => {
    const maze = createFixedTestMaze();
    expect(maze.rows).toBe(5);
    expect(isOpen(maze, maze.exit)).toBe(true);
    const open = listOpenCells(maze);
    const reached = reachableOpenCells(maze, { row: 1, col: 1 });
    expect(reached.length).toBe(open.length);
  });
});

/** Deterministic LCG for reproducible mazes in tests. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
