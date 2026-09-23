import { describe, expect, it } from "vitest";
import { createFixedTestMaze } from "./generate.js";
import {
  cellKind,
  inBounds,
  indexOf,
  isExit,
  isOpen,
  isWall,
  posFromIndex,
  posKey
} from "./types.js";

describe("maze types helpers", () => {
  const maze = createFixedTestMaze();

  it("indexes positions and round-trips", () => {
    const p = { row: 2, col: 3 };
    expect(indexOf(maze, p)).toBe(13);
    expect(posFromIndex(maze, 13)).toEqual(p);
    expect(posKey(p)).toBe("2,3");
  });

  it("bounds / wall / open / exit checks", () => {
    expect(inBounds(maze, { row: 0, col: 0 })).toBe(true);
    expect(inBounds(maze, { row: -1, col: 0 })).toBe(false);
    expect(isWall(maze, { row: 0, col: 0 })).toBe(true);
    expect(isWall(maze, { row: 99, col: 0 })).toBe(true);
    expect(isOpen(maze, { row: 1, col: 1 })).toBe(true);
    expect(isOpen(maze, { row: 0, col: 0 })).toBe(false);
    expect(isExit(maze, maze.exit)).toBe(true);
    expect(isExit(maze, { row: 1, col: 1 })).toBe(false);
  });

  it("cellKind distinguishes wall, open, exit", () => {
    expect(cellKind(maze, { row: 0, col: 0 })).toBe("wall");
    expect(cellKind(maze, { row: 1, col: 1 })).toBe("open");
    expect(cellKind(maze, maze.exit)).toBe("exit");
    expect(cellKind(maze, { row: -1, col: 0 })).toBe("wall");
  });
});
