import { step } from "../maze/movement.js";
import { indexOf, posFromIndex, type Action, type Maze, type Position } from "../maze/types.js";

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
  path: number[];
  /** Points remaining after each step; lives[0] is the starting points. */
  lives: number[];
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
 * Walk a genome through the maze. Each gene is one move attempt:
 * - moving into a wall (or off the grid) costs 1 point and the walker stays put;
 * - at 0 points the walker dies where it stands;
 * - reaching the goal stops the walker on the goal;
 * - otherwise it stops when the genome runs out.
 */
export function runWalker(
  maze: Maze,
  start: Position,
  genome: ReadonlyArray<Action>,
  startingLives = DEFAULT_LIVES
): WalkerRun {
  let pos: Position = { ...start };
  let cell = indexOf(maze, pos);
  let lives = startingLives;
  const path = [cell];
  const livesTrail = [lives];
  const bumps: WallBump[] = [];
  const visited = new Set<number>([cell]);
  let revisits = 0;
  let end: EndReason = "moves";

  if (cell === indexOf(maze, maze.exit)) {
    return { path, lives: livesTrail, bumps, end: "goal", steps: 0, livesLeft: lives, finalCell: cell, revisits };
  }

  for (let i = 0; i < genome.length; i++) {
    const action = genome[i]!;
    const result = step(maze, pos, action);
    if (result.hitWall) {
      lives -= 1;
      bumps.push({ step: i + 1, cell, action });
    } else {
      pos = result.next;
      cell = indexOf(maze, pos);
      if (visited.has(cell)) revisits += 1;
      else visited.add(cell);
    }
    path.push(cell);
    livesTrail.push(lives);
    if (lives <= 0) {
      end = "dead";
      break;
    }
    if (result.done) {
      end = "goal";
      break;
    }
  }

  return {
    path,
    lives: livesTrail,
    bumps,
    end,
    steps: path.length - 1,
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
