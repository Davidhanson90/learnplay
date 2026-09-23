/** Toy 2D binary classification datasets. Coordinates roughly in [-1.2, 1.2]. */

export type Point = {
  x: number;
  y: number;
  /** Class label: 0 or 1 */
  label: 0 | 1;
};

export type DatasetName = "moons" | "xor" | "circles";

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  // Box-Muller
  const u = Math.max(1e-12, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Two interlocking half-moons (classic non-linear separable set). */
export function generateMoons(n = 120, noise = 0.08, seed = 42): Point[] {
  const rng = mulberry32(seed);
  const points: Point[] = [];
  const half = Math.floor(n / 2);

  for (let i = 0; i < half; i++) {
    const t = (Math.PI * i) / Math.max(1, half - 1);
    points.push({
      x: Math.cos(t) + gaussian(rng) * noise,
      y: Math.sin(t) + gaussian(rng) * noise,
      label: 0
    });
  }
  for (let i = 0; i < n - half; i++) {
    const t = (Math.PI * i) / Math.max(1, n - half - 1);
    points.push({
      x: 1 - Math.cos(t) + gaussian(rng) * noise,
      y: 0.5 - Math.sin(t) + gaussian(rng) * noise,
      label: 1
    });
  }
  return normalizePoints(points);
}

/** Four XOR-like Gaussian blobs in the corners of a square. */
export function generateXor(n = 120, noise = 0.12, seed = 7): Point[] {
  const rng = mulberry32(seed);
  const centers: Array<{ x: number; y: number; label: 0 | 1 }> = [
    { x: -0.7, y: -0.7, label: 0 },
    { x: 0.7, y: 0.7, label: 0 },
    { x: -0.7, y: 0.7, label: 1 },
    { x: 0.7, y: -0.7, label: 1 }
  ];
  const points: Point[] = [];
  for (let i = 0; i < n; i++) {
    const c = centers[i % 4]!;
    points.push({
      x: c.x + gaussian(rng) * noise,
      y: c.y + gaussian(rng) * noise,
      label: c.label
    });
  }
  return points;
}

/** Concentric circles (inner ring vs outer ring). */
export function generateCircles(n = 120, noise = 0.06, seed = 99): Point[] {
  const rng = mulberry32(seed);
  const points: Point[] = [];
  const half = Math.floor(n / 2);

  for (let i = 0; i < half; i++) {
    const angle = rng() * Math.PI * 2;
    const r = 0.35 + gaussian(rng) * noise;
    points.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      label: 0
    });
  }
  for (let i = 0; i < n - half; i++) {
    const angle = rng() * Math.PI * 2;
    const r = 0.85 + gaussian(rng) * noise;
    points.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      label: 1
    });
  }
  return points;
}

/** Shift/scale moons into a nicer viewing box roughly [-1.1, 1.1]. */
function normalizePoints(points: Point[]): Point[] {
  if (points.length === 0) return points;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const scale = 2 / span;
  return points.map((p) => ({
    x: (p.x - cx) * scale,
    y: (p.y - cy) * scale,
    label: p.label
  }));
}

export function generateDataset(name: DatasetName, n = 120, seed?: number): Point[] {
  if (name === "moons") return generateMoons(n, 0.08, seed ?? 42);
  if (name === "xor") return generateXor(n, 0.12, seed ?? 7);
  return generateCircles(n, 0.06, seed ?? 99);
}

export function pointsToMatrices(points: Point[]): {
  inputs: Float64Array;
  targets: Float64Array;
  rows: number;
} {
  const rows = points.length;
  const inputs = new Float64Array(rows * 2);
  const targets = new Float64Array(rows);
  for (let i = 0; i < rows; i++) {
    inputs[i * 2] = points[i]!.x;
    inputs[i * 2 + 1] = points[i]!.y;
    targets[i] = points[i]!.label;
  }
  return { inputs, targets, rows };
}
