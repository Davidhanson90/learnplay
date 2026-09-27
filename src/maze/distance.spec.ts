import { describe, expect, it } from "vitest";
import { bfsDistances, maxDistance, shortestPathLength } from "./distance.js";
import { generateMaze, mazeFromLayout } from "./generate.js";
import { indexOf } from "./types.js";

// Goal is 2 rows below the start in a straight line, but 12 moves away through the maze.
const U_MAZE = mazeFromLayout([
  "#######",
  "#.....#",
  "#####.#",
  "#E....#",
  "#######"
]);

describe("bfsDistances", () => {
  it("measures true walking distance along corridors, not straight-line", () => {
    const d = bfsDistances(U_MAZE, U_MAZE.exit);
    expect(d[indexOf(U_MAZE, { row: 3, col: 1 })]).toBe(0);
    expect(d[indexOf(U_MAZE, { row: 3, col: 5 })]).toBe(4);
    expect(d[indexOf(U_MAZE, { row: 1, col: 5 })]).toBe(6);
    expect(d[indexOf(U_MAZE, { row: 1, col: 1 })]).toBe(10);
  });

  it("marks walls and unreachable cells as -1", () => {
    const maze = mazeFromLayout(["#####", "#.#E#", "#####"]);
    const d = bfsDistances(maze, maze.exit);
    expect(d[indexOf(maze, { row: 0, col: 0 })]).toBe(-1);
    expect(d[indexOf(maze, { row: 1, col: 1 })]).toBe(-1);
    expect(shortestPathLength(maze, { row: 1, col: 1 }, maze.exit)).toBe(-1);
  });

  it("returns all -1 when starting from a wall", () => {
    const d = bfsDistances(U_MAZE, { row: 0, col: 0 });
    expect(Array.from(d).every((v) => v === -1)).toBe(true);
    expect(maxDistance(d)).toBe(0);
  });

  it("gives shortest path lengths and the max distance", () => {
    expect(shortestPathLength(U_MAZE, { row: 1, col: 1 }, U_MAZE.exit)).toBe(10);
    expect(shortestPathLength(U_MAZE, { row: 1, col: 1 }, { row: 0, col: 0 })).toBe(-1);
    expect(maxDistance(bfsDistances(U_MAZE, U_MAZE.exit))).toBe(10);
  });

  it("reaches every open cell of a generated perfect maze", () => {
    const maze = generateMaze({ size: 11, random: () => 0.3 });
    const d = bfsDistances(maze, maze.exit);
    for (let i = 0; i < maze.walls.length; i++) {
      expect(d[i]! >= 0).toBe(!maze.walls[i]);
    }
  });
});
