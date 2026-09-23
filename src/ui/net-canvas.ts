import { LitElement, css, html } from "lit";
import type { Point } from "../data/datasets.js";

export type BoundarySampler = (x: number, y: number) => number;

export class LpNetCanvas extends LitElement {
  static properties = {
    points: { attribute: false },
    sampleBoundary: { attribute: false },
    resolution: { type: Number },
    paintClass: { type: Number }
  };

  declare points: Point[];
  declare sampleBoundary: BoundarySampler | null;
  declare resolution: number;
  declare paintClass: 0 | 1;

  static styles = css`
    :host {
      display: block;
      background: var(--lp-panel, #101827);
      border: 1px solid var(--lp-border, #2a3b55);
      border-radius: var(--lp-radius, 12px);
      padding: 12px;
    }
    h3 {
      margin: 0 0 8px;
      font-size: 0.95rem;
      font-weight: 600;
    }
    .wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1;
      max-height: min(520px, 70vw);
      margin: 0 auto;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
      border-radius: 8px;
      cursor: crosshair;
      background: #0a101c;
    }
    .hint {
      margin: 8px 0 0;
      font-size: 0.8rem;
      color: var(--lp-muted, #9aa8bc);
    }
  `;

  constructor() {
    super();
    this.points = [];
    this.sampleBoundary = null;
    this.resolution = 48;
    this.paintClass = 0;
  }

  protected updated(): void {
    this.draw();
  }

  private worldFromEvent(e: MouseEvent): { x: number; y: number } | null {
    const canvas = this.renderRoot.querySelector("canvas");
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const x = nx * 2.4 - 1.2;
    const y = 1.2 - ny * 2.4;
    return { x, y };
  }

  private onClick = (e: MouseEvent): void => {
    const w = this.worldFromEvent(e);
    if (!w) return;
    this.dispatchEvent(
      new CustomEvent("add-point", {
        detail: { x: w.x, y: w.y, label: this.paintClass },
        bubbles: true,
        composed: true
      })
    );
  };

  private draw(): void {
    const canvas = this.renderRoot.querySelector("canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const toScreen = (x: number, y: number) => ({
      sx: ((x + 1.2) / 2.4) * cssW,
      sy: ((1.2 - y) / 2.4) * cssH
    });

    if (this.sampleBoundary) {
      const res = this.resolution;
      const cellW = cssW / res;
      const cellH = cssH / res;
      for (let i = 0; i < res; i++) {
        for (let j = 0; j < res; j++) {
          const wx = -1.2 + ((i + 0.5) / res) * 2.4;
          const wy = 1.2 - ((j + 0.5) / res) * 2.4;
          const p = this.sampleBoundary(wx, wy);
          const t = Math.min(1, Math.max(0, p));
          const r = Math.round(91 + (255 - 91) * t);
          const g = Math.round(157 + (107 - 157) * t);
          const b = Math.round(255 + (138 - 255) * t);
          ctx.fillStyle = `rgba(${r},${g},${b},0.35)`;
          ctx.fillRect(i * cellW, j * cellH, cellW + 0.5, cellH + 0.5);
        }
      }
    }

    ctx.strokeStyle = "rgba(155,168,188,0.25)";
    ctx.lineWidth = 1;
    const origin = toScreen(0, 0);
    ctx.beginPath();
    ctx.moveTo(0, origin.sy);
    ctx.lineTo(cssW, origin.sy);
    ctx.moveTo(origin.sx, 0);
    ctx.lineTo(origin.sx, cssH);
    ctx.stroke();

    for (const p of this.points) {
      const { sx, sy } = toScreen(p.x, p.y);
      ctx.beginPath();
      ctx.fillStyle = p.label === 0 ? "#5b9dff" : "#ff6b8a";
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.5;
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  render() {
    return html`
      <h3>Decision boundary &amp; data</h3>
      <div class="wrap">
        <canvas @click=${this.onClick}></canvas>
      </div>
      <p class="hint">Click to add a point of the selected class. Blue = class A, pink = class B.</p>
    `;
  }
}

customElements.define("lp-net-canvas", LpNetCanvas);

declare global {
  interface HTMLElementTagNameMap {
    "lp-net-canvas": LpNetCanvas;
  }
}
