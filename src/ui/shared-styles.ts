import { css } from "lit";

/** Shared panel / control styles for the playground and its mode views. */
export const controlStyles = css`
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
    .seg {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      border: 1px solid var(--lp-border, #2a3b55);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .seg button {
      border: 0;
      border-radius: 0;
      padding: 8px 6px;
      font-size: 0.85rem;
    }
    .seg button[aria-pressed="true"] {
      background: var(--lp-accent, #5b9dff);
      color: #061018;
      font-weight: 600;
    }
    .maze-col {
      display: grid;
      gap: 12px;
    }
    .note {
      font-size: 0.8rem;
      color: var(--lp-muted, #9aa8bc);
    }
`;
