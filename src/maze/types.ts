/** Grid cell kinds in a maze. */
export type CellKind = "wall" | "open" | "exit";

/** Cardinal move directions (N/E/S/W). */
export type Action = 0 | 1 | 2 | 3;

export const ACTION_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], // N
  [0, 1], // E
  [1, 0], // S
  [0, -1] // W
];

export const ACTION_LABELS = ["N", "E", "S", "W"] as const;

export interface Position {
  row: number;
  col: number;
}

export interface Maze {
  /** Odd width/height for wall/passage mazes. */
  rows: number;
  cols: number;
  /** row-major: true = wall, false = open passage. */
  walls: boolean[];
  exit: Position;
}

export function posKey(p: Position): string {
  return `${p.row},${p.col}`;
}

export function indexOf(maze: Maze, p: Position): number {
  return p.row * maze.cols + p.col;
}

export function posFromIndex(maze: Maze, index: number): Position {
  return { row: Math.floor(index / maze.cols), col: index % maze.cols };
}

export function inBounds(maze: Maze, p: Position): boolean {
  return p.row >= 0 && p.row < maze.rows && p.col >= 0 && p.col < maze.cols;
}

export function isWall(maze: Maze, p: Position): boolean {
  if (!inBounds(maze, p)) return true;
  return maze.walls[indexOf(maze, p)]!;
}

export function isOpen(maze: Maze, p: Position): boolean {
  return inBounds(maze, p) && !maze.walls[indexOf(maze, p)]!;
}

export function isExit(maze: Maze, p: Position): boolean {
  return p.row === maze.exit.row && p.col === maze.exit.col;
}

export function cellKind(maze: Maze, p: Position): CellKind {
  if (!inBounds(maze, p) || maze.walls[indexOf(maze, p)]) return "wall";
  if (isExit(maze, p)) return "exit";
  return "open";
}
