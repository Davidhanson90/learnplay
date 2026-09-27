import { ACTION_DELTAS, indexOf, isOpen, type Maze, type Position } from "./types.js";

/**
 * Breadth-first search distances (in moves) from `from` to every open cell.
 * Walls and unreachable cells get -1. This is the *true maze distance*
 * (walking along corridors), not straight-line distance.
 */
export function bfsDistances(maze: Maze, from: Position): Int32Array {
  const dist = new Int32Array(maze.rows * maze.cols).fill(-1);
  if (!isOpen(maze, from)) return dist;

  const queue = new Int32Array(maze.rows * maze.cols);
  let head = 0;
  let tail = 0;
  const startIdx = indexOf(maze, from);
  dist[startIdx] = 0;
  queue[tail++] = startIdx;

  while (head < tail) {
    const cur = queue[head++]!;
    const row = Math.floor(cur / maze.cols);
    const col = cur % maze.cols;
    for (const [dr, dc] of ACTION_DELTAS) {
      const n: Position = { row: row + dr, col: col + dc };
      if (!isOpen(maze, n)) continue;
      const ni = indexOf(maze, n);
      if (dist[ni] !== -1) continue;
      dist[ni] = dist[cur]! + 1;
      queue[tail++] = ni;
    }
  }
  return dist;
}

/** Length (in moves) of the shortest open path from `a` to `b`, or -1 if none. */
export function shortestPathLength(maze: Maze, a: Position, b: Position): number {
  if (!isOpen(maze, b)) return -1;
  return bfsDistances(maze, a)[indexOf(maze, b)]!;
}

/** Largest finite value in a BFS distance field (0 if nothing reachable). */
export function maxDistance(dist: Int32Array): number {
  let m = 0;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i]! > m) m = dist[i]!;
  }
  return m;
}
