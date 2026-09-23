import {
  type Matrix,
  addBias,
  createMatrix,
  hadamard,
  mapMatrix,
  matMul,
  matMulTransposeA,
  matMulTransposeB,
  randomMatrix,
  sgdUpdate,
  sumRows
} from "./matrix.js";
import { activate, activateDerivative, type ActivationName } from "./activations.js";

export type DenseLayer = {
  weights: Matrix; // in x out
  bias: Matrix; // 1 x out
  activation: ActivationName;
  // caches from last forward
  input?: Matrix;
  preAct?: Matrix;
  output?: Matrix;
};

export function createDenseLayer(
  inputSize: number,
  outputSize: number,
  activation: ActivationName,
  rng: () => number = Math.random
): DenseLayer {
  // He-ish scale for ReLU, Xavier-ish for sigmoid
  const scale =
    activation === "relu"
      ? Math.sqrt(2 / inputSize)
      : Math.sqrt(1 / inputSize);
  return {
    weights: randomMatrix(inputSize, outputSize, scale, rng),
    bias: createMatrix(1, outputSize, 0),
    activation
  };
}

export function forwardLayer(layer: DenseLayer, input: Matrix): Matrix {
  const pre = addBias(matMul(input, layer.weights), layer.bias);
  const out = mapMatrix(pre, (v) => activate(layer.activation, v));
  layer.input = input;
  layer.preAct = pre;
  layer.output = out;
  return out;
}

/**
 * Backprop through a dense layer.
 * @param dOutput dL/d(output) — same shape as output
 * @returns dL/d(input)
 */
export function backwardLayer(layer: DenseLayer, dOutput: Matrix, learningRate: number): Matrix {
  if (!layer.input || !layer.preAct || !layer.output) {
    throw new Error("backwardLayer called before forward");
  }

  const dAct = mapMatrix(layer.output, (y, i) => {
    const z = layer.preAct!.data[i]!;
    return activateDerivative(layer.activation, y, z);
  });
  const dPre = hadamard(dOutput, dAct);

  const dW = matMulTransposeA(layer.input, dPre);
  const dB = sumRows(dPre);
  const dInput = matMulTransposeB(dPre, layer.weights);

  sgdUpdate(layer.weights, dW, learningRate);
  sgdUpdate(layer.bias, dB, learningRate);

  return dInput;
}
