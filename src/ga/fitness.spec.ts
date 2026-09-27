import { describe, expect, it } from "vitest";
import { bfsDistances, maxDistance } from "../maze/distance.js";
import { mazeFromLayout } from "../maze/generate.js";
import { indexOf, type Action } from "../maze/types.js";
import { DEFAULT_FITNESS_WEIGHTS, fitness, type FitnessContext } from "./fitness.js";
import { runWalker, type WalkerRun } from "./walker.js";

// The exit is right below the top corridor in a straight line, but 10 moves away by maze.
const U_MAZE = mazeFromLayout([
  "#######",
  "#.....#",
  "#####.#",
  "#E....#",
  "#######"
]);
const dist = bfsDistances(U_MAZE, U_MAZE.exit);
const ctx: FitnessContext = { distToGoal: dist, maxDist: maxDistance(dist), genomeLength: 20 };

function endingAt(row: number, col: number, extra: Partial<WalkerRun> = {}): WalkerRun {
  const c = indexOf(U_MAZE, { row, col });
  return {
    path: [c],
    lives: [10],
    bumps: [],
    end: "moves",
    steps: 5,
    livesLeft: 10,
    finalCell: c,
    revisits: 0,
    ...extra
  };
}

describe("fitness", () => {
  it("rewards true BFS maze distance, not straight-line closeness", () => {
    // (1,1) is 2 cells from the exit as the crow flies but 10 by maze;
    // (3,5) is 4 cells away as the crow flies but also 4 by maze.
    const crowClose = fitness(endingAt(1, 1), ctx);
    const mazeClose = fitness(endingAt(3, 5), ctx);
    expect(mazeClose).toBeGreaterThan(crowClose);
    expect(crowClose).toBeCloseTo(0 + 10, 5); // closeness 0 + 10 lives
    expect(mazeClose).toBeCloseTo(100 * (1 - 4 / 10) + 10, 5);
  });

  it("adds a big bonus for reaching the goal, more for fewer steps", () => {
    const nearly = fitness(endingAt(3, 2), ctx);
    const slow = fitness(endingAt(3, 1, { end: "goal", steps: 18 }), ctx);
    const fast = fitness(endingAt(3, 1, { end: "goal", steps: 10 }), ctx);
    expect(slow).toBeGreaterThan(nearly + DEFAULT_FITNESS_WEIGHTS.goalBonus - 10);
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeCloseTo(100 + 100 + 50 * (1 - 10 / 20) + 10, 5);
  });

  it("gives a small bonus for points left and penalises revisits", () => {
    const base = fitness(endingAt(3, 3, { livesLeft: 5 }), ctx);
    expect(fitness(endingAt(3, 3, { livesLeft: 6 }), ctx)).toBeCloseTo(base + 1, 5);
    expect(fitness(endingAt(3, 3, { livesLeft: 5, revisits: 5 }), ctx)).toBeCloseTo(base - 1, 5);
  });

  it("is never negative and treats unknown cells as far away", () => {
    expect(fitness(endingAt(1, 1, { livesLeft: 0, revisits: 1000 }), ctx)).toBe(0);
    expect(fitness(endingAt(0, 0, { livesLeft: 0 }), ctx)).toBe(0);
  });

  it("scores real walker runs consistently", () => {
    const toGoal: Action[] = [1, 1, 1, 1, 2, 2, 3, 3, 3, 3];
    const run = runWalker(U_MAZE, { row: 1, col: 1 }, toGoal);
    expect(run.end).toBe("goal");
    expect(fitness(run, ctx)).toBeCloseTo(100 + 100 + 50 * (1 - 10 / 20) + 10, 5);
  });
});
