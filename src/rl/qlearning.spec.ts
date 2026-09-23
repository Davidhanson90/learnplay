import { describe, expect, it } from "vitest";
import { createFixedTestMaze } from "../maze/generate.js";
import { QAgent } from "./qlearning.js";

describe("QAgent", () => {
  it("improves toward solving a tiny maze (success rate and Q near exit)", () => {
    const maze = createFixedTestMaze();
    const start = { row: 1, col: 1 };
    let s = 99;
    const random = (): number => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 0x100000000;
    };

    const agent = new QAgent(
      maze,
      {
        alpha: 0.35,
        gamma: 0.9,
        epsilon: 1,
        epsilonDecay: 0.98,
        epsilonMin: 0.05,
        maxSteps: 80
      },
      random
    );

    let earlyOk = 0;
    const earlyN = 12;
    for (let i = 0; i < earlyN; i++) {
      if (agent.runEpisode(start).success) earlyOk += 1;
    }
    const earlyRate = earlyOk / earlyN;
    const qAfterEarly = agent.maxQ({ row: 3, col: 2 });

    for (let i = 0; i < 180; i++) agent.runEpisode(start);
    const lateRate = agent.successRate();
    const qNearExit = agent.maxQ({ row: 3, col: 2 });

    expect(lateRate).toBeGreaterThan(0.6);
    expect(lateRate).toBeGreaterThanOrEqual(earlyRate);
    expect(qNearExit).toBeGreaterThan(0);
    expect(qNearExit).toBeGreaterThanOrEqual(qAfterEarly);
  });

  it("resetLearning clears Q and episode counters", () => {
    const maze = createFixedTestMaze();
    const agent = new QAgent(maze, { epsilon: 0.5 });
    agent.runEpisode({ row: 1, col: 1 });
    expect(agent.episode).toBe(1);
    expect(agent.maxAbsQ()).toBeGreaterThan(0);
    agent.resetLearning();
    expect(agent.episode).toBe(0);
    expect(agent.epsilon).toBe(0.5);
    expect(agent.maxAbsQ()).toBe(0);
    expect(agent.recentSuccesses.length).toBe(0);
  });

  it("greedy mode does not decay epsilon or bump episode", () => {
    const maze = createFixedTestMaze();
    const agent = new QAgent(maze, { epsilon: 0.8, epsilonDecay: 0.5 });
    agent.runEpisode({ row: 1, col: 1 }, true);
    expect(agent.episode).toBe(0);
    expect(agent.epsilon).toBe(0.8);
  });

  it("update and takeStep change Q-values", () => {
    const maze = createFixedTestMaze();
    const agent = new QAgent(maze, { alpha: 0.5, gamma: 0.9, epsilon: 0 });
    const pos = { row: 1, col: 1 };
    agent.update(pos, 1, 1, { row: 1, col: 2 }, false);
    expect(agent.qValue(pos, 1)).toBeGreaterThan(0);

    // Bias east so greedy takeStep moves east
    agent.q[agent.stateIndex(pos) * 4 + 1] = 5;
    const result = agent.takeStep(pos, true);
    expect(result.action).toBe(1);
    expect(result.next).toEqual({ row: 1, col: 2 });
  });

  it("endEpisode decays epsilon and tracks success window", () => {
    const maze = createFixedTestMaze();
    const agent = new QAgent(maze, {
      epsilon: 1,
      epsilonDecay: 0.5,
      epsilonMin: 0.1
    });
    agent.endEpisode(true);
    expect(agent.episode).toBe(1);
    expect(agent.epsilon).toBe(0.5);
    expect(agent.successRate()).toBe(1);
    agent.endEpisode(false);
    expect(agent.successRate()).toBe(0.5);
  });
});
