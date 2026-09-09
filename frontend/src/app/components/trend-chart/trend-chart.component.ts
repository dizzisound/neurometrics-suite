/**
 * Grafico di andamento longitudinale riutilizzabile (linea + area), costruito in
 * SVG puro secondo il metodo dataviz del progetto: marcatori arrotondati, griglia
 * hairline recessiva, crosshair con tooltip, parità tastiera/hover, vista tabella
 * come gemella di accessibilità. Il colore segue l'entità (paradigma o metrica),
 * mai il rango, ed è preso solo dalla palette validata (vedi i quattro ruoli sotto).
 */

import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface TrendChartPoint {
  /** ISO date string della sessione */
  date: string;
  value: number;
}

/** Ogni slot è un'entità fissa della palette categoriale validata (mai ciclica). */
export type TrendSeriesColor = 'stroop' | 'gonogo' | 'flanker' | 'tau';

interface PlottedPoint {
  index: number;
  x: number;
  y: number;
  value: number;
  dateShort: string;
  dateFull: string;
}

const VIEW_WIDTH = 500;
const VIEW_HEIGHT = 230;
const MARGIN = { top: 14, right: 50, bottom: 28, left: 44 };
const MAX_X_LABELS = 6;

function niceStep(rawStep: number): number {
  if (!isFinite(rawStep) || rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const fraction = rawStep / Math.pow(10, exponent);
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * Math.pow(10, exponent);
}

const AXIS_DATE_FORMAT = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' });
const FULL_DATE_FORMAT = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

@Component({
  selector: 'app-trend-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'hostColorClass()' },
  template: `
    <div class="tc-root">
      @if (!hasData()) {
        <p class="tc-empty">{{ emptyMessage() }}</p>
      } @else if (showTable()) {
        <div class="tc-table-wrap">
          <table class="tc-table">
            <caption class="tc-sr-only">{{ ariaLabel() }}</caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">{{ seriesLabel() }}{{ unit() ? ' (' + unit() + ')' : '' }}</th>
              </tr>
            </thead>
            <tbody>
              @for (p of plotted(); track p.index) {
                <tr>
                  <td>{{ p.dateFull }}</td>
                  <td class="tc-table-value">{{ formatValue(p.value) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="tc-plot-wrap">
          <svg
            #svgEl
            [attr.viewBox]="viewBox"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            [attr.aria-label]="ariaLabel()"
          >
            <!-- Griglia orizzontale hairline (recessiva) -->
            @for (line of gridlines(); track line.y) {
              <line
                class="tc-grid"
                [attr.x1]="plotLeft"
                [attr.x2]="plotRight"
                [attr.y1]="line.y"
                [attr.y2]="line.y"
                vector-effect="non-scaling-stroke"
              />
              <text class="tc-axis-label" [attr.x]="plotLeft - 8" [attr.y]="line.y" text-anchor="end" dominant-baseline="middle">
                {{ line.label }}
              </text>
            }

            <!-- Linea dello zero, se il dominio attraversa lo zero -->
            @if (zeroLineY(); as zy) {
              <line
                class="tc-baseline"
                [attr.x1]="plotLeft"
                [attr.x2]="plotRight"
                [attr.y1]="zy"
                [attr.y2]="zy"
                vector-effect="non-scaling-stroke"
              />
            }

            <!-- Etichette asse X (sottocampionate per evitare collisioni) -->
            @for (p of xTicks(); track p.index) {
              <text class="tc-axis-label" [attr.x]="p.x" [attr.y]="plotBottom + 18" text-anchor="middle">
                {{ p.dateShort }}
              </text>
            }

            <!-- Area (10% di opacità, un velo, mai un blocco saturo) -->
            <path class="tc-area" [attr.d]="areaPath()" />

            <!-- Linea, 2px, giunzioni arrotondate -->
            <path class="tc-line" [attr.d]="linePath()" vector-effect="non-scaling-stroke" />

            <!-- Marcatore di fine linea con anello di superficie ed etichetta diretta -->
            @if (lastPoint(); as last) {
              <circle class="tc-marker" [attr.cx]="last.x" [attr.cy]="last.y" r="5" />
              <text class="tc-end-label" [attr.x]="last.x + 9" [attr.y]="last.y" dominant-baseline="middle">
                {{ formatValueCompact(last.value) }}
              </text>
            }

            <!-- Crosshair + marcatore attivo -->
            @if (hovered(); as h) {
              <line
                class="tc-crosshair"
                [attr.x1]="h.x"
                [attr.x2]="h.x"
                [attr.y1]="plotTop"
                [attr.y2]="plotBottom"
                vector-effect="non-scaling-stroke"
              />
              <circle class="tc-marker tc-marker-active" [attr.cx]="h.x" [attr.cy]="h.y" r="6" />
            }

            <!-- Superficie di interazione: unica area attiva per hover/focus/tastiera -->
            <rect
              class="tc-hit-area"
              [attr.x]="plotLeft"
              [attr.y]="0"
              [attr.width]="plotRight - plotLeft"
              [attr.height]="VIEW_HEIGHT"
              tabindex="0"
              [attr.aria-label]="ariaLabel() + '. Usa le frecce sinistra e destra per esplorare i valori nel tempo.'"
              (pointermove)="onPointerMove($event, svgEl)"
              (pointerleave)="onPointerLeave()"
              (focus)="onFocus()"
              (blur)="onBlur()"
              (keydown)="onKeydown($event)"
            />
          </svg>

          @if (hovered(); as h) {
            <div class="tc-tooltip" [style.left.%]="tooltipLeftPct(h)" [style.top.%]="tooltipTopPct(h)">
              <div class="tc-tooltip-row">
                <span class="tc-linekey"></span>
                <span class="tc-tooltip-value">{{ formatValue(h.value) }}</span>
              </div>
              <div class="tc-tooltip-label">{{ seriesLabel() }}</div>
              <div class="tc-tooltip-date">{{ h.dateFull }}</div>
            </div>
          }

          <div class="tc-sr-only" aria-live="polite">{{ liveDescription() }}</div>
        </div>
      }

      @if (hasData()) {
        <button type="button" class="tc-table-toggle" (click)="toggleTable()">
          {{ showTable() ? 'Vedi come grafico' : 'Vedi come tabella' }}
        </button>
      }
    </div>
  `,
  styles: [
    `
    :host {
      --tc-series-stroop: #2a78d6;
      --tc-series-gonogo: #eb6834;
      --tc-series-flanker: #1baf7a;
      --tc-series-tau: #eda100;
      --tc-surface: #ffffff;
      --tc-text-primary: #0b0b0b;
      --tc-text-secondary: #52514e;
      --tc-text-muted: #898781;
      --tc-grid: #e1e0d9;
      --tc-axis: #c3c2b7;
      --tc-ring: rgba(11, 11, 11, 0.1);
      display: block;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    }
    :host.tc-color-stroop { --tc-series: var(--tc-series-stroop); }
    :host.tc-color-gonogo { --tc-series: var(--tc-series-gonogo); }
    :host.tc-color-flanker { --tc-series: var(--tc-series-flanker); }
    :host.tc-color-tau { --tc-series: var(--tc-series-tau); }

    .tc-root { position: relative; }

    .tc-empty {
      margin: 0;
      padding: 40px 12px;
      text-align: center;
      color: var(--tc-text-muted);
      font-size: 0.9rem;
    }

    .tc-plot-wrap { position: relative; }
    svg { display: block; width: 100%; height: auto; }

    text { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
    .tc-axis-label { font-size: 10px; fill: var(--tc-text-muted); }
    .tc-end-label { font-size: 11px; font-weight: 600; fill: var(--tc-text-primary); }

    .tc-grid { stroke: var(--tc-grid); stroke-width: 1; }
    .tc-baseline { stroke: var(--tc-axis); stroke-width: 1.25; }

    .tc-area { fill: var(--tc-series); fill-opacity: 0.1; stroke: none; }
    .tc-line { fill: none; stroke: var(--tc-series); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    .tc-marker { fill: var(--tc-series); stroke: var(--tc-surface); stroke-width: 2; }
    .tc-marker-active { fill: var(--tc-series); stroke: var(--tc-surface); stroke-width: 2.5; }

    .tc-crosshair { stroke: var(--tc-axis); stroke-width: 1; stroke-dasharray: none; opacity: 0.7; }

    .tc-hit-area { fill: transparent; cursor: crosshair; }
    .tc-hit-area:focus-visible { outline: 2px solid var(--tc-series); outline-offset: 2px; }

    .tc-tooltip {
      position: absolute;
      transform: translate(-50%, -115%);
      background: var(--tc-surface);
      border: 1px solid var(--tc-ring);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      border-radius: 6px;
      padding: 8px 10px;
      pointer-events: none;
      white-space: nowrap;
      z-index: 2;
    }
    .tc-tooltip-row { display: flex; align-items: center; gap: 6px; }
    .tc-linekey { width: 12px; height: 2px; border-radius: 1px; background: var(--tc-series); display: inline-block; }
    .tc-tooltip-value { font-size: 0.95rem; font-weight: 700; color: var(--tc-text-primary); }
    .tc-tooltip-label { font-size: 0.75rem; color: var(--tc-text-secondary); margin-top: 2px; }
    .tc-tooltip-date { font-size: 0.7rem; color: var(--tc-text-muted); margin-top: 1px; }

    .tc-sr-only {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .tc-table-toggle {
      margin-top: 10px;
      padding: 5px 10px;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--tc-text-secondary);
      background: transparent;
      border: 1px solid var(--tc-ring);
      border-radius: 4px;
      cursor: pointer;
    }
    .tc-table-toggle:hover { color: var(--tc-text-primary); border-color: var(--tc-axis); }

    .tc-table-wrap { overflow-x: auto; }
    .tc-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .tc-table th, .tc-table td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--tc-grid); }
    .tc-table th { color: var(--tc-text-secondary); font-weight: 600; }
    .tc-table td { color: var(--tc-text-primary); }
    .tc-table-value { font-variant-numeric: tabular-nums; }
    `,
  ],
})
export class TrendChartComponent {
  points = input<TrendChartPoint[]>([]);
  unit = input<string>('');
  seriesLabel = input<string>('Valore');
  color = input<TrendSeriesColor>('stroop');
  ariaLabel = input<string>('Grafico di andamento');
  emptyMessage = input<string>('Nessuna sessione disponibile per questa selezione.');

  protected readonly VIEW_WIDTH = VIEW_WIDTH;
  protected readonly VIEW_HEIGHT = VIEW_HEIGHT;
  protected readonly viewBox = `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`;
  protected readonly plotTop = MARGIN.top;
  protected readonly plotBottom = VIEW_HEIGHT - MARGIN.bottom;
  protected readonly plotLeft = MARGIN.left;
  protected readonly plotRight = VIEW_WIDTH - MARGIN.right;

  showTable = signal(false);
  hoverIndex = signal<number | null>(null);

  private readonly numberFormat = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });

  hostColorClass = computed(() => `tc-color-${this.color()}`);

  hasData = computed(() => this.points().length > 0);

  private yDomain = computed(() => {
    const values = this.points().map((p) => p.value);
    const rawMin = Math.min(0, ...values);
    const rawMax = Math.max(0, ...values);
    const range = rawMax - rawMin || Math.abs(rawMax) || 1;
    const step = niceStep(range / 4);
    let min = Math.floor(rawMin / step) * step;
    let max = Math.ceil(rawMax / step) * step;
    if (min === max) {
      min -= step;
      max += step;
    }
    return { min, max, step };
  });

  gridlines = computed(() => {
    const { min, max, step } = this.yDomain();
    const lines: { y: number; label: string }[] = [];
    for (let v = min; v <= max + step / 2; v += step) {
      lines.push({ y: this.scaleY(v), label: this.numberFormat.format(v) });
    }
    return lines;
  });

  zeroLineY = computed(() => {
    const { min, max } = this.yDomain();
    return min < 0 && max > 0 ? this.scaleY(0) : null;
  });

  plotted = computed<PlottedPoint[]>(() => {
    const pts = this.points();
    const n = pts.length;
    return pts.map((p, i) => {
      const d = new Date(p.date);
      return {
        index: i,
        x: n === 1 ? this.plotLeft + (this.plotRight - this.plotLeft) / 2 : this.plotLeft + (i / (n - 1)) * (this.plotRight - this.plotLeft),
        y: this.scaleY(p.value),
        value: p.value,
        dateShort: AXIS_DATE_FORMAT.format(d),
        dateFull: FULL_DATE_FORMAT.format(d),
      };
    });
  });

  linePath = computed(() => this.pathThrough(this.plotted()));

  areaPath = computed(() => {
    const pts = this.plotted();
    if (pts.length === 0) return '';
    const { min, max } = this.yDomain();
    const zeroY = this.scaleY(Math.min(Math.max(0, min), max));
    const first = pts[0];
    const last = pts[pts.length - 1];
    return `${this.pathThrough(pts)} L${last.x.toFixed(2)},${zeroY.toFixed(2)} L${first.x.toFixed(2)},${zeroY.toFixed(2)} Z`;
  });

  xTicks = computed(() => {
    const pts = this.plotted();
    const n = pts.length;
    if (n === 0) return [];
    const stride = Math.max(1, Math.ceil(n / MAX_X_LABELS));
    return pts.filter((p, i) => i % stride === 0 || i === n - 1);
  });

  lastPoint = computed(() => {
    const pts = this.plotted();
    return pts.length > 0 ? pts[pts.length - 1] : null;
  });

  hovered = computed<PlottedPoint | null>(() => {
    const idx = this.hoverIndex();
    if (idx === null) return null;
    return this.plotted()[idx] ?? null;
  });

  liveDescription = computed(() => {
    const h = this.hovered();
    return h ? `${h.dateFull}: ${this.formatValue(h.value)}` : '';
  });

  formatValue(v: number): string {
    const formatted = this.numberFormat.format(v);
    if (!this.unit()) return formatted;
    return this.unit() === '%' ? `${formatted}%` : `${formatted} ${this.unit()}`;
  }

  formatValueCompact(v: number): string {
    return this.formatValue(v);
  }

  tooltipLeftPct(p: PlottedPoint): number {
    return (p.x / VIEW_WIDTH) * 100;
  }

  tooltipTopPct(p: PlottedPoint): number {
    return (p.y / VIEW_HEIGHT) * 100;
  }

  onPointerMove(event: PointerEvent, svg: Element): void {
    const pts = this.plotted();
    if (pts.length === 0) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const localX = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    for (const p of pts) {
      const dist = Math.abs(p.x - localX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = p.index;
      }
    }
    this.hoverIndex.set(nearest);
  }

  onPointerLeave(): void {
    this.hoverIndex.set(null);
  }

  onFocus(): void {
    if (this.hoverIndex() === null) this.hoverIndex.set(this.plotted().length - 1);
  }

  onBlur(): void {
    this.hoverIndex.set(null);
  }

  onKeydown(event: KeyboardEvent): void {
    const pts = this.plotted();
    if (pts.length === 0) return;
    const current = this.hoverIndex() ?? pts.length - 1;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.hoverIndex.set(Math.max(0, current - 1));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.hoverIndex.set(Math.min(pts.length - 1, current + 1));
    }
  }

  toggleTable(): void {
    this.showTable.set(!this.showTable());
  }

  private scaleY(v: number): number {
    const { min, max } = this.yDomain();
    const span = max - min || 1;
    return this.plotTop + (1 - (v - min) / span) * (this.plotBottom - this.plotTop);
  }

  private pathThrough(pts: PlottedPoint[]): string {
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  }
}
