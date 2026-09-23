# learnplay

A browser-only **maze-solver learning demo**. Generate a random maze, click to place a ball, hit **Train**, and watch **tabular Q-learning** explore, improve, and eventually find the exit — with a live Q-value heatmap.

**Live demo:** [https://davidhanson90.github.io/learnplay/](https://davidhanson90.github.io/learnplay/)

No TensorFlow.js, no API keys, no backend. Pure TypeScript + Lit + Vite.

## What you can learn by playing

- How **Q-learning** stores a value for every (cell, move) pair
- **Explore vs exploit**: high ε → random moves; decaying ε → follow the best Q
- Rewards: big bonus for the exit, small step cost, wall bump penalty
- Why a **heatmap of max Q** lights up the useful corridors as the agent learns
- Resetting the Q-table (new maze / new start) makes learning visible from scratch again

## How to use

1. Open the demo (or `npm start` locally)
2. Optionally change maze size, then **New maze**
3. **Click an open cell** to place the ball (start). This resets the Q-table.
4. Hit **Train** — the ball runs episodes; watch episode count, ε, success rate, and heatmap
5. After several successes, the demo may auto-run a **greedy (ε=0) playback**; you can also click **Greedy play**
6. **Pause** / **Reset learning** as needed

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

## Features

1. Perfect grid mazes (recursive backtracker) with one exit
2. Click-to-place agent; New maze regenerates + resets learning
3. Tabular Q-learning with tunable α, γ, ε start, and training speed
4. Live ball animation, episode stats, rolling success rate
5. Q-value heatmap overlay
6. Optional / auto greedy playback of the learned path
7. Short in-UI notes on explore/exploit and rewards

## Tech stack

- TypeScript + Vite
- Lit web components
- From-scratch maze generation + tabular Q-learning
- Vitest + ESLint
- GitHub Actions → verify on `main` + deploy `dist/` to GitHub Pages

## Project layout

```
src/
  maze/      # generation, movement, types
  rl/        # tabular Q-learning agent
  ui/        # Lit playground + maze canvas
  styles/    # theme
.github/workflows/
  verify-main.yml
  deploy-pages.yml
```

## License

MIT
