import type { WalkerRun } from "./walker.js";

/** Tunable fitness weights (all in "fitness points"). */
export interface FitnessWeights {
  /** Points for being close to the goal: closeness × this (closeness ∈ [0, 1]). */
  closeness: number;
  /** Flat bonus for reaching the goal. */
  goalBonus: number;
  /** Extra bonus for reaching it quickly: × (1 − steps / genomeLength). */
  speedBonus: number;
  /** Bonus per point (life) remaining. */
  perLife: number;
  /** Penalty per move into an already-visited cell. */
  perRevisit: number;
}

export const DEFAULT_FITNESS_WEIGHTS: FitnessWeights = {
  closeness: 100,
  goalBonus: 100,
  speedBonus: 50,
  perLife: 1,
  perRevisit: 0.2
};

export interface FitnessContext {
  /** BFS distance from the goal to every cell (-1 = wall / unreachable). */
  distToGoal: Int32Array;
  /** Largest finite distance in `distToGoal` (normaliser). */
  maxDist: number;
  genomeLength: number;
}

/**
 * Fitness of one walker:
 *   closeness = 1 − d / dMax        (d = BFS maze distance from where it stopped to the goal)
 *   fitness   = 100·closeness
 *             + (reached goal ? 100 + 50·(1 − steps / genomeLength) : 0)
 *             + 1·livesLeft − 0.2·revisits
 * clamped at ≥ 0.
 */
export function fitness(
  run: WalkerRun,
  ctx: FitnessContext,
  weights: FitnessWeights = DEFAULT_FITNESS_WEIGHTS
): number {
  const d = ctx.distToGoal[run.finalCell] ?? -1;
  const maxDist = Math.max(1, ctx.maxDist);
  const closeness = d < 0 ? 0 : 1 - Math.min(d, maxDist) / maxDist;
  let f = weights.closeness * closeness;
  if (run.end === "goal") {
    const len = Math.max(1, ctx.genomeLength);
    f += weights.goalBonus + weights.speedBonus * (1 - run.steps / len);
  }
  f += weights.perLife * run.livesLeft;
  f -= weights.perRevisit * run.revisits;
  return Math.max(0, f);
}
