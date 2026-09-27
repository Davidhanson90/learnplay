import { LitElement, css, html } from "lit";
import type { GenerationStats } from "../ga/genetic.js";

/**
 * Small line chart of best / average fitness per generation, with
 * green bars for how many walkers reached the goal.
 */
export class LpFitnessChart extends LitElement {
  static properties = {
    history: { attribute: false },
    population: { type: Number },
    version: { type: Number }
  };

  declare history: GenerationStats[];
  declare population: number;
  declare version: number;

  static styles = css`
    :host {
      display: block;
    }
    .wrap {
      background: var(--lp-panel, #101827);
      border: 1px solid var(--lp-border, #2a3b55);
      border-radius: var(--lp-radius, 12px);
      padding: 10px 12px 8px;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 0.8rem;
      color: var(--lp-muted, #9aa8bc);
      margin-bottom: 6px;
      gap: 8px;
      flex-wrap: wrap;
    }
    .head strong {
      color: var(--lp-text, #e8eef7);
      font-size: 0.85rem;
    }
    .legend span {
      margin-left: 10px;
      white-space: nowrap;
    }
    .sw {
      display: inline-block;
      width: 10px;
      height: 3px;
      vertical-align: middle;
      margin-right: 4px;
      border-radius: 2px;
    }
    canvas {
      display: block;
      width: 100%;
      height: 150px;
    }
  `;

  constructor() {
    super();
    this.history = [];
    this.population = 100;
    this.version = 0;
  }

  updated(): void {
    this.draw();
  }

  private draw(): void {
    const canvas = this.renderRoot.querySelector("canvas");
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor((canvas.clientWidth || 600) * dpr));
    const h = Math.max(1, Math.floor((canvas.clientHeight || 150) * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 34 * dpr, r: 30 * dpr, t: 6 * dpr, b: 16 * dpr };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    const hist = this.history;
    const n = hist.length;
    let maxF = 1;
    for (const s of hist) maxF = Math.max(maxF, s.best);
    maxF = Math.ceil(maxF / 50) * 50;

    ctx.font = `${10 * dpr}px system-ui,sans-serif`;
    ctx.fillStyle = "#9aa8bc";
    ctx.strokeStyle = "rgba(154,168,188,0.18)";
    ctx.lineWidth = 1;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let k = 0; k <= 4; k++) {
      const v = (maxF * k) / 4;
      const y = pad.t + ph - (v / maxF) * ph;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + pw, y);
      ctx.stroke();
      ctx.fillText(String(Math.round(v)), pad.l - 4 * dpr, y);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(61,214,140,0.9)";
    ctx.fillText(`${this.population}`, pad.l + pw + 4 * dpr, pad.t + 4 * dpr);
    ctx.fillText("0", pad.l + pw + 4 * dpr, pad.t + ph);

    if (n === 0) return;
    const x = (i: number) => pad.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
    const y = (v: number) => pad.t + ph - (Math.max(0, v) / maxF) * ph;

    // Reached-goal bars (right axis: 0..population)
    const barW = Math.max(1, pw / Math.max(n, 1));
    ctx.fillStyle = "rgba(61,214,140,0.28)";
    for (let i = 0; i < n; i++) {
      const r = hist[i]!.reached / Math.max(1, this.population);
      if (r <= 0) continue;
      ctx.fillRect(x(i) - barW / 2, pad.t + ph - r * ph, barW, r * ph);
    }

    const line = (get: (s: GenerationStats) => number, color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width * dpr;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = x(i);
        const py = y(get(hist[i]!));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      if (n === 1) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x(0), y(get(hist[0]!)), 3 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    line((s) => s.avg, "#a58bff", 1.5);
    line((s) => s.best, "#5b9dff", 2);

    ctx.fillStyle = "#9aa8bc";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`gen ${hist[0]!.generation}`, pad.l, h - 3 * dpr);
    ctx.textAlign = "right";
    ctx.fillText(`gen ${hist[n - 1]!.generation}`, pad.l + pw, h - 3 * dpr);
  }

  render() {
    return html`
      <div class="wrap">
        <div class="head">
          <strong>Fitness over generations</strong>
          <span class="legend">
            <span><i class="sw" style="background:#5b9dff"></i>best</span>
            <span><i class="sw" style="background:#a58bff"></i>average</span>
            <span><i class="sw" style="background:rgba(61,214,140,0.6);height:8px"></i>reached goal</span>
          </span>
        </div>
        <canvas role="img" aria-label="Fitness chart"></canvas>
      </div>
    `;
  }
}

customElements.define("lp-fitness-chart", LpFitnessChart);

declare global {
  interface HTMLElementTagNameMap {
    "lp-fitness-chart": LpFitnessChart;
  }
}
