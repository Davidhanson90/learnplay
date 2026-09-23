import { LitElement, css, html } from "lit";
import {
  generateDataset,
  type DatasetName,
  type Point,
  pointsToMatrices
} from "../data/datasets.js";
import {
  createMlp,
  predictProba,
  setLearningRate,
  trainStep,
  type Mlp
} from "../net/mlp.js";
import { createMatrix } from "../net/matrix.js";
import "./net-canvas.js";
import "./loss-chart.js";

const DEFAULT_DATASET: DatasetName = "moons";
const DEFAULT_HIDDEN = 8;
const DEFAULT_DEPTH = 2;
const DEFAULT_LR = 0.15;
const EPOCHS_PER_FRAME = 4;
const MAX_LOSS_HISTORY = 400;

export class LpPlayground extends LitElement {
  static properties = {
    datasetName: { state: true },
    points: { state: true },
    paintClass: { state: true },
    hiddenSize: { state: true },
    hiddenDepth: { state: true },
    learningRate: { state: true },
    training: { state: true },
    epoch: { state: true },
    loss: { state: true },
    acc: { state: true },
    losses: { state: true },
    boundaryVersion: { state: true }
  };

  declare datasetName: DatasetName;
  declare points: Point[];
  declare paintClass: 0 | 1;
  declare hiddenSize: number;
  declare hiddenDepth: number;
  declare learningRate: number;
  declare training: boolean;
  declare epoch: number;
  declare loss: number;
  declare acc: number;
  declare losses: number[];
  declare boundaryVersion: number;

