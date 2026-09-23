import { LitElement, css, html } from "lit";

export class LpLossChart extends LitElement {
  static properties = {
    losses: { attribute: false }
  };

  declare losses: number[];

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
    canvas {
      width: 100%;
      height: 140px;
      display: block;
      border-radius: 8px;
      background: color-mix(in srgb, var(--lp-bg, #070b14) 55%, transparent);
    }
    .empty {
      font-size: 0.85rem;
      color: var(--lp-muted, #9aa8bc);
      margin: 0;
    }
  `;

  constructor() {
    super();
    this.losses = [];
  }

  protected updated(): void {
    this.draw();
  }

  private draw(): void {
    const canvas = this.renderRoot.querySelector("canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const losses = this.losses;
    if (losses.length < 2) return;

    const maxL = Math.max(...losses, 1e-6);
    const minL = Math.min(...losses);
    const span = Math.max(maxL - minL, 1e-6);
    const pad = 8;

    ctx.strokeStyle = "rgba(155, 168, 188, 0.25)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = pad + ((h - pad * 2) * i) / 3;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(w - pad, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.strokeStyle = "#5b9dff";
    ctx.lineWidth = 2;
    for (let i = 0; i < losses.length; i++) {
      const x = pad + ((w - pad * 2) * i) / (losses.length - 1);
      const y = pad + (h - pad * 2) * (1 - (losses[i]! - minL) / span);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  render() {
    return html`
      <h3>Loss over epochs</h3>
      ${this.losses.length < 2
        ? html`<p class="empty">Start training to see the loss curve.</p>`
        : null}
      <canvas></canvas>
    `;
  }
}

customElements.define("lp-loss-chart", LpLossChart);

declare global {
  interface HTMLElementTagNameMap {
    "lp-loss-chart": LpLossChart;
  }
}
