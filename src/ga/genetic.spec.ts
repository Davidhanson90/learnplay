import { describe, expect, it } from "vitest";
import { createFixedTestMaze, generateMaze, mazeFromLayout } from "../maze/generate.js";
import type { Action } from "../maze/types.js";
import {
  DEFAULT_GA_CONFIG,
  GeneticSolver,
  crossover,
  defaultGenomeLength,
  mutate,
  nextGeneration,
  randomGenome,
  rankIndices,
  tournamentSelect
} from "./genetic.js";
import type { Genome } from "./walker.js";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const isValidMove = (g: number): boolean => g === 0 || g === 1 || g === 2 || g === 3;

describe("genetic operators", () => {
  it("creates random genomes of valid moves", () => {
    const g = randomGenome(500, lcg(1));
    expect(g).toHaveLength(500);
    expect(g.every(isValidMove)).toBe(true);
    expect(new Set(g).size).toBe(4);
  });

  it("crossover keeps genome length and valid moves (single-point and uniform)", () => {
    const rng = lcg(2);
    const a: Genome = new Array<Action>(40).fill(0);
    const b: Genome = new Array<Action>(40).fill(2);
    for (const kind of ["single-point", "uniform"] as const) {
      for (let t = 0; t < 50; t++) {
        const child = crossover(a, b, rng, kind);
        expect(child).toHaveLength(40);
        expect(child.every((g) => g === 0 || g === 2)).toBe(true);
      }
    }
  });

  it("single-point crossover takes a prefix of A and a suffix of B", () => {
    const a: Genome = new Array<Action>(10).fill(1);
    const b: Genome = new Array<Action>(10).fill(3);
    const child = crossover(a, b, () => 0.45, "single-point");
    expect(child).toEqual([1, 1, 1, 1, 3, 3, 3, 3, 3, 3]);
  });

  it("uniform crossover mixes genes position by position", () => {
    const a: Genome = new Array<Action>(200).fill(1);
    const b: Genome = new Array<Action>(200).fill(3);
    const child = crossover(a, b, lcg(9), "uniform");
    const fromA = child.filter((g) => g === 1).length;
    expect(fromA).toBeGreaterThan(60);
    expect(fromA).toBeLessThan(140);
  });

  it("mutation keeps length and valid moves; rate 0 is identity, rate 1 changes every gene", () => {
    const g = randomGenome(300, lcg(3));
    const same = mutate(g, 0, lcg(4));
    expect(same).toEqual(g);
    expect(same).not.toBe(g);

    const all = mutate(g, 1, lcg(5));
    expect(all).toHaveLength(300);
    expect(all.every(isValidMove)).toBe(true);
    expect(all.every((gene, i) => gene !== g[i])).toBe(true);

    const some = mutate(g, 0.1, lcg(6));
    const changed = some.filter((gene, i) => gene !== g[i]).length;
    expect(some.every(isValidMove)).toBe(true);
    expect(changed).toBeGreaterThan(10);
    expect(changed).toBeLessThan(60);
  });

  it("tournament selection favours the fittest", () => {
    const fit = [1, 5, 3, 9, 2];
    expect(tournamentSelect(fit, 50, lcg(7))).toBe(3);
    expect(tournamentSelect(fit, 1, () => 0.99)).toBe(4);
  });

  it("ranks indices best-first", () => {
    expect(rankIndices([2, 7, 7, 1])).toEqual([1, 2, 0, 3]);
  });

  it("elitism copies the best genomes unchanged to the front of the next generation", () => {
    const rng = lcg(8);
    const genomes = Array.from({ length: 20 }, () => randomGenome(30, rng));
    const fitnesses = genomes.map((_, i) => (i === 13 ? 100 : i === 4 ? 90 : i));
    const next = nextGeneration(
      genomes,
      fitnesses,
      { ...DEFAULT_GA_CONFIG, populationSize: 20, eliteCount: 2, mutationRate: 0.5 },
      rng,
      genomes.map(() => 10)
    );
    expect(next).toHaveLength(20);
    expect(next[0]).toEqual(genomes[13]);
    expect(next[1]).toEqual(genomes[4]);
    expect(next[0]).not.toBe(genomes[13]);
    for (const g of next) {
      expect(g).toHaveLength(30);
      expect(g.every(isValidMove)).toBe(true);
    }
  });

  it("frontier mutation changes the gene where the parent got stuck", () => {
    const parent: Genome = new Array<Action>(12).fill(1);
    const next = nextGeneration(
      [parent],
      [1],
      { populationSize: 6, eliteCount: 1, tournamentSize: 1, mutationRate: 0, crossover: "single-point", frontierRate: 1 },
      lcg(10),
      [5]
    );
    expect(next[0]).toEqual(parent);
    for (const child of next.slice(1)) {
      expect(child[5]).not.toBe(1);
      expect(child.filter((g, i) => i !== 5 && g !== 1)).toHaveLength(0);
    }
    const skipped = nextGeneration(
      [parent],
      [1],
      { populationSize: 3, eliteCount: 0, tournamentSize: 1, mutationRate: 0, crossover: "single-point", frontierRate: 1 },
      lcg(10),
      [-1]
    );
    expect(skipped.every((c) => c.every((g) => g === 1))).toBe(true);
  });

  it("sizes genomes from the shortest path", () => {
    expect(defaultGenomeLength(50, 2, 20)).toBe(100);
    expect(defaultGenomeLength(3, 2, 20)).toBe(20);
    expect(defaultGenomeLength(-1, 2, 20)).toBe(20);
  });
});

