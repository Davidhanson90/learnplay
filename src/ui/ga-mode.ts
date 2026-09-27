import { LitElement, html } from "lit";
import { DEFAULT_FITNESS_WEIGHTS } from "../ga/fitness.js";
import { DEFAULT_GA_CONFIG, GeneticSolver, type GenerationStats } from "../ga/genetic.js";
import type { WalkerRun } from "../ga/walker.js";
import type { Maze, Position } from "../maze/index.js";
import type { GaOverlay } from "./maze-canvas.js";
import { controlStyles } from "./shared-styles.js";
import "./fitness-chart.js";
import "./maze-canvas.js";

interface SpeedLevel {
  label: string;
  /** Animation steps per second (Infinity = whole generation per frame). */
  sps: number;
  /** How long the best path stays highlighted before the next generation. */
  pauseMs: number;
}

export const SPEED_LEVELS: SpeedLevel[] = [
  { label: "2 steps/s", sps: 2, pauseMs: 1600 },
  { label: "5 steps/s", sps: 5, pauseMs: 1500 },
  { label: "12 steps/s", sps: 12, pauseMs: 1300 },
  { label: "30 steps/s", sps: 30, pauseMs: 1100 },
  { label: "60 steps/s", sps: 60, pauseMs: 900 },
  { label: "120 steps/s", sps: 120, pauseMs: 800 },
  { label: "300 steps/s", sps: 300, pauseMs: 550 },
  { label: "800 steps/s", sps: 800, pauseMs: 350 },
  { label: "Max (1 generation / frame)", sps: Infinity, pauseMs: 120 }
];
const DEFAULT_SPEED = 5;

type Phase = "animating" | "highlight";
type ColorMode = "walker" | "fitness";

/**
 * Genetic-algorithm maze mode: a population of move-sequence genomes walks the
 * maze in lock-step, leaving trails; at the end of each generation the best
 * path is highlighted, then the maze is cleared and the next generation bred.
 */
export class LpGaMode extends LitElement {
  static properties = {
    maze: { attribute: false },
    start: { attribute: false },
    autoStart: { type: Boolean },
    populationSize: { state: true },
    mutationRate: { state: true },
    genomeMultiplier: { state: true },
    speedLevel: { state: true },
    colorMode: { state: true },
    running: { state: true },
    step: { state: true },
    highlight: { state: true },
    overlay: { state: true },
    statusMsg: { state: true },
    revealed: { state: true }
  };

  declare maze: Maze | null;
  declare start: Position | null;
  declare autoStart: boolean;
  declare populationSize: number;
  declare mutationRate: number;
  declare genomeMultiplier: number;
  declare speedLevel: number;
  declare colorMode: ColorMode;
  declare running: boolean;
  declare step: number;
  declare highlight: number;
  declare overlay: GaOverlay | null;
  declare statusMsg: string;
  /** Number of generations whose results have been shown (drives stats + chart). */
  declare revealed: number;

  private solver: GeneticSolver | null = null;
  private phase: Phase = "animating";
  private maxT = 0;
  private overlayId = 0;
  private rafId: number | null = null;
  private lastTime = 0;
  private highlightUntil = 0;
  private autoStarted = false;
  /** Best walker of the most recently revealed generation. */
  private lastBest: WalkerRun | null = null;

  static styles = [controlStyles];

  constructor() {
    super();
    this.maze = null;
    this.start = null;
    this.autoStart = false;
    this.populationSize = DEFAULT_GA_CONFIG.populationSize;
    this.mutationRate = DEFAULT_GA_CONFIG.mutationRate;
    this.genomeMultiplier = DEFAULT_GA_CONFIG.genomeMultiplier;
    this.speedLevel = DEFAULT_SPEED;
    this.colorMode = "walker";
    this.running = false;
    this.step = 0;
    this.highlight = -1;
    this.overlay = null;
    this.statusMsg = "";
    this.revealed = 0;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopLoop();
  }

  willUpdate(changed: Map<PropertyKey, unknown>): void {
    if ((changed.has("maze") || changed.has("start")) && this.maze && this.start) {
      this.resetPopulation(
        this.solver ? "New maze / start — fresh random population." : "Random population ready."
      );
      if (this.autoStart && !this.autoStarted) {
        this.autoStarted = true;
        this.running = true;
      }
    }
  }

