import {
  indexOf,
  isOpen,
  type Maze,
  type Position
} from "./types.js";

export interface GenerateMazeOptions {
  /** Odd integer ≥ 5. Default 21. */
  size?: number;
  /** Optional seeded RNG in [0, 1). */
  random?: () => number;
}

/**
 * Generate a perfect maze via recursive backtracker (DFS carving).
 * Odd dimensions keep walls and passages aligned; exit is the far
 * carved corner opposite the typical northwest start region.
 */
export function generateMaze(options: GenerateMazeOptions = {}): Maze {
  const size = normalizeOddSize(options.size ?? 21);
  const random = options.random ?? Math.random;

  const rows = size;
  const cols = size;
  const walls = new Array<boolean>(rows * cols).fill(true);

  const start: Position = { row: 1, col: 1 };
  carve(walls, rows, cols, start, random);

  const exit: Position = { row: rows - 2, col: cols - 2 };
  // Ensure exit cell is open (always true for perfect DFS from (1,1) on odd grid).
  walls[indexOf({ rows, cols, walls, exit }, exit)] = false;

  return { rows, cols, walls, exit };
}

function normalizeOddSize(size: number): number {
  const n = Math.max(5, Math.floor(size));
  return n % 2 === 1 ? n : n + 1;
}

function carve(
  walls: boolean[],
  rows: number,
  cols: number,
  current: Position,
  random: () => number
): void {
  walls[current.row * cols + current.col] = false;

  const dirs: Array<[number, number]> = [
    [-2, 0],
    [0, 2],
    [2, 0],
    [0, -2]
  ];
  shuffle(dirs, random);

  for (const [dr, dc] of dirs) {
    const next: Position = { row: current.row + dr, col: current.col + dc };
    if (next.row <= 0 || next.row >= rows - 1 || next.col <= 0 || next.col >= cols - 1) {
      continue;
    }
    if (!walls[next.row * cols + next.col]) continue;

    const mid: Position = {
      row: current.row + dr / 2,
      col: current.col + dc / 2
    };
    walls[mid.row * cols + mid.col] = false;
    carve(walls, rows, cols, next, random);
  }
}

function shuffle<T>(arr: T[], random: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

/** BFS reachability from a start cell over open passages. */
export function reachableOpenCells(maze: Maze, start: Position): Position[] {
  if (!isOpen(maze, start)) return [];

  const seen = new Set<string>();
  const queue: Position[] = [start];
  const key = (p: Position) => `${p.row},${p.col}`;
  seen.add(key(start));
  const out: Position[] = [];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    out.push(cur);
    for (const [dr, dc] of [
      [-1, 0],
      [0, 1],
      [1, 0],
      [0, -1]
    ] as const) {
      const n: Position = { row: cur.row + dr, col: cur.col + dc };
      const k = key(n);
      if (seen.has(k)) continue;
      if (!isOpen(maze, n)) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return out;
}

/** All open (non-wall) cells in the maze. */
export function listOpenCells(maze: Maze): Position[] {
  const cells: Position[] = [];
  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      const p = { row: r, col: c };
      if (isOpen(maze, p)) cells.push(p);
    }
  }
  return cells;
}

/** Build a tiny fixed maze for deterministic Q-learning tests. */
export function createFixedTestMaze(): Maze {
  // 5x5: border walls, open cross corridor to exit at (3,3)
  // # # # # #
  // # . . . #
  // # . # . #
  // # . . E #
  // # # # # #
  const rows = 5;
  const cols = 5;
  const layout = [
    "#####",
    "#...#",
    "#.#.#",
    "#..E#",
    "#####"
  ];
  const walls = new Array<boolean>(rows * cols);
  let exit: Position = { row: 3, col: 3 };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = layout[r]![c]!;
      walls[r * cols + c] = ch === "#";
      if (ch === "E") exit = { row: r, col: c };
    }
  }
  walls[exit.row * cols + exit.col] = false;
  return { rows, cols, walls, exit };
}
