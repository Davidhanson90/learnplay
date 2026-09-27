import { LitElement, html } from "lit";
import { step, type Maze, type Position } from "../maze/index.js";
import { QAgent, DEFAULT_QL_CONFIG } from "../rl/qlearning.js";
import { controlStyles } from "./shared-styles.js";
import "./maze-canvas.js";

const SUCCESS_FOR_PLAYBACK = 8;

/**
 * Tabular Q-learning maze mode (the original learnplay demo): one ball
 * explores episode by episode while a max-Q heatmap lights up.
 * Maze and start come from the parent; changing either resets the Q-table.
 */
export class LpQlMode extends LitElement {
  static properties = {
    maze: { attribute: false },
    start: { attribute: false },
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
    heatmapVersion: { state: true }
  };

  declare maze: Maze;
  declare start: Position | null;
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
  declare heatmapVersion: number;

  private agent!: QAgent;
  private initialized = false;
  private rafId: number | null = null;
  private heatmap = new Float64Array(0);
  private heatmapMax = 1;
  private episodeReward = 0;
  private episodeSteps = 0;
  private betweenEpisodes = false;
  private consecutiveSuccesses = 0;
  private playbackPath: Position[] = [];
  private playbackIndex = 0;

  static styles = [controlStyles];

  constructor() {
    super();
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
    this.statusMsg = "Hit Train to watch Q-learning explore. Click a cell to move the ball.";
    this.agentPos = null;
    this.heatmapVersion = 0;
    this.start = null;
  }

  /** Stand-in for the old `startPos` state: the start now comes from the parent. */
  private get startPos(): Position | null {
    return this.start;
  }

  willUpdate(changed: Map<PropertyKey, unknown>): void {
    if ((changed.has("maze") || changed.has("start")) && this.maze) {
      const first = !this.initialized;
      this.initialized = true;
      this.training = false;
      this.playback = false;
      this.stopLoop();
      this.agent = this.makeAgent();
      this.agentPos = this.start ? { ...this.start } : null;
      this.consecutiveSuccesses = 0;
      this.betweenEpisodes = false;
      this.episodeReward = 0;
      this.episodeSteps = 0;
      this.steps = 0;
      this.totalReward = 0;
      this.syncStats();
      this.rebuildHeatmap();
      if (!first) {
        this.statusMsg = "Maze or start changed — Q-table reset. Hit Train to learn from scratch.";
      }
    }
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
          <slot name="common"></slot>

          <div class="row">
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
          ></lp-maze-canvas>
        </section>
      </div>
    `;
  }
}

customElements.define("lp-ql-mode", LpQlMode);

declare global {
  interface HTMLElementTagNameMap {
    "lp-ql-mode": LpQlMode;
  }
}
