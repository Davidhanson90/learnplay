# Changelog

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
