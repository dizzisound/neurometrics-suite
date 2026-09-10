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
  templateUrl: './trend-chart.component.html',
  styleUrl: './trend-chart.component.scss',
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
