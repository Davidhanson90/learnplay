import { bfsDistances, maxDistance } from "../maze/distance.js";
import { indexOf, type Action, type Maze, type Position } from "../maze/types.js";
import { DEFAULT_FITNESS_WEIGHTS, fitness, type FitnessContext, type FitnessWeights } from "./fitness.js";
import { DEFAULT_LIVES, createWalkContext, runWalker, type Genome, type WalkContext, type WalkerRun } from "./walker.js";

export type CrossoverKind = "single-point" | "uniform";

export interface GaConfig {
  populationSize: number;
  /** Per-gene probability of being replaced by a different random move. */
  mutationRate: number;
  /** Best genomes copied unchanged into the next generation. */
  eliteCount: number;
  /** Contestants per tournament when picking parents. */
  tournamentSize: number;
  crossover: CrossoverKind;
  /** Genome length = round(multiplier × shortest path length), at least `minGenomeLength`. */
  /**
   * Probability that a child also gets a "frontier" mutation: the last move its first parent
   * made before it stopped (the wall hit that killed it, or its final move) is changed to a
   * different direction. Focuses exploration exactly where the parent got stuck. Parents
   * that reached the goal are left alone.
   */
  frontierRate: number;
  /** After a frontier mutation, also re-randomise this many genes after the stuck point. */
  frontierReroll: number;
  /**
   * Probability that a child deletes one gene that made its first parent hit a wall
   * (later genes shift one step earlier, a random move is appended to keep the length).
   */
  repairRate: number;
  genomeMultiplier: number;
  minGenomeLength: number;
  lives: number;
}

export const DEFAULT_GA_CONFIG: GaConfig = {
  populationSize: 100,
  mutationRate: 0.002,
  eliteCount: 4,
  tournamentSize: 5,
  crossover: "single-point",
  frontierRate: 1,
  frontierReroll: 10,
  repairRate: 0.5,
  genomeMultiplier: 2,
  minGenomeLength: 20,
  lives: DEFAULT_LIVES
};

export type Rng = () => number;

function randomAction(rng: Rng): Action {
  return Math.min(3, Math.floor(rng() * 4)) as Action;
}

export function randomGenome(length: number, rng: Rng = Math.random): Genome {
  const g: Genome = new Array<Action>(length);
  for (let i = 0; i < length; i++) g[i] = randomAction(rng);
  return g;
}

/** Combine two equal-length parents. Child always has the parents' length. */
export function crossover(
  a: ReadonlyArray<Action>,
  b: ReadonlyArray<Action>,
  rng: Rng = Math.random,
  kind: CrossoverKind = "single-point"
): Genome {
  const n = a.length;
  const child: Genome = new Array<Action>(n);
  if (kind === "uniform") {
    for (let i = 0; i < n; i++) child[i] = rng() < 0.5 ? a[i]! : (b[i] ?? a[i]!);
    return child;
  }
  const cut = Math.floor(rng() * (n + 1));
  for (let i = 0; i < n; i++) child[i] = i < cut ? a[i]! : (b[i] ?? a[i]!);
  return child;
}

/** Copy of `genome` where each gene is replaced by a different random move with probability `rate`. */
export function mutate(genome: ReadonlyArray<Action>, rate: number, rng: Rng = Math.random): Genome {
  const out = genome.slice();
  for (let i = 0; i < out.length; i++) {
    if (rng() < rate) {
      const shift = 1 + Math.min(2, Math.floor(rng() * 3));
      out[i] = ((out[i]! + shift) % 4) as Action;
    }
  }
  return out;
}

/** Remove gene `index` (later genes move one step earlier) and append a random move. */
export function deleteGene(genome: ReadonlyArray<Action>, index: number, rng: Rng = Math.random): Genome {
  if (index < 0 || index >= genome.length) return genome.slice();
  const out = genome.slice(0, index).concat(genome.slice(index + 1));
  out.push(randomAction(rng));
  return out;
}

/** Index of the fittest of `k` randomly drawn individuals. */
export function tournamentSelect(fitnesses: ReadonlyArray<number>, k: number, rng: Rng = Math.random): number {
  let best = Math.floor(rng() * fitnesses.length);
  for (let i = 1; i < k; i++) {
    const c = Math.floor(rng() * fitnesses.length);
    if (fitnesses[c]! > fitnesses[best]!) best = c;
  }
  return best;
}

/** Indices sorted by fitness, best first (stable for ties). */
export function rankIndices(fitnesses: ReadonlyArray<number>): number[] {
  return fitnesses.map((_, i) => i).sort((x, y) => fitnesses[y]! - fitnesses[x]! || x - y);
}

/**
 * Breed the next population: the top `eliteCount` genomes are copied unchanged
 * (best first), the rest are tournament-selected parents → crossover → mutation.
 */
