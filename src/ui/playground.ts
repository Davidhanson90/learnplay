import { LitElement, css, html } from "lit";
import { generateMaze, type Maze, type Position } from "../maze/index.js";
import { controlStyles } from "./shared-styles.js";
import "./ga-mode.js";
import "./ql-mode.js";

const DEFAULT_SIZE = 21;
const DEFAULT_START: Position = { row: 1, col: 1 };

export type SolverMode = "ga" | "ql";

/**
 * Top-level playground: owns the maze and start cell, and switches between
 * the genetic-algorithm solver (default) and the original tabular Q-learning
 * solver. Both modes share the maze; switching keeps it.
 */
export class LpPlayground extends LitElement {
  static properties = {
    mode: { state: true },
    mazeSize: { state: true },
    maze: { state: true },
    startPos: { state: true }
  };

  declare mode: SolverMode;
  declare mazeSize: number;
  declare maze: Maze;
  declare startPos: Position;

  static styles = [
    controlStyles,
    css`
      .common h2 {
        margin: 0 0 10px;
        font-size: 1rem;
      }
      .common .row {
        align-items: center;
      }
      .common .row select {
        flex: 1;
      }
    `
  ];

  constructor() {
    super();
    this.mode = typeof location !== "undefined" && location.hash === "#qlearning" ? "ql" : "ga";
    this.mazeSize = DEFAULT_SIZE;
    this.maze = generateMaze({ size: this.mazeSize });
    this.startPos = { ...DEFAULT_START };
  }

  private setMode(mode: SolverMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (typeof history !== "undefined") {
      history.replaceState(null, "", mode === "ql" ? "#qlearning" : location.pathname + location.search);
    }
  }

  private onNewMaze = (): void => {
    this.maze = generateMaze({ size: this.mazeSize });
    this.startPos = { ...DEFAULT_START };
  };

  private onSizeChange = (ev: Event): void => {
    this.mazeSize = Number((ev.target as HTMLSelectElement).value);
    this.onNewMaze();
  };

  private onCellClick = (ev: Event): void => {
    const detail = (ev as CustomEvent<{ position: Position }>).detail;
    if (!detail?.position) return;
    this.startPos = { ...detail.position };
  };

  private renderCommon() {
    return html`
      <div slot="common" class="common">
        <div class="seg" role="group" aria-label="Solver">
          <button type="button" aria-pressed=${this.mode === "ga"} @click=${() => this.setMode("ga")}>
            Genetic algorithm
          </button>
          <button type="button" aria-pressed=${this.mode === "ql"} @click=${() => this.setMode("ql")}>
            Q-learning
          </button>
        </div>
        <h2>Maze</h2>
        <div class="row" style="margin-top:0">
          <select aria-label="Maze size" @change=${this.onSizeChange} .value=${String(this.mazeSize)}>
            <option value="11">11 × 11</option>
            <option value="15">15 × 15</option>
            <option value="21">21 × 21</option>
            <option value="31">31 × 31</option>
          </select>
          <button type="button" @click=${this.onNewMaze}>New maze</button>
        </div>
        <div class="note" style="margin-top:6px">Click any open cell in the maze to move the start.</div>
      </div>
    `;
  }

  render() {
    return this.mode === "ga"
      ? html`<lp-ga-mode
          .maze=${this.maze}
          .start=${this.startPos}
          autoStart
          @cell-click=${this.onCellClick}
          >${this.renderCommon()}</lp-ga-mode
        >`
      : html`<lp-ql-mode .maze=${this.maze} .start=${this.startPos} @cell-click=${this.onCellClick}
          >${this.renderCommon()}</lp-ql-mode
        >`;
  }
}

customElements.define("lp-playground", LpPlayground);

declare global {
  interface HTMLElementTagNameMap {
    "lp-playground": LpPlayground;
  }
}