  updated(): void {
    if (this.running && this.rafId === null) this.startLoop();
  }

  // ── GA lifecycle ────────────────────────────────────────────────────────

  private resetPopulation(msg: string): void {
    if (!this.maze || !this.start) return;
    this.solver = new GeneticSolver(this.maze, this.start, {
      populationSize: this.populationSize,
      mutationRate: this.mutationRate,
      genomeMultiplier: this.genomeMultiplier
    });
    this.revealed = 0;
    this.lastBest = null;
    this.beginGeneration();
    this.statusMsg = msg;
  }

  /** Evaluate the current genomes and set up the overlay for animation. */
  private beginGeneration(): void {
    const solver = this.solver!;
    solver.evaluate();
    const runs = solver.runs;
    this.maxT = runs.reduce((m, r) => Math.max(m, r.steps), 0);
    this.overlayId += 1;
    this.overlay = {
      id: this.overlayId,
      runs,
      colors: this.walkerColors(),
      lives: solver.config.lives
    };
    this.step = 0;
    this.highlight = -1;
    this.phase = "animating";
  }

  private walkerColors(): string[] {
    const solver = this.solver!;
    const n = solver.runs.length;
    if (this.colorMode === "walker") {
      return Array.from({ length: n }, (_, i) => `${((i * 137.508) % 360).toFixed(1)} 85% 62%`);
    }
    // Fitness: rank → red (worst) … green (best)
    const order = solver.fitnesses
      .map((f, i) => [f, i] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, i]) => i);
    const colors = new Array<string>(n);
    order.forEach((idx, rank) => {
      const t = n > 1 ? rank / (n - 1) : 1;
      colors[idx] = `${(4 + 126 * t).toFixed(1)} 85% ${(52 + 8 * t).toFixed(1)}%`;
    });
    return colors;
  }

  /** All walkers have stopped: reveal stats, highlight the best path. */
  private finishGeneration(now: number): void {
    const solver = this.solver!;
    this.step = this.maxT;
    this.phase = "highlight";
    const stats = solver.history[solver.history.length - 1]!;
    this.highlight = stats.bestIndex;
    this.lastBest = solver.runs[stats.bestIndex] ?? null;
    this.revealed = solver.history.length;
    this.highlightUntil = now + SPEED_LEVELS[this.speedLevel]!.pauseMs;
    if (stats.reached > 0 && solver.firstSolvedGeneration === stats.generation) {
      this.statusMsg = `First walker reached the goal in generation ${stats.generation}!`;
    } else if (stats.reached > 0) {
      this.statusMsg = `Generation ${stats.generation}: ${stats.reached}/${solver.runs.length} reached the goal (best in ${stats.bestSteps} steps).`;
    } else {
      this.statusMsg = `Generation ${stats.generation}: nobody reached the goal yet; ${stats.died} died.`;
    }
  }

  private nextGeneration(): void {
    this.solver!.evolve();
    this.beginGeneration();
  }

  // ── Animation loop ──────────────────────────────────────────────────────

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private startLoop(): void {
    this.stopLoop();
    this.lastTime = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.rafId = null;
    if (!this.running || !this.solver) return;
    const dt = this.lastTime ? Math.min(100, now - this.lastTime) : 16;
    this.lastTime = now;

    if (this.phase === "animating") {
      const { sps } = SPEED_LEVELS[this.speedLevel]!;
      this.step = Number.isFinite(sps) ? Math.min(this.maxT, this.step + (sps * dt) / 1000) : this.maxT;
      if (this.step >= this.maxT) this.finishGeneration(now);
    } else if (now >= this.highlightUntil) {
      this.nextGeneration();
    }
    this.rafId = requestAnimationFrame(this.tick);
  };

  // ── Handlers ────────────────────────────────────────────────────────────

  private onTrain = (): void => {
    if (!this.solver) return;
    this.running = true;
    if (this.phase === "highlight") {
      this.highlightUntil = performance.now() + SPEED_LEVELS[this.speedLevel]!.pauseMs;
    }
    this.statusMsg = "Evolving… every walker in the generation moves at once.";
    this.startLoop();
  };

  private onPause = (): void => {
    this.running = false;
    this.stopLoop();
    this.statusMsg = "Paused.";
  };

  /** Finish the current generation, or breed + fully show the next one. */
  private onStep = (): void => {
    if (!this.solver) return;
    this.running = false;
    this.stopLoop();
    if (this.phase === "highlight") this.nextGeneration();
    this.finishGeneration(performance.now());
  };

  private onReset = (): void => {
    this.resetPopulation("Reset — new random population (same maze and start).");
    if (this.running) this.startLoop();
  };

  private onPopulation = (ev: Event): void => {
    this.populationSize = Number((ev.target as HTMLInputElement).value);
  };

  private onGenome = (ev: Event): void => {
    this.genomeMultiplier = Number((ev.target as HTMLInputElement).value);
  };

  /** Population / genome length changes restart evolution when the slider is released. */
  private onStructuralChange = (): void => {
    this.resetPopulation(
      `Restarted with ${this.populationSize} walkers, genome ×${this.genomeMultiplier} shortest path.`
    );
  };

  private onMutation = (ev: Event): void => {
    this.mutationRate = Number((ev.target as HTMLInputElement).value) / 100;
    this.solver?.setMutationRate(this.mutationRate);
  };

  private onSpeed = (ev: Event): void => {
    this.speedLevel = Number((ev.target as HTMLInputElement).value);
  };

  private onColorMode = (ev: Event): void => {
    this.colorMode = (ev.target as HTMLSelectElement).value as ColorMode;
    if (this.overlay && this.solver) {
      this.overlay = { ...this.overlay, id: ++this.overlayId, colors: this.walkerColors() };
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  private liveCounts(): { moving: number; reached: number; died: number; outOfMoves: number } {
    let moving = 0;
    let reached = 0;
    let died = 0;
    let outOfMoves = 0;
    const t = Math.floor(this.step);
    for (const run of this.overlay?.runs ?? []) {
      if (t < run.steps) moving += 1;
      else if (run.end === "goal") reached += 1;
      else if (run.end === "dead") died += 1;
      else outOfMoves += 1;
    }
    return { moving, reached, died, outOfMoves };
  }

  private bestWalkerText(stats: GenerationStats | undefined): string {
    const solver = this.solver;
    const run = this.lastBest;
    if (!stats || !solver || !run) return "—";
    if (run.end === "goal") return `goal in ${run.steps} · ♥${run.livesLeft}`;
    const d = solver.distToGoal[run.finalCell] ?? -1;
    return `${d} from goal · ♥${run.livesLeft}`;
  }

  render() {
    const solver = this.solver;
    const live = this.liveCounts();
    const history = solver ? solver.history.slice(0, this.revealed) : [];
    const last = history[history.length - 1];
    const pop = solver?.runs.length ?? this.populationSize;
    const w = DEFAULT_FITNESS_WEIGHTS;
    const speed = SPEED_LEVELS[this.speedLevel]!;
    return html`
      <div class="layout">
        <aside class="panel">
          <slot name="common"></slot>

          <div class="row">
            <button type="button" class="primary" @click=${this.onTrain} ?disabled=${this.running}>
              Train
            </button>
            <button type="button" @click=${this.onPause} ?disabled=${!this.running}>Pause</button>
            <button type="button" @click=${this.onStep} title="Finish this generation / show the next one">
              Step gen
            </button>
            <button type="button" @click=${this.onReset}>Reset</button>
          </div>

          <label>Speed <span class="val">${speed.label}</span></label>
          <input
            type="range"
            min="0"
            max=${SPEED_LEVELS.length - 1}
            step="1"
            .value=${String(this.speedLevel)}
            @input=${this.onSpeed}
          />

          <label>Population <span class="val">${this.populationSize} walkers</span></label>
          <input
            type="range"
            min="10"
            max="200"
            step="10"
            .value=${String(this.populationSize)}
            @input=${this.onPopulation}
            @change=${this.onStructuralChange}
          />

          <label>Mutation rate <span class="val">${(this.mutationRate * 100).toFixed(1)}% / gene</span></label>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            .value=${String(this.mutationRate * 100)}
            @input=${this.onMutation}
          />

          <label
            >Genome length
            <span class="val"
              >${solver?.genomeLength ?? "—"} moves (×${this.genomeMultiplier.toFixed(1)} shortest)</span
            ></label
          >
          <input
            type="range"
            min="1.5"
            max="4"
            step="0.5"
            .value=${String(this.genomeMultiplier)}
            @input=${this.onGenome}
            @change=${this.onStructuralChange}
          />

          <label>Trail colour</label>
          <select @change=${this.onColorMode} .value=${this.colorMode}>
            <option value="walker">One hue per walker</option>
            <option value="fitness">By fitness (red → green)</option>
          </select>

          <div class="stats">
            <div class="stat">
              <div class="k">Generation</div>
              <div class="v">${solver?.generation ?? 0}</div>
            </div>
            <div class="stat">
              <div class="k">Step</div>
              <div class="v">${Math.floor(this.step)} / ${this.maxT}</div>
            </div>
            <div class="stat">
              <div class="k">Moving · goal</div>
              <div class="v">${live.moving} · <span style="color:#3dd68c">${live.reached}</span></div>
            </div>
            <div class="stat">
              <div class="k">Died · out of moves</div>
              <div class="v"><span style="color:#ff6b8a">${live.died}</span> · ${live.outOfMoves}</div>
            </div>
            <div class="stat">
              <div class="k">Best fitness (last gen)</div>
              <div class="v">${last ? last.best.toFixed(1) : "—"}</div>
            </div>
            <div class="stat">
              <div class="k">Avg fitness (last gen)</div>
              <div class="v">${last ? last.avg.toFixed(1) : "—"}</div>
            </div>
            <div class="stat">
              <div class="k">Reached / died (last)</div>
              <div class="v">
                ${last ? html`<span style="color:#3dd68c">${last.reached}</span> / <span style="color:#ff6b8a">${last.died}</span>` : "—"}
              </div>
            </div>
            <div class="stat">
              <div class="k">First solved</div>
              <div class="v">
                ${solver?.firstSolvedGeneration && this.revealed >= solver.firstSolvedGeneration
                  ? `gen ${solver.firstSolvedGeneration}`
                  : "—"}
              </div>
            </div>
            <div class="stat" style="grid-column: 1 / -1">
              <div class="k">Best walker (last gen)</div>
              <div class="v">${this.bestWalkerText(last)}</div>
            </div>
          </div>

          <div class="status">${this.statusMsg}</div>

          <div class="edu">
            <strong>How the genetic algorithm works.</strong>
            Each walker's genome is a fixed list of ${solver?.genomeLength ?? "N"} moves (↑ → ↓ ←),
            played one per step (shortest path here: ${solver?.shortestPath ?? "?"}). All ${pop}
            walkers start with <strong>10 points</strong>; bumping a wall costs 1 point (red tick) and
            the walker stays put. At 0 points it dies (✕). Walkers that reach the exit stop there.
            <br /><br />
            <strong>Fitness</strong> = ${w.closeness} × closeness
            (1 − <em>maze distance</em> to the exit ÷ the farthest cell's distance, via BFS along
            corridors, not straight-line) + ${w.goalBonus} for reaching the exit +
            ${w.speedBonus} × (1 − steps ÷ genome length) if it did + ${w.perLife} per point left −
            ${w.perRevisit} per revisited cell.
            <br /><br />
            <strong>Breeding:</strong> the top ${DEFAULT_GA_CONFIG.eliteCount} genomes are copied
            unchanged; the rest come from tournament selection (best of
            ${DEFAULT_GA_CONFIG.tournamentSize}), single-point crossover and per-gene mutation. Each
            child also re-rolls the move where its parent got stuck (<em>frontier mutation</em>), so
            evolution keeps probing the dead end instead of waiting for a lucky mutation.
            Click any open cell to move the start.
          </div>
        </aside>

        <section class="maze-col">
          <lp-maze-canvas
            .maze=${this.maze}
            .start=${this.start}
            .showHeatmap=${false}
            .ga=${this.overlay}
            .gaStep=${Math.floor(this.step)}
            .gaHighlight=${this.highlight}
          ></lp-maze-canvas>
          <lp-fitness-chart
            .history=${history}
            .population=${pop}
            .version=${this.revealed}
          ></lp-fitness-chart>
        </section>
      </div>
    `;
  }
}

customElements.define("lp-ga-mode", LpGaMode);

declare global {
  interface HTMLElementTagNameMap {
    "lp-ga-mode": LpGaMode;
  }
}
