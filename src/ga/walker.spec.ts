import { describe, expect, it } from "vitest";
import { mazeFromLayout } from "../maze/generate.js";
import { indexOf, type Action } from "../maze/types.js";
import { DEFAULT_LIVES, positionAt, runWalker } from "./walker.js";

const N: Action = 0;
const E: Action = 1;
const S: Action = 2;
const W: Action = 3;

// Straight corridor: start (1,1) → exit (1,5).
const CORRIDOR = mazeFromLayout(["#######", "#....E#", "#######"]);
const START = { row: 1, col: 1 };
const cell = (row: number, col: number) => indexOf(CORRIDOR, { row, col });

describe("runWalker", () => {
  it("starts with 10 points", () => {
    expect(DEFAULT_LIVES).toBe(10);
    const run = runWalker(CORRIDOR, START, []);
    expect(run.lives[0]).toBe(10);
    expect(run.end).toBe("moves");
    expect(run.steps).toBe(0);
  });

  it("loses one point per wall hit and stays in place", () => {
    const run = runWalker(CORRIDOR, START, [N, E, S, W, E]);
    expect(run.path).toEqual([cell(1, 1), cell(1, 1), cell(1, 2), cell(1, 2), cell(1, 1), cell(1, 2)]);
    expect(run.lives).toEqual([10, 9, 9, 8, 8, 8]);
    expect(run.livesLeft).toBe(8);
    expect(run.bumps.map((b) => b.step)).toEqual([1, 3]);
    expect(run.bumps[0]).toEqual({ step: 1, cell: cell(1, 1), action: N });
    expect(run.end).toBe("moves");
    expect(run.revisits).toBe(2);
  });

  it("dies on the 10th wall hit and ignores the rest of its genome", () => {
    const genome: Action[] = [E, ...new Array<Action>(10).fill(N), E, E, E];
    const run = runWalker(CORRIDOR, START, genome);
    expect(run.end).toBe("dead");
    expect(run.livesLeft).toBe(0);
    expect(run.steps).toBe(11);
    expect(run.path).toHaveLength(12);
    expect(run.finalCell).toBe(cell(1, 2));
    expect(run.bumps).toHaveLength(10);
  });

  it("respects a custom starting point budget", () => {
    const run = runWalker(CORRIDOR, START, [N, N, E], 2);
    expect(run.end).toBe("dead");
    expect(run.steps).toBe(2);
  });

  it("stops on the goal even with genes left", () => {
    const run = runWalker(CORRIDOR, START, [E, E, E, E, W, W, W]);
    expect(run.end).toBe("goal");
    expect(run.steps).toBe(4);
    expect(run.finalCell).toBe(cell(1, 5));
    expect(run.livesLeft).toBe(10);
  });

  it("treats a start on the goal as already finished", () => {
    const run = runWalker(CORRIDOR, CORRIDOR.exit, [W, W]);
    expect(run.end).toBe("goal");
    expect(run.steps).toBe(0);
  });

  it("treats moving off the grid as a wall hit", () => {
    const open = mazeFromLayout(["..", ".E"]);
    const run = runWalker(open, { row: 0, col: 0 }, [N, W, S]);
    expect(run.lives).toEqual([10, 9, 8, 8]);
    expect(run.path.at(-1)).toBe(indexOf(open, { row: 1, col: 0 }));
  });

  it("reports clamped positions for animation", () => {
    const run = runWalker(CORRIDOR, START, [E, E]);
    expect(positionAt(CORRIDOR, run, 0)).toEqual(START);
    expect(positionAt(CORRIDOR, run, 1)).toEqual({ row: 1, col: 2 });
    expect(positionAt(CORRIDOR, run, 99)).toEqual({ row: 1, col: 3 });
    expect(positionAt(CORRIDOR, run, -5)).toEqual(START);
  });
});
