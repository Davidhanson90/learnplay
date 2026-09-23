import { LitElement, css, html } from "lit";
import { generateMaze, step, type Maze, type Position } from "../maze/index.js";
import { QAgent, DEFAULT_QL_CONFIG } from "../rl/qlearning.js";
import "./maze-canvas.js";

const DEFAULT_SIZE = 21;
const SUCCESS_FOR_PLAYBACK = 8;

export class LpPlayground extends LitElement {
  static properties = {
    mazeSize: { state: true },
    training: { state: true },
    playback: { state: true },
    alpha: { state: true },
    gamma: { state: true },
    epsilonStart: { state: true },
    speed: { state: true },
    showHeatmap: { state: true },
    episode: { state: true },
    steps: { state: true },
    totalReward: { state: true },
    epsilon: { state: true },
    successRate: { state: true },
    statusMsg: { state: true },
    agentPos: { state: true },
    startPos: { state: true },
    heatmapVersion: { state: true }
  };

  declare mazeSize: number;
  declare training: boolean;
  declare playback: boolean;
  declare alpha: number;
  declare gamma: number;
  declare epsilonStart: number;
  declare speed: number;
  declare showHeatmap: boolean;
  declare episode: number;
  declare steps: number;
  declare totalReward: number;
  declare epsilon: number;
  declare successRate: number;
  declare statusMsg: string;
  declare agentPos: Position | null;
  declare startPos: Position | null;
  declare heatmapVersion: number;

