import { LitElement, css, html, type PropertyValues } from "lit";
import type { WalkerRun } from "../ga/walker.js";
import type { Action, Maze, Position } from "../maze/index.js";
import { ACTION_DELTAS, isExit, isOpen } from "../maze/index.js";

/** Everything the canvas needs to draw one GA generation. */
export interface GaOverlay {
  /** Changes whenever a new generation (or maze/start) starts → trails are cleared. */
  id: number;
  runs: WalkerRun[];
  /** Trail colour per walker, as an "h s% l%" HSL triple. */
  colors: string[];
  lives: number;
}

/**
 * Canvas that draws the maze grid, optional Q-value heatmap, exit marker,
 * start cell and the animated Q-learning ball — plus, in GA mode, a trail
 * layer (incrementally drawn walker paths) and a sprite layer (walkers,
 * death crosses, best-path highlight).
 */
export class LpMazeCanvas extends LitElement {
  static properties = {
    maze: { attribute: false },
    agent: { attribute: false },
    start: { attribute: false },
    /** Per-cell max-Q values (same length as walls), or null to hide heatmap. */
    heatmap: { attribute: false },
    heatmapMax: { type: Number },
    showHeatmap: { type: Boolean },
    /** GA generation to draw (null = none). */
    ga: { attribute: false },
    /** Animation step revealed so far. */
    gaStep: { type: Number },
    /** Index of the walker whose path is highlighted (end of generation), or -1. */
    gaHighlight: { type: Number },
    hint: { type: String }
  };

  declare maze: Maze | null;
  declare agent: Position | null;
  declare start: Position | null;
  declare heatmap: Float64Array | null;
  declare heatmapMax: number;
  declare showHeatmap: boolean;
  declare ga: GaOverlay | null;
  declare gaStep: number;
  declare gaHighlight: number;
  declare hint: string;

  private baseEl: HTMLCanvasElement | null = null;
  private trailEl: HTMLCanvasElement | null = null;
  private spriteEl: HTMLCanvasElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private drawnGaId = -1;
  private drawnStep = 0;
  private pixelSize = 0;

  static styles = css`
    :host {
      display: block;
    }
    .wrap {
      position: relative;
      width: min(100%, calc(100vh - 32px));
      min-width: 240px;
      margin: 0 auto;
      aspect-ratio: 1;
      background: var(--lp-panel, #101827);
      border: 1px solid var(--lp-border, #2a3b55);
      border-radius: var(--lp-radius, 12px);
      overflow: hidden;
      cursor: crosshair;
    }
    canvas {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
    }
    canvas.overlay {
      pointer-events: none;
    }
    .hint {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      color: var(--lp-muted, #9aa8bc);
      font-size: 0.95rem;
      text-align: center;
      padding: 16px;
    }
  `;

  constructor() {
    super();
    this.maze = null;
    this.agent = null;
    this.start = null;
    this.heatmap = null;
    this.heatmapMax = 1;
    this.showHeatmap = true;
    this.ga = null;
    this.gaStep = 0;
    this.gaHighlight = -1;
    this.hint = "";
  }

  firstUpdated(): void {
    this.baseEl = this.renderRoot.querySelector("canvas.base");
    this.trailEl = this.renderRoot.querySelector("canvas.trails");
    this.spriteEl = this.renderRoot.querySelector("canvas.sprites");
    const wrap = this.renderRoot.querySelector(".wrap");
    if (wrap && typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.redrawAll());
      this.resizeObserver.observe(wrap);
    }
    this.redrawAll();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  updated(changed: PropertyValues<this>): void {
    if (!this.baseEl) return;
    const resized = this.syncSize();
    const baseKeys = ["maze", "start", "heatmap", "heatmapMax", "showHeatmap"] as const;
    if (resized || baseKeys.some((k) => changed.has(k))) this.drawBase();
    const gaChanged = changed.has("ga") || changed.has("gaStep") || changed.has("maze");
    if (resized || gaChanged) this.drawTrails(resized || changed.has("maze"));
    if (resized || gaChanged || changed.has("gaHighlight") || changed.has("agent")) this.drawSprites();
  }

  private redrawAll(): void {
    this.syncSize();
    this.drawBase();
    this.drawTrails(true);
    this.drawSprites();
  }

  /** Match canvas backing size to CSS size × DPR. Returns true if it changed. */
  private syncSize(): boolean {
    const canvas = this.baseEl;
    if (!canvas) return false;
    const dpr = window.devicePixelRatio || 1;
    const cssSize = canvas.clientWidth || 480;
    const size = Math.max(1, Math.floor(cssSize * dpr));
    if (size === this.pixelSize) return false;
    this.pixelSize = size;
    for (const c of [this.baseEl, this.trailEl, this.spriteEl]) {
      if (c) {
        c.width = size;
        c.height = size;
      }
    }
    return true;
  }

