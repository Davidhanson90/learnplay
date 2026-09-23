import { LitElement, css, html } from "lit";
import type { Maze, Position } from "../maze/index.js";
import { isOpen, isExit } from "../maze/index.js";

/**
 * Canvas that draws the maze grid, optional Q-value heatmap,
 * exit marker, start cell, and the animated agent ball.
 */
export class LpMazeCanvas extends LitElement {
  static properties = {
    maze: { attribute: false },
    agent: { attribute: false },
    start: { attribute: false },
    /** Per-cell max-Q values (same length as walls), or null to hide heatmap. */
    heatmap: { attribute: false },
    heatmapMax: { type: Number },
    showHeatmap: { type: Boolean }
  };

  declare maze: Maze | null;
  declare agent: Position | null;
  declare start: Position | null;
  declare heatmap: Float64Array | null;
  declare heatmapMax: number;
  declare showHeatmap: boolean;

  private canvasEl: HTMLCanvasElement | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 1;
      background: var(--lp-panel, #101827);
      border: 1px solid var(--lp-border, #2a3b55);
      border-radius: var(--lp-radius, 12px);
      overflow: hidden;
      cursor: crosshair;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
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
  }

  firstUpdated(): void {
    this.canvasEl = this.renderRoot.querySelector("canvas");
    this.draw();
  }

  updated(): void {
    this.draw();
  }

  private onClick = (ev: MouseEvent): void => {
    if (!this.maze || !this.canvasEl) return;
    const rect = this.canvasEl.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const cellW = rect.width / this.maze.cols;
    const cellH = rect.height / this.maze.rows;
    const col = Math.floor(x / cellW);
    const row = Math.floor(y / cellH);
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

  private draw(): void {
    const canvas = this.canvasEl ?? this.renderRoot.querySelector("canvas");
    if (!canvas || !this.maze) return;
    this.canvasEl = canvas;

    const dpr = window.devicePixelRatio || 1;
    const cssSize = canvas.clientWidth || 480;
    const size = Math.max(1, Math.floor(cssSize * dpr));
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { maze } = this;
    const cell = size / maze.cols;

    // Floor
    ctx.fillStyle = getComputedStyle(this).getPropertyValue("--lp-panel").trim() || "#101827";
    ctx.fillRect(0, 0, size, size);

    const heatMax = Math.max(1e-6, this.heatmapMax);

    for (let r = 0; r < maze.rows; r++) {
      for (let c = 0; c < maze.cols; c++) {
        const i = r * maze.cols + c;
        const x = c * cell;
        const y = r * cell;

        if (maze.walls[i]) {
          ctx.fillStyle = "#0a1220";
          ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
          continue;
        }

        // Open cell base
        ctx.fillStyle = "#152238";
        ctx.fillRect(x, y, cell + 0.5, cell + 0.5);

        // Heatmap: max Q → blue→cyan→yellow
        if (this.showHeatmap && this.heatmap) {
          const v = this.heatmap[i] ?? 0;
          if (v > 0) {
            const t = Math.min(1, v / heatMax);
            ctx.fillStyle = heatColor(t);
            ctx.globalAlpha = 0.35 + 0.45 * t;
            ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
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
    ctx.font = `bold ${Math.max(10, cell * 0.45)}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("E", ex + cell / 2, ey + cell / 2 + 1);

    // Start marker (subtle ring)
    if (this.start) {
      const sx = this.start.col * cell + cell / 2;
      const sy = this.start.row * cell + cell / 2;
      ctx.strokeStyle = "rgba(91,157,255,0.55)";
      ctx.lineWidth = Math.max(1.5, cell * 0.08);
      ctx.beginPath();
      ctx.arc(sx, sy, cell * 0.32, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Agent ball
    if (this.agent) {
      const ax = this.agent.col * cell + cell / 2;
      const ay = this.agent.row * cell + cell / 2;
      const radius = cell * 0.28;
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
  }

  render() {
    const needHint = this.maze && !this.start;
    return html`
      <div class="wrap">
        <canvas @click=${this.onClick} role="img" aria-label="Maze grid"></canvas>
        ${needHint
          ? html`<div class="hint">Click an open cell to place the ball and start learning</div>`
          : null}
      </div>
    `;
  }
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
