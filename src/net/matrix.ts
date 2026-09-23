/** Flat row-major matrix helpers for the tiny MLP. */

export type Matrix = {
  rows: number;
  cols: number;
  data: Float64Array;
};

export function createMatrix(rows: number, cols: number, fill = 0): Matrix {
  return { rows, cols, data: new Float64Array(rows * cols).fill(fill) };
}

export function matrixFrom(rows: number, cols: number, values: number[]): Matrix {
  if (values.length !== rows * cols) {
    throw new Error(`Expected ${rows * cols} values, got ${values.length}`);
  }
  return { rows, cols, data: Float64Array.from(values) };
}

export function cloneMatrix(m: Matrix): Matrix {
  return { rows: m.rows, cols: m.cols, data: new Float64Array(m.data) };
}

export function get(m: Matrix, r: number, c: number): number {
  return m.data[r * m.cols + c]!;
}

export function set(m: Matrix, r: number, c: number, v: number): void {
  m.data[r * m.cols + c] = v;
}

export function zerosLike(m: Matrix): Matrix {
  return createMatrix(m.rows, m.cols, 0);
}

/** He / Xavier-style uniform init in [-scale, scale]. */
export function randomMatrix(
  rows: number,
  cols: number,
  scale: number,
  rng: () => number = Math.random
): Matrix {
  const m = createMatrix(rows, cols);
  for (let i = 0; i < m.data.length; i++) {
    m.data[i] = (rng() * 2 - 1) * scale;
  }
  return m;
}

/** C = A @ B  (rowsA x colsB) */
export function matMul(a: Matrix, b: Matrix): Matrix {
  if (a.cols !== b.rows) {
    throw new Error(`matMul shape mismatch: ${a.rows}x${a.cols} @ ${b.rows}x${b.cols}`);
  }
  const out = createMatrix(a.rows, b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let k = 0; k < a.cols; k++) {
      const aik = get(a, i, k);
      for (let j = 0; j < b.cols; j++) {
        out.data[i * out.cols + j]! += aik * get(b, k, j);
      }
    }
  }
  return out;
}

/** C = A^T @ B */
export function matMulTransposeA(a: Matrix, b: Matrix): Matrix {
  if (a.rows !== b.rows) {
    throw new Error(`matMulTransposeA mismatch: ${a.rows}x${a.cols}^T @ ${b.rows}x${b.cols}`);
  }
  const out = createMatrix(a.cols, b.cols);
  for (let i = 0; i < a.cols; i++) {
    for (let k = 0; k < a.rows; k++) {
      const aki = get(a, k, i);
      for (let j = 0; j < b.cols; j++) {
        out.data[i * out.cols + j]! += aki * get(b, k, j);
      }
    }
  }
  return out;
}

/** C = A @ B^T */
export function matMulTransposeB(a: Matrix, b: Matrix): Matrix {
  if (a.cols !== b.cols) {
    throw new Error(`matMulTransposeB mismatch: ${a.rows}x${a.cols} @ ${b.rows}x${b.cols}^T`);
  }
  const out = createMatrix(a.rows, b.rows);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < b.rows; j++) {
      let sum = 0;
      for (let k = 0; k < a.cols; k++) {
        sum += get(a, i, k) * get(b, j, k);
      }
      set(out, i, j, sum);
    }
  }
  return out;
}

/** Element-wise: out[i,j] = a[i,j] + b[j] (broadcast bias row). */
export function addBias(a: Matrix, bias: Matrix): Matrix {
  if (bias.rows !== 1 || bias.cols !== a.cols) {
    throw new Error(`addBias mismatch: ${a.rows}x${a.cols} + bias ${bias.rows}x${bias.cols}`);
  }
  const out = createMatrix(a.rows, a.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      set(out, i, j, get(a, i, j) + get(bias, 0, j));
    }
  }
  return out;
}

/** Sum columns of a into a 1 x cols bias gradient. */
export function sumRows(a: Matrix): Matrix {
  const out = createMatrix(1, a.cols, 0);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      out.data[j]! += get(a, i, j);
    }
  }
  return out;
}

/** Element-wise multiply. */
export function hadamard(a: Matrix, b: Matrix): Matrix {
  if (a.rows !== b.rows || a.cols !== b.cols) {
    throw new Error("hadamard shape mismatch");
  }
  const out = createMatrix(a.rows, a.cols);
  for (let i = 0; i < a.data.length; i++) {
    out.data[i] = a.data[i]! * b.data[i]!;
  }
  return out;
}

/** Apply fn element-wise. */
export function mapMatrix(m: Matrix, fn: (v: number, i: number) => number): Matrix {
  const out = createMatrix(m.rows, m.cols);
  for (let i = 0; i < m.data.length; i++) {
    out.data[i] = fn(m.data[i]!, i);
  }
  return out;
}

/** In-place: m -= lr * grad */
export function sgdUpdate(m: Matrix, grad: Matrix, lr: number): void {
  if (m.rows !== grad.rows || m.cols !== grad.cols) {
    throw new Error("sgdUpdate shape mismatch");
  }
  for (let i = 0; i < m.data.length; i++) {
    m.data[i]! -= lr * grad.data[i]!;
  }
}

export function mean(values: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < values.length; i++) s += values[i]!;
  return values.length === 0 ? 0 : s / values.length;
}