  private onClick = (ev: MouseEvent): void => {
    if (!this.maze || !this.baseEl) return;
    const rect = this.baseEl.getBoundingClientRect();
    const scale = this.pixelSize / Math.max(1, rect.width);
    const off = this.offset();
    const cell = this.cellSize();
    const col = Math.floor(((ev.clientX - rect.left) * scale - off) / cell);
    const row = Math.floor(((ev.clientY - rect.top) * scale - off) / cell);
    const pos: Position = { row, col };
    if (!isOpen(this.maze, pos)) return;
    if (isExit(this.maze, pos)) return;
    this.dispatchEvent(
      new CustomEvent("cell-click", {
        detail: { position: pos },
        bubbles: true,
        composed: true
      })
    );
  };

  /** Whole-pixel cell size so walls and corridors stay crisp at any maze size. */
  private cellSize(): number {
    return this.maze ? Math.max(1, Math.floor(this.pixelSize / this.maze.cols)) : 1;
  }

  /** Margin (device px) that centres the whole-pixel grid inside the canvas. */
  private offset(): number {
    return this.maze ? Math.floor((this.pixelSize - this.cellSize() * this.maze.cols) / 2) : 0;
  }

  /** Clear a layer and set its transform so (0,0) is the maze's top-left corner. */
  private prepare(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const off = this.offset();
    ctx.setTransform(1, 0, 0, 1, off, off);
  }

