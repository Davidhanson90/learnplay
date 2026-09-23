import { describe, expect, it } from "vitest";
import { createFixedTestMaze } from "./generate.js";
import {
  REWARD_EXIT,
  REWARD_STEP,
  REWARD_WALL,
  legalActions,
  step
} from "./movement.js";

describe("step / legalActions", () => {
  const maze = createFixedTestMaze();

  it("moves into an open neighbor with step penalty", () => {
    const result = step(maze, { row: 1, col: 1 }, 1); // E
    expect(result.hitWall).toBe(false);
    expect(result.done).toBe(false);
    expect(result.next).toEqual({ row: 1, col: 2 });
    expect(result.reward).toBe(REWARD_STEP);
  });

  it("stays put and penalizes wall bumps", () => {
    const result = step(maze, { row: 1, col: 1 }, 0); // N into border
    expect(result.hitWall).toBe(true);
    expect(result.next).toEqual({ row: 1, col: 1 });
    expect(result.reward).toBe(REWARD_WALL);
    expect(result.done).toBe(false);
  });

  it("rewards reaching the exit and marks done", () => {
    const result = step(maze, { row: 3, col: 2 }, 1); // E onto exit
    expect(result.done).toBe(true);
    expect(result.next).toEqual(maze.exit);
    expect(result.reward).toBe(REWARD_EXIT);
  });

  it("lists only open-neighbor actions", () => {
    // (2,1) has wall to the east (# at 2,2)
    const acts = legalActions(maze, { row: 2, col: 1 });
    expect(acts).toContain(0); // N open
    expect(acts).toContain(2); // S open
    expect(acts).not.toContain(1); // E wall
  });
});