export function nextGeneration(
  genomes: ReadonlyArray<Genome>,
  fitnesses: ReadonlyArray<number>,
  config: Pick<GaConfig, "populationSize" | "mutationRate" | "eliteCount" | "tournamentSize" | "crossover"> &
    Partial<Pick<GaConfig, "frontierRate" | "frontierReroll" | "repairRate">>,
  rng: Rng = Math.random,
  /**
   * Per genome: index of the gene where it got stuck (its last move), or -1 to skip
   * (e.g. it reached the goal). Enables frontier mutation.
   */
  frontierGenes?: ReadonlyArray<number>,
  /** Per genome: indices of the genes that hit a wall (enables wall-hit repair). */
  bumpGenes?: ReadonlyArray<ReadonlyArray<number>>
): Genome[] {
  const order = rankIndices(fitnesses);
  const next: Genome[] = [];
  const elites = Math.min(config.eliteCount, genomes.length, config.populationSize);
  for (let i = 0; i < elites; i++) next.push(genomes[order[i]!]!.slice());
  while (next.length < config.populationSize) {
    const ia = tournamentSelect(fitnesses, config.tournamentSize, rng);
    const pa = genomes[ia]!;
    const pb = genomes[tournamentSelect(fitnesses, config.tournamentSize, rng)]!;
    let child = mutate(crossover(pa, pb, rng, config.crossover), config.mutationRate, rng);
    const bumps = bumpGenes?.[ia];
    if (bumps && bumps.length > 0 && config.repairRate && rng() < config.repairRate) {
      const gi = bumps[Math.floor(rng() * bumps.length)]!;
      child = deleteGene(child, gi, rng);
    }
    const fg = frontierGenes?.[ia] ?? -1;
    if (fg >= 0 && fg < child.length && config.frontierRate && rng() < config.frontierRate) {
      child[fg] = ((child[fg]! + 1 + Math.min(2, Math.floor(rng() * 3))) % 4) as Action;
      const k = config.frontierReroll ?? 0;
      for (let i = fg + 1; i < Math.min(child.length, fg + 1 + k); i++) child[i] = randomAction(rng);
    }
    next.push(child);
  }
  return next;
}

export function defaultGenomeLength(shortestPath: number, multiplier: number, minLength: number): number {
  return Math.max(minLength, Math.round(Math.max(1, shortestPath) * multiplier));
}

export interface GenerationStats {
  generation: number;
  best: number;
  avg: number;
  reached: number;
  died: number;
  outOfMoves: number;
  bestIndex: number;
  /** Fewest steps among walkers that reached the goal (null if none). */
  bestSteps: number | null;
}

/**
 * Stateful GA over one maze + start. `evaluate()` walks every genome
 * (all trajectories are precomputed so the UI can animate them in lock-step),
 * `evolve()` breeds the next generation.
 */
export class GeneticSolver {
  readonly maze: Maze;
  readonly start: Position;
  readonly config: GaConfig;
  readonly weights: FitnessWeights;
  readonly distToGoal: Int32Array;
  readonly maxDist: number;
  readonly shortestPath: number;
  readonly genomeLength: number;

  generation = 1;
  genomes: Genome[];
  runs: WalkerRun[] = [];
  fitnesses: number[] = [];
  history: GenerationStats[] = [];
  /** Generation in which a walker first reached the goal (null until then). */
  firstSolvedGeneration: number | null = null;

  private readonly rng: Rng;
  private readonly walkContext: WalkContext;

  constructor(
    maze: Maze,
    start: Position,
    config: Partial<GaConfig> = {},
    rng: Rng = Math.random,
    weights: FitnessWeights = DEFAULT_FITNESS_WEIGHTS
  ) {
    this.maze = maze;
    this.start = { ...start };
    this.config = { ...DEFAULT_GA_CONFIG, ...config };
    this.weights = weights;
    this.rng = rng;
    this.walkContext = createWalkContext(maze);
    this.distToGoal = bfsDistances(maze, maze.exit);
    this.maxDist = maxDistance(this.distToGoal);
    this.shortestPath = this.distToGoal[indexOf(maze, start)] ?? -1;
    this.genomeLength = defaultGenomeLength(
      this.shortestPath,
      this.config.genomeMultiplier,
      this.config.minGenomeLength
    );
    this.genomes = [];
    for (let i = 0; i < this.config.populationSize; i++) {
      this.genomes.push(randomGenome(this.genomeLength, rng));
    }
  }

  get fitnessContext(): FitnessContext {
    return { distToGoal: this.distToGoal, maxDist: this.maxDist, genomeLength: this.genomeLength };
  }

  /** Walk every genome and score it. Returns this generation's stats. */
  evaluate(): GenerationStats {
    const ctx = this.fitnessContext;
    this.runs = this.genomes.map((g) => runWalker(this.maze, this.start, g, this.config.lives, this.walkContext));
    this.fitnesses = this.runs.map((r) => fitness(r, ctx, this.weights));
    let sum = 0;
    let bestIndex = 0;
    let reached = 0;
    let died = 0;
    let outOfMoves = 0;
    let bestSteps: number | null = null;
    for (let i = 0; i < this.runs.length; i++) {
      const f = this.fitnesses[i]!;
      sum += f;
      if (f > this.fitnesses[bestIndex]!) bestIndex = i;
      const run = this.runs[i]!;
      if (run.end === "goal") {
        reached += 1;
        if (bestSteps === null || run.steps < bestSteps) bestSteps = run.steps;
      } else if (run.end === "dead") died += 1;
      else outOfMoves += 1;
    }
    const stats: GenerationStats = {
      generation: this.generation,
      best: this.fitnesses[bestIndex] ?? 0,
      avg: this.runs.length ? sum / this.runs.length : 0,
      reached,
      died,
      outOfMoves,
      bestIndex,
      bestSteps
    };
    if (reached > 0 && this.firstSolvedGeneration === null) {
      this.firstSolvedGeneration = this.generation;
    }
    this.history.push(stats);
    return stats;
  }

  /** Breed the next generation from the evaluated one. */
  evolve(): void {
    if (this.fitnesses.length !== this.genomes.length) this.evaluate();
    this.genomes = nextGeneration(
      this.genomes,
      this.fitnesses,
      this.config,
      this.rng,
      this.runs.map((r) => (r.end === "goal" ? -1 : r.steps - 1)),
      this.runs.map((r) => r.bumps.map((b) => b.step - 1))
    );
    this.generation += 1;
    this.runs = [];
    this.fitnesses = [];
  }

  /** Live-tweak breeding parameters (take effect from the next generation). */
  setMutationRate(rate: number): void {
    this.config.mutationRate = rate;
  }
}