  private maze: Maze;
  private agent: QAgent;
  private rafId: number | null = null;
  private heatmap = new Float64Array(0);
  private heatmapMax = 1;
  private episodeReward = 0;
  private episodeSteps = 0;
  private betweenEpisodes = false;
  private consecutiveSuccesses = 0;
  private playbackPath: Position[] = [];
  private playbackIndex = 0;

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
    button:hover:not(:disabled) {
      background: var(--lp-btn-hover, #243552);
    }
    button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    button.primary {
      background: var(--lp-accent, #5b9dff);
      border-color: transparent;
      color: #061018;
      font-weight: 600;
    }
    button.primary:hover:not(:disabled) {
      filter: brightness(1.08);
      background: var(--lp-accent, #5b9dff);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 12px;
      font-size: 0.85rem;
    }
    .stat {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 8px 10px;
    }
    .stat .k {
      color: var(--lp-muted, #9aa8bc);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .stat .v {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    .edu {
      margin-top: 14px;
      font-size: 0.82rem;
      color: var(--lp-muted, #9aa8bc);
      line-height: 1.5;
    }
    .edu strong {
      color: var(--lp-text, #e8eef7);
    }
    .status {
      margin-top: 10px;
      font-size: 0.85rem;
      color: var(--lp-accent, #5b9dff);
      min-height: 1.3em;
    }
    input[type="range"] {
      width: 100%;
    }
    .val {
      float: right;
      color: var(--lp-text, #e8eef7);
      font-variant-numeric: tabular-nums;
    }
    .check {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      font-size: 0.85rem;
      color: var(--lp-muted, #9aa8bc);
    }
    .check input {
      accent-color: var(--lp-accent, #5b9dff);
    }
  `;

  constructor() {
    super();
    this.mazeSize = DEFAULT_SIZE;
    this.training = false;
    this.playback = false;
    this.alpha = DEFAULT_QL_CONFIG.alpha;
    this.gamma = DEFAULT_QL_CONFIG.gamma;
    this.epsilonStart = DEFAULT_QL_CONFIG.epsilon;
    this.speed = 8;
    this.showHeatmap = true;
    this.episode = 0;
    this.steps = 0;
    this.totalReward = 0;
    this.epsilon = DEFAULT_QL_CONFIG.epsilon;
    this.successRate = 0;
    this.statusMsg = "Generate a maze, then click a cell to place the ball.";
    this.agentPos = null;
    this.startPos = null;
    this.heatmapVersion = 0;

    this.maze = generateMaze({ size: this.mazeSize });
    this.agent = this.makeAgent();
    this.rebuildHeatmap();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopLoop();
  }

  private makeAgent(): QAgent {
    return new QAgent(this.maze, {
      alpha: this.alpha,
      gamma: this.gamma,
      epsilon: this.epsilonStart,
      epsilonDecay: 0.995,
      epsilonMin: 0.05,
      maxSteps: Math.max(200, this.maze.rows * this.maze.cols * 2)
    });
  }

  private rebuildHeatmap(): void {
    const n = this.maze.rows * this.maze.cols;
    this.heatmap = new Float64Array(n);
    let max = 0;
    for (let i = 0; i < n; i++) {
      if (this.maze.walls[i]) continue;
      const row = Math.floor(i / this.maze.cols);
      const col = i % this.maze.cols;
      const v = Math.max(0, this.agent.maxQ({ row, col }));
      this.heatmap[i] = v;
      if (v > max) max = v;
    }
    this.heatmapMax = max || 1;
    this.heatmapVersion++;
  }

  private syncStats(): void {
    this.episode = this.agent.episode;
    this.epsilon = this.agent.epsilon;
    this.successRate = this.agent.successRate();
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private startLoop(): void {
    this.stopLoop();
    const tick = (): void => {
      this.rafId = null;
      if (!this.training && !this.playback) return;
      this.frame();
      if (this.training || this.playback) {
        this.rafId = requestAnimationFrame(tick);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private frame(): void {
    if (this.playback) {
      this.playbackFrame();
      return;
    }
    if (!this.training || !this.startPos || !this.agentPos) return;
    if (this.betweenEpisodes) return;

    const stepsThisFrame = Math.max(1, Math.round(this.speed));
    for (let i = 0; i < stepsThisFrame; i++) {
      if (!this.agentPos || !this.startPos) break;
      const result = this.agent.takeStep(this.agentPos, false);
      this.agentPos = result.next;
      this.episodeReward += result.reward;
      this.episodeSteps += 1;
      this.steps = this.episodeSteps;
      this.totalReward = this.episodeReward;

      const timedOut = this.episodeSteps >= this.agent.config.maxSteps;
      if (result.done || timedOut) {
        this.agent.endEpisode(result.done);
        this.syncStats();
        this.rebuildHeatmap();
        if (result.done) {
          this.consecutiveSuccesses += 1;
          this.statusMsg = `Reached exit in ${this.episodeSteps} steps (episode ${this.agent.episode}).`;
        } else {
          this.consecutiveSuccesses = 0;
          this.statusMsg = `Episode ${this.agent.episode} timed out after ${this.episodeSteps} steps.`;
        }

        if (
          this.consecutiveSuccesses >= SUCCESS_FOR_PLAYBACK &&
          this.agent.successRate() >= 0.7
        ) {
          this.offerPlayback();
          return;
        }

        this.betweenEpisodes = true;
        window.setTimeout(() => {
          this.betweenEpisodes = false;
          if (this.startPos && this.training) {
            this.agentPos = { ...this.startPos };
            this.episodeReward = 0;
            this.episodeSteps = 0;
            this.steps = 0;
            this.totalReward = 0;
            this.requestUpdate();
          }
        }, 280);
        break;
      }
    }
    this.syncStats();
    if (this.episodeSteps % 8 === 0) {
      this.rebuildHeatmap();
    }
    this.requestUpdate();
  }

  private offerPlayback(): void {
    this.training = false;
    this.statusMsg =
      "Looking solid — running a greedy (ε=0) playback of the learned path.";
    this.startPlayback();
  }

  private startPlayback(): void {
    if (!this.startPos) return;
    this.playbackPath = this.computeGreedyPath(this.startPos);
    this.playbackIndex = 0;
    this.agentPos = { ...this.playbackPath[0]! };
    this.playback = true;
    this.steps = 0;
    this.totalReward = 0;
    this.startLoop();
  }

  /** Walk ε=0 policy without writing to the Q-table (display only). */
  private computeGreedyPath(start: Position): Position[] {
    const path: Position[] = [{ ...start }];
    let pos = { ...start };
    const seen = new Set<string>();
    for (let i = 0; i < this.agent.config.maxSteps; i++) {
      const key = `${pos.row},${pos.col}`;
      if (seen.has(key)) break;
      seen.add(key);
      const action = this.agent.bestAction(pos);
      const result = step(this.maze, pos, action);
      pos = result.next;
      path.push({ ...pos });
      if (result.done) break;
      if (result.hitWall) break;
    }
    return path;
  }

  private playbackFrame(): void {
    if (this.playbackIndex >= this.playbackPath.length - 1) {
      this.playback = false;
      this.statusMsg =
        "Greedy playback finished. Hit Train to keep improving, or Reset learning.";
      this.stopLoop();
      this.requestUpdate();
      return;
    }
    const advance = Math.max(1, Math.round(this.speed / 4));
    this.playbackIndex = Math.min(
      this.playbackPath.length - 1,
      this.playbackIndex + advance
    );
    this.agentPos = { ...this.playbackPath[this.playbackIndex]! };
    this.steps = this.playbackIndex;
    this.requestUpdate();
  }

  private onNewMaze = (): void => {
    this.training = false;
    this.playback = false;
    this.stopLoop();
    this.maze = generateMaze({ size: this.mazeSize });
    this.agent = this.makeAgent();
    this.startPos = null;
    this.agentPos = null;
    this.consecutiveSuccesses = 0;
    this.betweenEpisodes = false;
    this.episodeReward = 0;
    this.episodeSteps = 0;
    this.steps = 0;
    this.totalReward = 0;
    this.syncStats();
    this.rebuildHeatmap();
    this.statusMsg = "New maze — click an open cell to place the ball (Q-table reset).";
    this.requestUpdate();
  };

  private onCellClick = (ev: Event): void => {
    const detail = (ev as CustomEvent<{ position: Position }>).detail;
    if (!detail?.position) return;
    this.training = false;
    this.playback = false;
    this.stopLoop();
    this.startPos = { ...detail.position };
    this.agentPos = { ...detail.position };
    // Prefer reset Q-table on new start so learning is visible from scratch.
    this.agent = this.makeAgent();
    this.consecutiveSuccesses = 0;
    this.betweenEpisodes = false;
    this.episodeReward = 0;
    this.episodeSteps = 0;
    this.steps = 0;
    this.totalReward = 0;
    this.syncStats();
    this.rebuildHeatmap();
    this.statusMsg =
      "Ball placed — hit Train to watch Q-learning explore and improve.";
    this.requestUpdate();
  };

  private onTrain = (): void => {
    if (!this.startPos) {
      this.statusMsg = "Click an open cell first to place the ball.";
      return;
    }
    this.playback = false;
    this.training = true;
    this.betweenEpisodes = false;
    if (!this.agentPos) this.agentPos = { ...this.startPos };
    this.statusMsg = "Training… explore (ε) vs exploit; heatmap shows max Q per cell.";
    this.startLoop();
    this.requestUpdate();
  };

  private onPause = (): void => {
    this.training = false;
    this.playback = false;
    this.stopLoop();
    this.statusMsg = "Paused.";
    this.requestUpdate();
  };

  private onResetLearning = (): void => {
    this.training = false;
    this.playback = false;
    this.stopLoop();
    this.agent.resetLearning();
    this.agent.config.alpha = this.alpha;
    this.agent.config.gamma = this.gamma;
    this.agent.config.epsilon = this.epsilonStart;
    this.agent.epsilon = this.epsilonStart;
    this.consecutiveSuccesses = 0;
    this.betweenEpisodes = false;
    this.episodeReward = 0;
    this.episodeSteps = 0;
    this.steps = 0;
    this.totalReward = 0;
    if (this.startPos) this.agentPos = { ...this.startPos };
    this.syncStats();
    this.rebuildHeatmap();
    this.statusMsg = "Learning reset (Q-table cleared). Maze and start kept.";
    this.requestUpdate();
  };

  private onPlayback = (): void => {
    if (!this.startPos) {
      this.statusMsg = "Place the ball first.";
      return;
    }
    this.training = false;
    this.statusMsg = "Greedy playback (ε=0)…";
    this.startPlayback();
    this.requestUpdate();
  };

  private onSizeChange = (ev: Event): void => {
    this.mazeSize = Number((ev.target as HTMLSelectElement).value);
    this.onNewMaze();
  };

  private onAlpha = (ev: Event): void => {
    this.alpha = Number((ev.target as HTMLInputElement).value);
    this.agent.config.alpha = this.alpha;
  };

  private onGamma = (ev: Event): void => {
    this.gamma = Number((ev.target as HTMLInputElement).value);
    this.agent.config.gamma = this.gamma;
  };

  private onEpsilonStart = (ev: Event): void => {
    this.epsilonStart = Number((ev.target as HTMLInputElement).value);
  };

  private onSpeed = (ev: Event): void => {
    this.speed = Number((ev.target as HTMLInputElement).value);
  };

  private onHeatmapToggle = (ev: Event): void => {
    this.showHeatmap = (ev.target as HTMLInputElement).checked;
  };

  render() {
    const pct = (this.successRate * 100).toFixed(0);
    return html`
      <div class="layout">
        <aside class="panel">
          <h2>Maze &amp; training</h2>

          <label>Maze size</label>
          <select @change=${this.onSizeChange} .value=${String(this.mazeSize)}>
            <option value="11">11 × 11</option>
            <option value="15">15 × 15</option>
            <option value="21">21 × 21</option>
            <option value="31">31 × 31</option>
          </select>

          <div class="row">
            <button type="button" @click=${this.onNewMaze}>New maze</button>
            <button
              type="button"
              class="primary"
              @click=${this.onTrain}
              ?disabled=${!this.startPos || this.training}
            >
              Train
            </button>
            <button
              type="button"
              @click=${this.onPause}
              ?disabled=${!this.training && !this.playback}
            >
              Pause
            </button>
            <button type="button" @click=${this.onResetLearning}>Reset learning</button>
            <button type="button" @click=${this.onPlayback} ?disabled=${!this.startPos}>
              Greedy play
            </button>
          </div>

          <label>Speed <span class="val">${this.speed} steps/frame</span></label>
          <input
            type="range"
            min="1"
            max="40"
            step="1"
            .value=${String(this.speed)}
            @input=${this.onSpeed}
          />

          <label>Learning rate α <span class="val">${this.alpha.toFixed(2)}</span></label>
          <input
            type="range"
            min="0.05"
            max="0.8"
            step="0.01"
            .value=${String(this.alpha)}
            @input=${this.onAlpha}
          />

          <label>Discount γ <span class="val">${this.gamma.toFixed(2)}</span></label>
          <input
            type="range"
            min="0.5"
            max="0.99"
            step="0.01"
            .value=${String(this.gamma)}
            @input=${this.onGamma}
          />

          <label
            >ε start (resets on new start/maze)
            <span class="val">${this.epsilonStart.toFixed(2)}</span></label
          >
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            .value=${String(this.epsilonStart)}
            @input=${this.onEpsilonStart}
          />

          <label class="check">
            <input
              type="checkbox"
              .checked=${this.showHeatmap}
              @change=${this.onHeatmapToggle}
            />
            Show Q-value heatmap
          </label>

          <div class="stats">
            <div class="stat">
              <div class="k">Episode</div>
              <div class="v">${this.episode}</div>
            </div>
            <div class="stat">
              <div class="k">Steps</div>
              <div class="v">${this.steps}</div>
            </div>
            <div class="stat">
              <div class="k">Episode reward</div>
              <div class="v">${this.totalReward.toFixed(1)}</div>
            </div>
            <div class="stat">
              <div class="k">Epsilon ε</div>
              <div class="v">${this.epsilon.toFixed(3)}</div>
            </div>
            <div class="stat">
              <div class="k">Success (last 50)</div>
              <div class="v">${pct}%</div>
            </div>
            <div class="stat">
              <div class="k">Mode</div>
              <div class="v">
                ${this.playback ? "Playback" : this.training ? "Training" : "Idle"}
              </div>
            </div>
          </div>

          <div class="status">${this.statusMsg}</div>

          <div class="edu">
            <strong>What is going on?</strong>
            The agent uses <strong>tabular Q-learning</strong>: for every cell and move
            (N/E/S/W) it stores a value Q. It mostly <em>explores</em> at random when ε is
            high, then <em>exploits</em> the best Q as ε decays. Reaching the green exit
            gives a big reward; each step costs a little; bumping a wall is penalized.
            New maze or a new start click <strong>resets the Q-table</strong> so you can
            watch learning from scratch. The heatmap colors cells by their max Q.
          </div>
        </aside>

        <section>
          <lp-maze-canvas
            .maze=${this.maze}
            .agent=${this.agentPos}
            .start=${this.startPos}
            .heatmap=${this.heatmap}
            .heatmapMax=${this.heatmapMax}
            .showHeatmap=${this.showHeatmap}
            @cell-click=${this.onCellClick}
          ></lp-maze-canvas>
        </section>
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