  private drawBase(): void {
    const canvas = this.baseEl;
    if (!canvas || !this.maze) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = this.pixelSize;
    const { maze } = this;
    const cell = this.cellSize();

    // Margin around the whole-pixel grid is drawn as wall.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, size, size);
    const off = this.offset();
    ctx.setTransform(1, 0, 0, 1, off, off);

    const heatMax = Math.max(1e-6, this.heatmapMax);

    for (let r = 0; r < maze.rows; r++) {
      for (let c = 0; c < maze.cols; c++) {
        const i = r * maze.cols + c;
        const x = c * cell;
        const y = r * cell;

        if (maze.walls[i]) {
          ctx.fillStyle = "#0a1220";
          ctx.fillRect(x, y, cell, cell);
          continue;
        }

        // Open cell base
        ctx.fillStyle = "#152238";
        ctx.fillRect(x, y, cell, cell);

        // Heatmap: max Q → blue→cyan→yellow
        if (this.showHeatmap && this.heatmap) {
          const v = this.heatmap[i] ?? 0;
          if (v > 0) {
            const t = Math.min(1, v / heatMax);
            ctx.fillStyle = heatColor(t);
            ctx.globalAlpha = 0.35 + 0.45 * t;
            ctx.fillRect(x, y, cell, cell);
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    // Exit
    const ex = maze.exit.col * cell;
    const ey = maze.exit.row * cell;
    ctx.fillStyle = "#3dd68c";
    ctx.beginPath();
    ctx.roundRect(ex + cell * 0.15, ey + cell * 0.15, cell * 0.7, cell * 0.7, cell * 0.12);
    ctx.fill();
    ctx.fillStyle = "#062816";
    ctx.font = `bold ${Math.max(6, cell * 0.45)}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("E", ex + cell / 2, ey + cell / 2 + 1);
    if (cell < 18) {
      // Tiny cells (big mazes): add a ring so the exit is easy to spot.
      ctx.strokeStyle = "rgba(61,214,140,0.85)";
      ctx.lineWidth = Math.max(1.5, cell * 0.15);
      ctx.beginPath();
      ctx.arc(ex + cell / 2, ey + cell / 2, cell * 1.3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Start marker (subtle ring)
    if (this.start) {
      const sx = this.start.col * cell + cell / 2;
      const sy = this.start.row * cell + cell / 2;
      ctx.strokeStyle = "rgba(91,157,255,0.75)";
      ctx.lineWidth = Math.max(1.5, cell * 0.08);
      ctx.beginPath();
      ctx.arc(sx, sy, cell * 0.36, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Centre of `cellIndex` for walker `w`, nudged by a per-walker offset so trails fan out. */
  private walkerPoint(cellIndex: number, w: number): [number, number] {
    const maze = this.maze!;
    const cell = this.cellSize();
    const [ox, oy] = walkerOffset(w);
    const row = Math.floor(cellIndex / maze.cols);
    const col = cellIndex % maze.cols;
    return [(col + 0.5 + ox * 0.44) * cell, (row + 0.5 + oy * 0.44) * cell];
  }

  /** Draw trail segments; incremental unless `full` or the generation changed. */
  private drawTrails(full: boolean): void {
    const canvas = this.trailEl;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ga = this.ga;
    if (!ga || !this.maze) {
      this.prepare(ctx);
      this.drawnGaId = -1;
      this.drawnStep = 0;
      return;
    }
    let from = this.drawnStep;
    if (full || ga.id !== this.drawnGaId || this.gaStep < this.drawnStep) {
      this.prepare(ctx);
      from = 0;
    } else {
      const off = this.offset();
      ctx.setTransform(1, 0, 0, 1, off, off);
    }
    const to = Math.max(0, Math.floor(this.gaStep));
    this.drawnGaId = ga.id;
    this.drawnStep = to;
    if (to <= from) return;

    const cell = this.cellSize();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, cell * 0.11);
    for (let w = 0; w < ga.runs.length; w++) {
      const run = ga.runs[w]!;
      const end = Math.min(to, run.path.length - 1);
      if (end <= from) continue;
      ctx.strokeStyle = `hsla(${ga.colors[w] ?? "200 80% 60%"} / 0.42)`;
      ctx.beginPath();
      let [px, py] = this.walkerPoint(run.path[from]!, w);
      ctx.moveTo(px, py);
      for (let s = from + 1; s <= end; s++) {
        const [x, y] = this.walkerPoint(run.path[s]!, w);
        if (x !== px || y !== py) ctx.lineTo(x, y);
        px = x;
        py = y;
      }
      ctx.stroke();

      // Wall bumps: a short red tick pointing at the wall that cost a point.
      if (run.bumps.length) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,107,138,0.55)";
        ctx.lineWidth = Math.max(1, cell * 0.07);
        ctx.beginPath();
        for (const b of run.bumps) {
          if (b.step <= from || b.step > end) continue;
          const [bx, by] = this.walkerPoint(b.cell, w);
          const [dr, dc] = ACTION_DELTAS[b.action as Action]!;
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + dc * cell * 0.3, by + dr * cell * 0.3);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawSprites(): void {
    const canvas = this.spriteEl;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    this.prepare(ctx);
    if (!this.maze) return;
    const cell = this.cellSize();
    if (this.agent) this.drawAgent(ctx, this.agent, cell);
    const ga = this.ga;
    if (!ga) return;

    const t = Math.max(0, Math.floor(this.gaStep));
    let atGoal = 0;

    // Highlighted best path underneath the markers.
    const hi = this.gaHighlight >= 0 ? ga.runs[this.gaHighlight] : undefined;
    if (hi) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = "rgba(255,214,102,0.9)";
      ctx.shadowBlur = cell * 0.6;
      ctx.strokeStyle = "rgba(255,214,102,0.95)";
      ctx.lineWidth = Math.max(2, cell * 0.24);
      ctx.beginPath();
      const maze = this.maze;
      const pt = (i: number): [number, number] => [
        ((i % maze.cols) + 0.5) * cell,
        (Math.floor(i / maze.cols) + 0.5) * cell
      ];
      const [x0, y0] = pt(hi.path[0]!);
      ctx.moveTo(x0, y0);
      for (let s = 1; s < hi.path.length; s++) {
        const [x, y] = pt(hi.path[s]!);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    for (let w = 0; w < ga.runs.length; w++) {
      const run = ga.runs[w]!;
      const i = Math.min(t, run.path.length - 1);
      const [x, y] = this.walkerPoint(run.path[i]!, w);
      const stopped = t >= run.steps;
      if (stopped && run.end === "dead") {
        drawCross(ctx, x, y, Math.max(2.5, cell * 0.2), Math.max(1.5, cell * 0.08));
        continue;
      }
      if (stopped && run.end === "goal") {
        atGoal += 1;
        continue;
      }
      const lives = run.lives[i] ?? ga.lives;
      const alpha = 0.25 + 0.75 * (lives / Math.max(1, ga.lives));
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2.5, cell * 0.17), 0, Math.PI * 2);
      if (stopped) {
        // Out of moves: hollow ring.
        ctx.strokeStyle = `rgba(200,210,225,${alpha.toFixed(3)})`;
        ctx.lineWidth = Math.max(1, cell * 0.06);
        ctx.stroke();
      } else {
        ctx.fillStyle = `hsla(${ga.colors[w] ?? "200 80% 60%"} / ${alpha.toFixed(3)})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.8).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, cell * 0.04);
        ctx.stroke();
      }
    }

    // Walkers that made it: glowing goal ring + count badge.
    if (atGoal > 0) {
      const gx = (this.maze.exit.col + 0.5) * cell;
      const gy = (this.maze.exit.row + 0.5) * cell;
      ctx.save();
      ctx.shadowColor = "rgba(61,214,140,0.95)";
      ctx.shadowBlur = cell * 0.8;
      ctx.strokeStyle = "#b8ffd9";
      ctx.lineWidth = Math.max(2, cell * 0.1);
      ctx.beginPath();
      ctx.arc(gx, gy, cell * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const label = `×${atGoal}`;
      ctx.font = `bold ${Math.max(11, cell * 0.5)}px system-ui,sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.lineWidth = Math.max(2, cell * 0.12);
      ctx.strokeStyle = "rgba(4,20,12,0.9)";
      ctx.strokeText(label, gx + cell * 0.45, gy - cell * 0.5);
      ctx.fillStyle = "#b8ffd9";
      ctx.fillText(label, gx + cell * 0.45, gy - cell * 0.5);
    }

    // Best walker label at the end of its path.
    if (hi) {
      const last = hi.path[hi.path.length - 1]!;
      const [x, y] = this.walkerPoint(last, this.gaHighlight);
      const text =
        hi.end === "goal" ? `best: goal in ${hi.steps} · ♥${hi.livesLeft}` : `best · ♥${hi.livesLeft}`;
      ctx.font = `600 ${Math.max(11, cell * 0.48)}px system-ui,sans-serif`;
      ctx.textAlign = x > cell * this.maze.cols * 0.6 ? "right" : "left";
      ctx.textBaseline = "top";
      const tx = x + (ctx.textAlign === "right" ? -cell * 0.4 : cell * 0.4);
      const ty = Math.min(cell * (this.maze.rows - 0.8), y + cell * 0.35);
      ctx.lineWidth = Math.max(2, cell * 0.14);
      ctx.strokeStyle = "rgba(8,12,20,0.9)";
      ctx.strokeText(text, tx, ty);
      ctx.fillStyle = "#ffd666";
      ctx.fillText(text, tx, ty);
    }
  }

  /** The Q-learning ball (drawn on the sprite layer so the maze isn't redrawn every step). */
  private drawAgent(ctx: CanvasRenderingContext2D, agent: Position, cell: number): void {
    const ax = agent.col * cell + cell / 2;
    const ay = agent.row * cell + cell / 2;
    const radius = Math.max(4, cell * 0.28);
    const grad = ctx.createRadialGradient(ax - radius * 0.3, ay - radius * 0.3, radius * 0.1, ax, ay, radius);
    grad.addColorStop(0, "#c8e0ff");
    grad.addColorStop(0.45, "#5b9dff");
    grad.addColorStop(1, "#2a5fbf");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ax, ay, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = Math.max(1, cell * 0.04);
    ctx.stroke();
  }

  render() {
    return html`
      <div class="wrap">
        <canvas class="base" @click=${this.onClick} role="img" aria-label="Maze grid"></canvas>
        <canvas class="trails overlay" aria-hidden="true"></canvas>
        <canvas class="sprites overlay" aria-hidden="true"></canvas>
        ${this.hint ? html`<div class="hint">${this.hint}</div>` : null}
      </div>
    `;
  }
}

/** Deterministic per-walker offset in [-0.5, 0.5]² (so overlapping trails fan out). */
function walkerOffset(w: number): [number, number] {
  const a = w * 2.399963; // golden angle (radians)
  const r = 0.5 * Math.sqrt(((w * 0.618034) % 1 + 0.05) / 1.05);
  return [Math.cos(a) * r, Math.sin(a) * r];
}

function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, width: number): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(10,14,22,0.85)";
  ctx.lineWidth = width + 2;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r);
  ctx.lineTo(x - r, y + r);
  ctx.stroke();
  ctx.strokeStyle = "#ff5c7a";
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

/** Map t∈[0,1] to a cool→warm heatmap color. */
function heatColor(t: number): string {
  // blue (low) → cyan → lime → yellow (high)
  const r = Math.round(40 + 215 * Math.pow(t, 0.7));
  const g = Math.round(80 + 160 * t);
  const b = Math.round(220 - 180 * t);
  return `rgb(${r},${g},${b})`;
}

customElements.define("lp-maze-canvas", LpMazeCanvas);

declare global {
  interface HTMLElementTagNameMap {
    "lp-maze-canvas": LpMazeCanvas;
  }
}
