import { step, type Maze, type Position, type Action } from "../maze/index.js";
import { indexOf } from "../maze/types.js";

export interface QLearningConfig {
  /** Learning rate α. Default 0.2. */
  alpha: number;
  /** Discount γ. Default 0.95. */
  gamma: number;
  /** Initial exploration rate ε. Default 1.0. */
  epsilon: number;
  /** Multiplicative ε decay per episode. Default 0.995. */
  epsilonDecay: number;
  /** Floor for ε. Default 0.05. */
  epsilonMin: number;
  /** Max steps before episode timeout. Default 400. */
  maxSteps: number;
}

export const DEFAULT_QL_CONFIG: QLearningConfig = {
  alpha: 0.2,
  gamma: 0.95,
  epsilon: 1,
  epsilonDecay: 0.995,
  epsilonMin: 0.05,
  maxSteps: 400
};

export interface EpisodeResult {
  steps: number;
  totalReward: number;
  success: boolean;
  path: Position[];
}

/**
 * Tabular Q-learning agent for discrete grid mazes.
 * State = cell index; actions = N/E/S/W (4).
 * Q-table is reset when the maze or start changes so learning is visible.
 */
export class QAgent {
  readonly maze: Maze;
  readonly config: QLearningConfig;
  /** Flat Q-table: q[state * 4 + action]. */
  q: Float64Array;
  epsilon: number;
  episode: number;
  /** Recent success flags for rolling success rate. */
  recentSuccesses: boolean[] = [];
  readonly recentWindow = 50;

  private readonly rng: () => number;

  constructor(
    maze: Maze,
    config: Partial<QLearningConfig> = {},
    random: () => number = Math.random
  ) {
    this.maze = maze;
    this.config = { ...DEFAULT_QL_CONFIG, ...config };
    this.epsilon = this.config.epsilon;
    this.episode = 0;
    this.rng = random;
    this.q = new Float64Array(maze.rows * maze.cols * 4);
  }

  /** Zero the Q-table and exploration schedule (keep maze). */
  resetLearning(): void {
    this.q.fill(0);
    this.epsilon = this.config.epsilon;
    this.episode = 0;
    this.recentSuccesses = [];
  }

  stateIndex(pos: Position): number {
    return indexOf(this.maze, pos);
  }

  qValue(pos: Position, action: Action): number {
    return this.q[this.stateIndex(pos) * 4 + action]!;
  }

  maxQ(pos: Position): number {
    const base = this.stateIndex(pos) * 4;
    return Math.max(this.q[base]!, this.q[base + 1]!, this.q[base + 2]!, this.q[base + 3]!);
  }

  /** Argmax action; ties broken randomly. */
  bestAction(pos: Position): Action {
    const base = this.stateIndex(pos) * 4;
    let best = this.q[base]!;
    const tied: Action[] = [0];
    for (let a = 1; a < 4; a++) {
      const v = this.q[base + a]!;
      if (v > best) {
        best = v;
        tied.length = 0;
        tied.push(a as Action);
      } else if (v === best) {
        tied.push(a as Action);
      }
    }
    return tied[Math.floor(this.rng() * tied.length)]!;
  }

  selectAction(pos: Position, greedy = false): Action {
    if (!greedy && this.rng() < this.epsilon) {
      return Math.floor(this.rng() * 4) as Action;
    }
    return this.bestAction(pos);
  }

  /** One Q-learning update for a transition. */
  update(pos: Position, action: Action, reward: number, next: Position, done: boolean): void {
    const idx = this.stateIndex(pos) * 4 + action;
    const old = this.q[idx]!;
    const target = done ? reward : reward + this.config.gamma * this.maxQ(next);
    this.q[idx] = old + this.config.alpha * (target - old);
  }

  /**
   * Run one full episode from `start`. When `animate` is false, steps run
   * synchronously (for tests / fast training). Returns episode stats.
   */
  runEpisode(start: Position, greedy = false): EpisodeResult {
    let pos: Position = { ...start };
    let totalReward = 0;
    let steps = 0;
    let success = false;
    const path: Position[] = [{ ...pos }];

    while (steps < this.config.maxSteps) {
      const action = this.selectAction(pos, greedy);
      const result = step(this.maze, pos, action);
      this.update(pos, action, result.reward, result.next, result.done);
      pos = result.next;
      totalReward += result.reward;
      steps += 1;
      path.push({ ...pos });
      if (result.done) {
        success = true;
        break;
      }
    }

    if (!greedy) {
      this.episode += 1;
      this.epsilon = Math.max(
        this.config.epsilonMin,
        this.epsilon * this.config.epsilonDecay
      );
      this.recentSuccesses.push(success);
      if (this.recentSuccesses.length > this.recentWindow) {
        this.recentSuccesses.shift();
      }
    }

    return { steps, totalReward, success, path };
  }

  /**
   * Single environment step with learning — for animated training loops.
   * Caller owns episode bookkeeping via `beginEpisode` / `endEpisode`.
   */
  takeStep(
    pos: Position,
    greedy = false
  ): { action: Action; next: Position; reward: number; done: boolean; hitWall: boolean } {
    const action = this.selectAction(pos, greedy);
    const result = step(this.maze, pos, action);
    this.update(pos, action, result.reward, result.next, result.done);
    return {
      action,
      next: result.next,
      reward: result.reward,
      done: result.done,
      hitWall: result.hitWall
    };
  }

  beginEpisode(): void {
    // no-op hook; episode counter bumps in endEpisode
  }

  endEpisode(success: boolean): void {
    this.episode += 1;
    this.epsilon = Math.max(
      this.config.epsilonMin,
      this.epsilon * this.config.epsilonDecay
    );
    this.recentSuccesses.push(success);
    if (this.recentSuccesses.length > this.recentWindow) {
      this.recentSuccesses.shift();
    }
  }

  successRate(): number {
    if (this.recentSuccesses.length === 0) return 0;
    let ok = 0;
    for (const s of this.recentSuccesses) if (s) ok += 1;
    return ok / this.recentSuccesses.length;
  }

  /** Max |Q| across table — useful for heatmap normalization. */
  maxAbsQ(): number {
    let m = 0;
    for (let i = 0; i < this.q.length; i++) {
      const a = Math.abs(this.q[i]!);
      if (a > m) m = a;
    }
    return m;
  }
}
