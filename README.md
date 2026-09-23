# learnplay

A browser-only **neural net playground**. Train a tiny multilayer perceptron on 2D toy datasets and watch learning happen live — decision boundary, loss curve, epoch / loss / accuracy readouts.

**Live demo:** [https://davidhanson90.github.io/learnplay/](https://davidhanson90.github.io/learnplay/)

No TensorFlow.js, no API keys, no backend. The network is a few hundred lines of typed TypeScript.

## What you can learn by playing

- How a **forward pass** turns coordinates into a class probability
- What **binary cross-entropy loss** looks like as it falls over epochs
- How **backpropagation + SGD** reshape the decision boundary
- Why **hidden layer size / depth** and **learning rate** change what the net can fit (moons, XOR blobs, concentric circles)

Click the canvas to add your own Class A / Class B points and see if the net can catch up.

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

## Features (v1)

1. Switchable toy datasets: **two moons**, **XOR blobs**, **concentric circles**
2. Click-to-add points with Class A / Class B paint toggle
3. Network config: hidden size, depth, learning rate (ReLU hidden + sigmoid output)
4. Train / Pause / Reset; training runs in `requestAnimationFrame` batches
5. Live decision-boundary heatmap + loss chart
6. Epoch, loss, and accuracy readouts
7. Short in-UI notes on forward pass, loss, and backprop

## Tech stack

- TypeScript + Vite
- Lit web components
- From-scratch MLP (matrix helpers, dense layers, BCE, SGD)
- Vitest + ESLint
- GitHub Actions → verify on `main` + deploy `dist/` to GitHub Pages

## Project layout

```
src/
  net/       # matrix, activations, layer, mlp
  data/      # dataset generators
  ui/        # Lit playground, canvas, loss chart
  styles/    # theme
.github/workflows/
  verify-main.yml
  deploy-pages.yml
```

## License

MIT
