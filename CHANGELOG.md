# Changelog

## 0.3.0 — 2026-09-27

- **Genetic algorithm is now the default mode.** A population (default 100) of fixed-length move genomes walks the maze in lock-step; every walker leaves a semi-transparent trail, wall hits show as red ticks, dead walkers get an ✕, finishers glow at the exit
- 10 points per walker: a wall hit costs 1 point (walker stays put), 0 points = dead
- Fitness by true BFS maze distance to the exit, + goal bonus, + speed bonus, + points left, − revisits
- Elitism, tournament selection, single-point crossover, per-gene mutation, plus a “frontier” mutation that re-rolls the move where each parent got stuck
- End-of-generation best-path highlight, then the maze clears for the next generation
- Controls: Train / Pause / Step gen / Reset, speed (2 steps/s → 1 generation per frame), population, mutation rate, genome length, trail colouring (per walker or by fitness)
- Live stats (generation, moving / reached / died / out of moves, best & average fitness, first solved generation) and a fitness-over-generations chart
- Q-learning kept as a second mode behind a toggle (`#qlearning`); both share the maze and click-to-move start
- Tests for walker point loss / death / goal stop, BFS distance fitness, genetic operators and elitism

## 0.2.0 — 2026-09-23

- **Pivot:** replace the 2D MLP classification playground with a **maze-solver learning demo**
- Perfect mazes via recursive backtracker (DFS carving); one marked exit
- Click an open cell to spawn the agent ball; **New maze** regenerates + resets learning
- Tabular Q-learning (ε-greedy, α, γ, ε decay) with live animation and Q-value heatmap
- Train / Pause / Reset learning, speed control, greedy playback after successes
- Remove unused MLP / toy-dataset classification code
- Tests for maze generation, movement, and Q-learning improvement

## 0.1.0 — 2026-09-23

- Initial public release of **learnplay** (neural net classification playground)
- From-scratch TypeScript MLP (ReLU + sigmoid, BCE, SGD)
- Toy datasets: moons, XOR blobs, concentric circles
- Lit playground with click-to-add points, live boundary + loss chart
- Vite demo app with GitHub Pages deploy workflow
