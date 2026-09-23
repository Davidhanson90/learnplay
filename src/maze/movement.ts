import {
  ACTION_DELTAS,
  inBounds,
  isExit,
  isWall,
  type Action,
  type Maze,
  type Position
} from "./types.js";

export interface StepResult {
  next: Position;
  reward: number;
  done: boolean;
  hitWall: boolean;
}

/** Reward for reaching the exit. */
export const REWARD_EXIT = 10;
/** Small step cost to encourage shorter paths. */
export const REWARD_STEP = -0.05;
/** Penalty when bumping a wall (agent stays put). */
export const REWARD_WALL = -0.5;

/**
 * Attempt a 4-directional move. Hitting a wall or going out of bounds
 * leaves the agent in place with a wall penalty.
 */
export function step(maze: Maze, pos: Position, action: Action): StepResult {
  const [dr, dc] = ACTION_DELTAS[action]!;
  const candidate: Position = { row: pos.row + dr, col: pos.col + dc };

  if (!inBounds(maze, candidate) || isWall(maze, candidate)) {
    return {
      next: { ...pos },
      reward: REWARD_WALL,
      done: false,
      hitWall: true
    };
  }

  if (isExit(maze, candidate)) {
    return {
      next: candidate,
      reward: REWARD_EXIT,
      done: true,
      hitWall: false
    };
  }

  return {
    next: candidate,
    reward: REWARD_STEP,
    done: false,
    hitWall: false
  };
}

/** Valid actions that would land on an open cell (no wall collision). */
export function legalActions(maze: Maze, pos: Position): Action[] {
  const out: Action[] = [];
  for (let a = 0; a < 4; a++) {
    const action = a as Action;
    const [dr, dc] = ACTION_DELTAS[action]!;
    const candidate: Position = { row: pos.row + dr, col: pos.col + dc };
    if (inBounds(maze, candidate) && !isWall(maze, candidate)) {
      out.push(action);
    }
  }
  return out;
}
