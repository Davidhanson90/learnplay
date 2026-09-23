import { type Matrix, createMatrix, mapMatrix, mean } from "./matrix.js";
import { createDenseLayer, forwardLayer, backwardLayer, type DenseLayer } from "./layer.js";
import type { ActivationName } from "./activations.js";

export type MlpConfig = {
  /** Layer sizes including input and output, e.g. [2, 8, 8, 1] */
  sizes: number[];
  /** Hidden activation (output is always sigmoid for binary classification). */
  hiddenActivation?: ActivationName;
  learningRate?: number;
  seed?: number;
};

export type Mlp = {
  layers: DenseLayer[];
  learningRate: number;
  sizes: number[];
};

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function createMlp(config: MlpConfig): Mlp {
  const { sizes } = config;
  if (sizes.length < 2) {
    throw new Error("MLP needs at least input and output sizes");
  }
  if (sizes[0] !== 2 || sizes[sizes.length - 1] !== 1) {
    throw new Error("This demo MLP expects input size 2 and output size 1");
  }

  const hiddenAct: ActivationName = config.hiddenActivation ?? "relu";
  const rng = config.seed !== undefined ? mulberry32(config.seed) : Math.random;
  const layers: DenseLayer[] = [];

  for (let i = 0; i < sizes.length - 1; i++) {
    const isOutput = i === sizes.length - 2;
    layers.push(
      createDenseLayer(sizes[i]!, sizes[i + 1]!, isOutput ? "sigmoid" : hiddenAct, rng)
    );
  }

  return {
    layers,
    learningRate: config.learningRate ?? 0.1,
    sizes: [...sizes]
  };
}

export function forward(mlp: Mlp, input: Matrix): Matrix {
  let x = input;
  for (const layer of mlp.layers) {
    x = forwardLayer(layer, x);
  }
  return x;
}

/** Binary cross-entropy loss (mean over batch). Predictions in (0,1), targets 0 or 1. */
export function binaryCrossEntropy(pred: Matrix, target: Matrix): number {
  if (pred.rows !== target.rows || pred.cols !== target.cols) {
    throw new Error("bce shape mismatch");
  }
  const eps = 1e-7;
  let sum = 0;
  for (let i = 0; i < pred.data.length; i++) {
    const p = Math.min(1 - eps, Math.max(eps, pred.data[i]!));
    const y = target.data[i]!;
    sum += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  }
  return sum / pred.rows;
}

/** dL/d(pred) for mean BCE. */
export function binaryCrossEntropyGrad(pred: Matrix, target: Matrix): Matrix {
  const eps = 1e-7;
  const out = createMatrix(pred.rows, pred.cols);
  for (let i = 0; i < pred.data.length; i++) {
    const p = Math.min(1 - eps, Math.max(eps, pred.data[i]!));
    const y = target.data[i]!;
    out.data[i] = (-(y / p) + (1 - y) / (1 - p)) / pred.rows;
  }
  return out;
}

export function mse(pred: Matrix, target: Matrix): number {
  let sum = 0;
  for (let i = 0; i < pred.data.length; i++) {
    const d = pred.data[i]! - target.data[i]!;
    sum += d * d;
  }
  return sum / pred.rows;
}

export function mseGrad(pred: Matrix, target: Matrix): Matrix {
  return mapMatrix(pred, (p, i) => (2 * (p - target.data[i]!)) / pred.rows);
}

export type LossKind = "bce" | "mse";

export type TrainStepResult = {
  loss: number;
  accuracy: number;
};

export function accuracy(pred: Matrix, target: Matrix, threshold = 0.5): number {
  let correct = 0;
  for (let i = 0; i < pred.rows; i++) {
    const p = pred.data[i]! >= threshold ? 1 : 0;
    if (p === target.data[i]!) correct++;
  }
  return pred.rows === 0 ? 0 : correct / pred.rows;
}

/**
 * One SGD step on a batch: forward → loss → backward with weight updates.
 */
export function trainStep(
  mlp: Mlp,
  inputs: Matrix,
  targets: Matrix,
  lossKind: LossKind = "bce"
): TrainStepResult {
  const pred = forward(mlp, inputs);
  const loss = lossKind === "bce" ? binaryCrossEntropy(pred, targets) : mse(pred, targets);
  let grad = lossKind === "bce" ? binaryCrossEntropyGrad(pred, targets) : mseGrad(pred, targets);

  for (let i = mlp.layers.length - 1; i >= 0; i--) {
    grad = backwardLayer(mlp.layers[i]!, grad, mlp.learningRate);
  }

  return { loss, accuracy: accuracy(pred, targets) };
}

/** Predict class probabilities for a list of [x,y] points. */
export function predictProba(mlp: Mlp, points: Array<[number, number]>): number[] {
  if (points.length === 0) return [];
  const input = createMatrix(points.length, 2);
  for (let i = 0; i < points.length; i++) {
    input.data[i * 2] = points[i]![0];
    input.data[i * 2 + 1] = points[i]![1];
  }
  const out = forward(mlp, input);
  return Array.from(out.data);
}

export function setLearningRate(mlp: Mlp, lr: number): void {
  mlp.learningRate = lr;
}

export { mean };
