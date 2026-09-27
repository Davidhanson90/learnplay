import { ACTION_DELTAS, indexOf, posFromIndex, type Action, type Maze, type Position } from "../maze/types.js";

/** A genome is a fixed-length list of moves (0=N/up, 1=E/right, 2=S/down, 3=W/left). */
export type Genome = Action[];

/** Every walker starts with this many points (lives). */
export const DEFAULT_LIVES = 10;

/** Why a walker stopped: reached the goal, ran out of points, or used every gene. */
export type EndReason = "goal" | "dead" | "moves";

export interface WallBump {
  /** 1-based step index at which the bump happened. */
  step: number;
  /** Cell the walker was in (it stays there). */
  cell: number;
  /** Direction it tried to move. */
  action: Action;
}

/** Full trajectory of one walker following its genome through the maze. */
export interface WalkerRun {
  /** Cell index after each step; path[0] is the start. Length = steps + 1. */
  path: Int32Array;
  /** Points remaining after each step; lives[0] is the starting points. */
  lives: Uint8Array;
  bumps: WallBump[];
  end: EndReason;
  /** Genes consumed before stopping. */
  steps: number;
  livesLeft: number;
  finalCell: number;
  /** Successful moves into a cell that had already been visited. */
  revisits: number;
}

/**
 * Precomputed, reusable lookup tables for walking one maze quickly
 * (open-cell mask, neighbour offsets, and a visited-stamp buffer).
 */
export interface WalkContext {
  maze: Maze;
  /** 1 = open cell, 0 = wall. */
  open: Uint8Array;
  exitIndex: number;
  /** For each cell × action: destination cell index, or -1 if that move hits a wall / leaves the grid. */
  next: Int32Array;
  stamp: Uint32Array;
  stampId: number;
}

export function createWalkContext(maze: Maze): WalkContext {
  const n = maze.rows * maze.cols;
  const open = new Uint8Array(n);
  for (let i = 0; i < n; i++) open[i] = maze.walls[i] ? 0 : 1;
  const next = new Int32Array(n * 4).fill(-1);
  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      const i = r * maze.cols + c;
      for (let a = 0; a < 4; a++) {
        const [dr, dc] = ACTION_DELTAS[a]!;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= maze.rows || nc < 0 || nc >= maze.cols) continue;
        const ni = nr * maze.cols + nc;
        if (open[ni]) next[i * 4 + a] = ni;
      }
    }
  }
  return { maze, open, exitIndex: indexOf(maze, maze.exit), next, stamp: new Uint32Array(n), stampId: 0 };
}

/**
 * Walk a genome through the maze. Each gene is one move attempt:
 * - moving into a wall (or off the grid) costs 1 point and the walker stays put;
 * - at 0 points the walker dies where it stands;
 * - reaching the goal stops the walker on the goal;
 * - otherwise it stops when the genome runs out.
 *
 * Pass a {@link WalkContext} (from {@link createWalkContext}) when walking many
 * genomes through the same maze; it avoids per-step allocation.
 */
export function runWalker(
  maze: Maze,
  start: Position,
  genome: ReadonlyArray<Action>,
  startingLives = DEFAULT_LIVES,
  context?: WalkContext
): WalkerRun {
  const ctx = context && context.maze === maze ? context : createWalkContext(maze);
  const { next, exitIndex, stamp } = ctx;
  ctx.stampId = (ctx.stampId + 1) >>> 0;
  if (ctx.stampId === 0) {
    stamp.fill(0);
    ctx.stampId = 1;
  }
  const id = ctx.stampId;

  let cell = indexOf(maze, start);
  let lives = startingLives;
  const path = new Int32Array(genome.length + 1);
  const livesTrail = new Uint8Array(genome.length + 1);
  path[0] = cell;
  livesTrail[0] = lives;
  const bumps: WallBump[] = [];
  stamp[cell] = id;
  let revisits = 0;
  let end: EndReason = "moves";
  let steps = 0;

  if (cell === exitIndex) {
    return { path: path.slice(0, 1), lives: livesTrail.slice(0, 1), bumps, end: "goal", steps: 0, livesLeft: lives, finalCell: cell, revisits };
  }

  for (let i = 0; i < genome.length; i++) {
    const action = genome[i]!;
    const dest = next[cell * 4 + action]!;
    if (dest < 0) {
      lives -= 1;
      bumps.push({ step: i + 1, cell, action });
    } else {
      cell = dest;
      if (stamp[cell] === id) revisits += 1;
      else stamp[cell] = id;
    }
    steps = i + 1;
    path[steps] = cell;
    livesTrail[steps] = lives;
    if (lives <= 0) {
      end = "dead";
      break;
    }
    if (cell === exitIndex) {
      end = "goal";
      break;
    }
  }

  return {
    path: path.slice(0, steps + 1),
    lives: livesTrail.slice(0, steps + 1),
    bumps,
    end,
    steps,
    livesLeft: lives,
    finalCell: cell,
    revisits
  };
}

/** Position of a walker at animation step `t` (clamped to where it stopped). */
export function positionAt(maze: Maze, run: WalkerRun, t: number): Position {
  const i = Math.max(0, Math.min(run.path.length - 1, t));
  return posFromIndex(maze, run.path[i]!);
}
