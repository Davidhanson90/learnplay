# learnplay

A browser-only **maze-solver learning demo**. Generate a random maze and watch a **genetic algorithm** evolve walkers that find the exit — every walker of every generation is drawn on the maze with its trail. A second mode keeps the original **tabular Q-learning** solver for comparison.

**Live demo:** [https://davidhanson90.github.io/learnplay/](https://davidhanson90.github.io/learnplay/)

No TensorFlow.js, no API keys, no backend. Pure TypeScript + Lit + Vite.

## Genetic algorithm mode (default)

- Each **walker** has a genome: a fixed-length list of moves (↑ → ↓ ←), default length = 2 × the shortest path from start to exit (adjustable 1.5×–4×).
- All walkers of a generation (default **100**) move **at the same time**, one gene per step, each leaving a semi-transparent trail.
- Every walker starts with **10 points**. Trying to move into a wall (or off the grid) costs **1 point** and the walker stays where it is (red tick). At **0 points it dies** (✕) and stops. Walkers that reach the exit stop there (glowing ring + count). Marker opacity shows points left.
- When everyone has stopped (dead, at the goal, or out of moves) the **best path is highlighted**, then the maze is cleared and the next generation starts.

**Fitness**

```
closeness = 1 − d / dMax        d    = BFS maze distance (along corridors) from where it stopped to the exit
                                dMax = BFS distance of the farthest open cell
fitness   = 100 · closeness
          + (reached exit ? 100 + 50 · (1 − steps / genomeLength) : 0)
          + 1 · pointsLeft
          − 0.2 · revisitedCells          (clamped at ≥ 0)
```

True maze distance matters: straight-line distance would reward walkers that get stuck on the far side of a wall next to the exit.

**Breeding:** top 4 genomes copied unchanged (elitism); parents chosen by tournament (best of 5); single-point crossover; per-gene mutation (default 0.2 % per gene); plus a *frontier mutation* — each child re-rolls the move where its first parent got stuck (the wall hit that killed it, or its last move) and re-randomises the 10 moves after it; and *wall-hit repair* — half the children delete one move that made their parent hit a wall (later moves shift one step earlier, so the path is unchanged but a point is saved). Without that, a lineage that has spent all 10 points in its prefix can only progress when a random mutation happens to land on exactly that gene, and in testing 21×21 runs then typically needed several hundred generations or didn't solve within 1,000. With it, the median over 10 random 21×21 mazes was 76 generations to the first walker reaching the exit.

Controls: **Train / Pause / Step gen / Reset**, speed (2 steps/s up to one whole generation per frame), population size, mutation rate, genome length, and trail colouring (a hue per walker, or red→green by fitness). Stats show the generation, live moving / reached / died / out-of-moves counts, best & average fitness, first solved generation, and a fitness-over-generations chart.

## Maze sizes

11, 15, 21 (default), 31, 41, 51 and 65. Sizes count **grid squares including the walls**, and the recursive-backtracker layout needs an odd number of squares so every side has a border wall. The “64 × 64” maze is therefore **65 × 65** squares (32 × 32 rooms joined by corridors). The canvas uses whole-pixel cells so big mazes stay crisp and fits within the viewport height.

Speeds go up to **Turbo** (one generation per animation frame, no highlight pause), which is the mode to use on 51 / 65 mazes.

## Q-learning mode

Switch with the toggle (or open `#qlearning`). One ball runs episodes of **tabular Q-learning** (ε-greedy, α, γ, ε decay) with a live max-Q heatmap and optional greedy playback.

## How to use

1. Open the demo (or `npm start` locally). The GA starts training straight away.
2. Optionally change maze size, then **New maze**.
3. **Click an open cell** to move the start. This resets learning (new random population / cleared Q-table).
4. Use the speed slider to go from watching individual steps to racing through generations.

## Quick start

```bash
npm install
npm start
```

Open the URL Vite prints (usually `http://localhost:5173/learnplay/`).

Other scripts:

```bash
npm test           # vitest
npm run lint       # eslint
npm run build      # typecheck + production Vite build → dist/
npm run build:verify
```

## Tech stack

- TypeScript + Vite
- Lit web components; layered canvases (maze / incremental trails / walker sprites)
- From-scratch maze generation, genetic algorithm and tabular Q-learning
- Vitest + ESLint
- GitHub Actions → verify on `main` + deploy `dist/` to GitHub Pages

## Project layout

```
src/
  maze/      # generation, movement, BFS distances, types
  ga/        # walker simulation, fitness, genetic operators + solver
  rl/        # tabular Q-learning agent
  ui/        # Lit playground, GA + Q-learning mode views, maze canvas, fitness chart
  styles/    # theme
.github/workflows/
  verify-main.yml
  deploy-pages.yml
```

## License

MIT
