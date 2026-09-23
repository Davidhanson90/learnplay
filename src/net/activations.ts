/** Activation functions and derivatives for the MLP. */

export function relu(x: number): number {
  return x > 0 ? x : 0;
}

export function reluDerivative(x: number): number {
  return x > 0 ? 1 : 0;
}

export function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

export function sigmoidDerivative(y: number): number {
  // y is already sigmoid(x)
  return y * (1 - y);
}

export type ActivationName = "relu" | "sigmoid";

export function activate(name: ActivationName, x: number): number {
  return name === "relu" ? relu(x) : sigmoid(x);
}

/** Derivative w.r.t. pre-activation, given activated output y (and optionally pre-act z). */
export function activateDerivative(name: ActivationName, y: number, z?: number): number {
  if (name === "relu") {
    return reluDerivative(z ?? y);
  }
  return sigmoidDerivative(y);
}