describe("GeneticSolver", () => {
  it("evaluates a population and reports stats", () => {
    const maze = createFixedTestMaze();
    const solver = new GeneticSolver(maze, { row: 1, col: 1 }, { populationSize: 30, minGenomeLength: 12 }, lcg(11));
    expect(solver.shortestPath).toBe(4);
    expect(solver.genomeLength).toBe(12);
    expect(solver.genomes).toHaveLength(30);
    const stats = solver.evaluate();
    expect(stats.generation).toBe(1);
    expect(stats.reached + stats.died + stats.outOfMoves).toBe(30);
    expect(stats.best).toBe(Math.max(...solver.fitnesses));
    expect(stats.avg).toBeLessThanOrEqual(stats.best);
    expect(solver.runs).toHaveLength(30);
    expect(solver.fitnessContext.genomeLength).toBe(12);
  });

  it("never loses its best fitness thanks to elitism", () => {
    const maze = generateMaze({ size: 11, random: lcg(12) });
    const solver = new GeneticSolver(maze, { row: 1, col: 1 }, { populationSize: 40 }, lcg(13));
    let prev = -Infinity;
    for (let g = 0; g < 25; g++) {
      const s = solver.evaluate();
      expect(s.best).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = s.best;
      solver.evolve();
    }
    expect(solver.generation).toBe(26);
    expect(solver.history).toHaveLength(25);
  });

  it("evolve() evaluates first if needed and mutation rate can be changed live", () => {
    const maze = createFixedTestMaze();
    const solver = new GeneticSolver(maze, { row: 1, col: 1 }, { populationSize: 10 }, lcg(14));
    solver.setMutationRate(0.3);
    expect(solver.config.mutationRate).toBe(0.3);
    solver.evolve();
    expect(solver.history).toHaveLength(1);
    expect(solver.generation).toBe(2);
    expect(solver.runs).toHaveLength(0);
  });

  it("solves a generated 21×21 maze within a few hundred generations", () => {
    const maze = generateMaze({ size: 21, random: lcg(1000) });
    const solver = new GeneticSolver(maze, { row: 1, col: 1 }, {}, lcg(5));
    for (let g = 0; g < 400 && solver.firstSolvedGeneration === null; g++) {
      solver.evaluate();
      if (solver.firstSolvedGeneration === null) solver.evolve();
    }
    expect(solver.firstSolvedGeneration).not.toBeNull();
    const last = solver.history.at(-1)!;
    expect(last.reached).toBeGreaterThan(0);
    expect(last.bestSteps).not.toBeNull();
  });

  it("handles a start sitting on the goal", () => {
    const maze = mazeFromLayout(["###", "#E#", "###"]);
    const solver = new GeneticSolver(maze, maze.exit, { populationSize: 4 }, lcg(15));
    const s = solver.evaluate();
    expect(s.reached).toBe(4);
    expect(s.bestSteps).toBe(0);
    expect(solver.firstSolvedGeneration).toBe(1);
  });
});