  private mlp: Mlp;
  private rafId: number | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(280px, 340px) 1fr;
      gap: 16px;
      align-items: start;
    }
    @media (max-width: 860px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
    .panel {
      background: var(--lp-panel, #101827);
      border: 1px solid var(--lp-border, #2a3b55);
      border-radius: var(--lp-radius, 12px);
      padding: 16px;
    }
    .panel h2 {
      margin: 0 0 12px;
      font-size: 1rem;
    }
    label {
      display: block;
      font-size: 0.8rem;
      color: var(--lp-muted, #9aa8bc);
      margin: 10px 0 4px;
    }
    select,
    input[type="range"],
    button {
      font: inherit;
      color: var(--lp-text, #e8eef7);
    }
    select,
    button {
      background: var(--lp-btn, #1b2a44);
      border: 1px solid var(--lp-border, #2a3b55);
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
    }
    button:hover,
    select:hover {
      background: var(--lp-btn-hover, #243552);
    }
    button.primary {
      background: color-mix(in srgb, var(--lp-accent, #5b9dff) 35%, var(--lp-btn, #1b2a44));
      border-color: var(--lp-accent, #5b9dff);
    }
    button.danger {
      border-color: var(--lp-danger, #ff6b8a);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .readouts {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 14px;
    }
    .stat {
      background: color-mix(in srgb, var(--lp-bg, #070b14) 50%, transparent);
      border-radius: 8px;
      padding: 8px;
      text-align: center;
    }
    .stat .v {
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      font-size: 1.05rem;
    }
    .stat .k {
      font-size: 0.72rem;
      color: var(--lp-muted, #9aa8bc);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .paint-toggle {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }
    .paint-toggle button[aria-pressed="true"] {
      outline: 2px solid var(--lp-accent, #5b9dff);
    }
    .paint-a[aria-pressed="true"] {
      outline-color: var(--lp-class-a, #5b9dff) !important;
    }
    .paint-b[aria-pressed="true"] {
      outline-color: var(--lp-class-b, #ff6b8a) !important;
    }
    .value {
      font-size: 0.85rem;
      color: var(--lp-muted, #9aa8bc);
    }
    .viz {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .edu {
      margin-top: 16px;
      font-size: 0.88rem;
      color: var(--lp-muted, #9aa8bc);
    }
    .edu strong {
      color: var(--lp-text, #e8eef7);
    }
    .edu code {
      font-size: 0.84em;
    }
    .arch {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.85rem;
      margin-top: 4px;
    }
  `;

  constructor() {
    super();
    this.datasetName = DEFAULT_DATASET;
    this.points = [];
    this.paintClass = 0;
    this.hiddenSize = DEFAULT_HIDDEN;
    this.hiddenDepth = DEFAULT_DEPTH;
    this.learningRate = DEFAULT_LR;
    this.training = false;
    this.epoch = 0;
    this.loss = 0;
    this.acc = 0;
    this.losses = [];
    this.boundaryVersion = 0;
    this.mlp = this.buildMlp();
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.points.length === 0) {
      this.resetData(DEFAULT_DATASET);
    }
  }

  disconnectedCallback(): void {
    this.stopLoop();
    super.disconnectedCallback();
  }

  private sizes(): number[] {
    const hidden = Array.from({ length: this.hiddenDepth }, () => this.hiddenSize);
    return [2, ...hidden, 1];
  }

  private buildMlp(): Mlp {
    return createMlp({
      sizes: this.sizes(),
      learningRate: this.learningRate,
      seed: 42 + this.hiddenSize * 17 + this.hiddenDepth
    });
  }

  private resetData(name: DatasetName): void {
    this.datasetName = name;
    this.points = generateDataset(name, 120);
    this.resetNet();
  }

  private resetNet(): void {
    this.stopLoop();
    this.training = false;
    this.mlp = this.buildMlp();
    this.epoch = 0;
    this.loss = 0;
    this.acc = 0;
    this.losses = [];
    this.boundaryVersion++;
  }

  private onDataset = (e: Event): void => {
    const name = (e.target as HTMLSelectElement).value as DatasetName;
    this.resetData(name);
  };

  private onHiddenSize = (e: Event): void => {
    this.hiddenSize = Number((e.target as HTMLInputElement).value);
    this.resetNet();
  };

  private onHiddenDepth = (e: Event): void => {
    this.hiddenDepth = Number((e.target as HTMLInputElement).value);
    this.resetNet();
  };

  private onLr = (e: Event): void => {
    this.learningRate = Number((e.target as HTMLInputElement).value);
    setLearningRate(this.mlp, this.learningRate);
  };

  private onAddPoint = (e: Event): void => {
    const detail = (e as CustomEvent<Point>).detail;
    this.points = [...this.points, detail];
  };

  private clearPoints = (): void => {
    this.points = [];
    this.resetNet();
  };

  private startTrain = (): void => {
    if (this.points.length < 2) return;
    this.training = true;
    this.loop();
  };

  private pauseTrain = (): void => {
    this.training = false;
    this.stopLoop();
  };

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = (): void => {
    if (!this.training) return;
    this.trainBatches(EPOCHS_PER_FRAME);
    this.rafId = requestAnimationFrame(this.loop);
  };

  private trainBatches(n: number): void {
    if (this.points.length === 0) return;
    const { inputs, targets, rows } = pointsToMatrices(this.points);
    const inputM = createMatrix(rows, 2);
    inputM.data.set(inputs);
    const targetM = createMatrix(rows, 1);
    targetM.data.set(targets);

    let lastLoss = this.loss;
    let lastAcc = this.acc;
    const newLosses = [...this.losses];

    for (let i = 0; i < n; i++) {
      const result = trainStep(this.mlp, inputM, targetM, "bce");
      lastLoss = result.loss;
      lastAcc = result.accuracy;
      this.epoch += 1;
      newLosses.push(lastLoss);
    }
    while (newLosses.length > MAX_LOSS_HISTORY) newLosses.shift();

    this.loss = lastLoss;
    this.acc = lastAcc;
    this.losses = newLosses;
    this.boundaryVersion++;
  }

  private sampleBoundary = (x: number, y: number): number => {
    void this.boundaryVersion;
    const scores = predictProba(this.mlp, [[x, y]]);
    return scores[0] ?? 0.5;
  };

  render() {
    return html`
      <div class="layout">
        <aside class="panel">
          <h2>Controls</h2>

          <label for="dataset">Dataset</label>
          <select id="dataset" @change=${this.onDataset} .value=${this.datasetName}>
            <option value="moons">Two moons</option>
            <option value="xor">XOR blobs</option>
            <option value="circles">Concentric circles</option>
          </select>

          <label>Paint class</label>
          <div class="paint-toggle">
            <button
              class="paint-a"
              aria-pressed=${String(this.paintClass === 0)}
              @click=${() => {
                this.paintClass = 0;
              }}
            >
              Class A
            </button>
            <button
              class="paint-b"
              aria-pressed=${String(this.paintClass === 1)}
              @click=${() => {
                this.paintClass = 1;
              }}
            >
              Class B
            </button>
          </div>

          <label for="hidden">Hidden size: <span class="value">${this.hiddenSize}</span></label>
          <input
            id="hidden"
            type="range"
            min="2"
            max="32"
            step="1"
            .value=${String(this.hiddenSize)}
            @input=${this.onHiddenSize}
          />

          <label for="depth">Hidden layers: <span class="value">${this.hiddenDepth}</span></label>
          <input
            id="depth"
            type="range"
            min="1"
            max="3"
            step="1"
            .value=${String(this.hiddenDepth)}
            @input=${this.onHiddenDepth}
          />

          <div class="arch">Architecture: [${this.sizes().join(", ")}]</div>

          <label for="lr"
            >Learning rate: <span class="value">${this.learningRate.toFixed(2)}</span></label
          >
          <input
            id="lr"
            type="range"
            min="0.01"
            max="1"
            step="0.01"
            .value=${String(this.learningRate)}
            @input=${this.onLr}
          />

          <div class="row">
            ${this.training
              ? html`<button class="danger" @click=${this.pauseTrain}>Pause</button>`
              : html`<button class="primary" @click=${this.startTrain}>Train</button>`}
            <button @click=${() => this.resetNet()}>Reset net</button>
            <button @click=${() => this.resetData(this.datasetName)}>Reload data</button>
            <button @click=${this.clearPoints}>Clear points</button>
          </div>

          <div class="readouts">
            <div class="stat">
              <div class="v">${this.epoch}</div>
              <div class="k">Epoch</div>
            </div>
            <div class="stat">
              <div class="v">${this.loss.toFixed(3)}</div>
              <div class="k">Loss</div>
            </div>
            <div class="stat">
              <div class="v">${(this.acc * 100).toFixed(0)}%</div>
              <div class="k">Accuracy</div>
            </div>
          </div>

          <div class="edu">
            <p>
              <strong>Forward pass</strong> — each layer computes
              <code>activation(xW + b)</code>. Hidden layers use ReLU; the output uses sigmoid so
              predictions stay in (0, 1).
            </p>
            <p>
              <strong>Loss</strong> — binary cross-entropy measures how wrong the predicted
              probabilities are versus the true labels (0 or 1).
            </p>
            <p>
              <strong>Backprop</strong> — gradients of the loss w.r.t. every weight are computed with
              the chain rule, then SGD nudges weights opposite the gradient so the next forward pass
              is a little better.
            </p>
          </div>
        </aside>

        <div class="viz">
          <lp-net-canvas
            .points=${this.points}
            .paintClass=${this.paintClass}
            .sampleBoundary=${this.sampleBoundary}
            .resolution=${40}
            @add-point=${this.onAddPoint}
          ></lp-net-canvas>
          <lp-loss-chart .losses=${this.losses}></lp-loss-chart>
        </div>
      </div>
    `;
  }
}

customElements.define("lp-playground", LpPlayground);

declare global {
  interface HTMLElementTagNameMap {
    "lp-playground": LpPlayground;
  }
}
