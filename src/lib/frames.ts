/**
 * Tiered frame loader for the Detail Theater.
 *  Tier 0: frame 0 · Tier 1: every 12th · Tier 2: every 4th · Tier 3: the rest.
 * Max 6 concurrent fetches; inside a tier, frames nearest the playhead go first.
 * Uses HTMLImageElements (decoded ImageBitmaps for ~280 frames would be >1GB).
 */

export interface FrameSet {
  count: number;
  w: number;
  h: number;
  path: string;
}

export interface Manifest {
  version: number;
  build?: string;
  placeholder?: boolean;
  sets: { desktop: FrameSet; mobile?: FrameSet };
  segments: { id: string; start: number; end: number; chapter: string; transitionOut: string | null }[];
  chapters: { id: string; start: number; end: number }[];
  cuts: number[];
}

export const MOBILE_QUERY = '(max-aspect-ratio: 4/5)';

export function pickSet(m: Manifest): { name: 'desktop' | 'mobile'; set: FrameSet } {
  if (m.sets.mobile && matchMedia(MOBILE_QUERY).matches) return { name: 'mobile', set: m.sets.mobile };
  return { name: 'desktop', set: m.sets.desktop };
}

const MAX_CONCURRENT = 6;

export class FrameStore {
  readonly set: FrameSet;
  readonly count: number;
  private imgs: (HTMLImageElement | undefined)[];
  private loaded: Uint8Array;
  private decoded: Uint8Array;
  private tiers: number[][];
  private active = 0;
  private stopped = false;
  focus = 0;
  /** Fires with (loadedInTier0And1, totalInTier0And1). */
  onProgress: (done: number, total: number) => void = () => {};
  /** Fires when tier 0 + tier 1 are loaded. */
  onReady: () => void = () => {};
  /** Fires on every frame load (index). */
  onFrame: (i: number) => void = () => {};
  private readyFired = false;
  private earlyTotal: number;
  private earlyDone = 0;

  constructor(set: FrameSet) {
    this.set = set;
    this.count = set.count;
    this.imgs = new Array(set.count);
    this.loaded = new Uint8Array(set.count);
    this.decoded = new Uint8Array(set.count);

    const assigned = new Uint8Array(set.count);
    const tier = (step: number) => {
      const out: number[] = [];
      for (let i = 0; i < set.count; i += step) if (!assigned[i]) (assigned[i] = 1), out.push(i);
      return out;
    };
    const t0 = [0];
    assigned[0] = 1;
    const t1 = tier(12);
    // always include the last frame early so the end of the scrub isn't blank
    if (!assigned[set.count - 1]) (assigned[set.count - 1] = 1), t1.push(set.count - 1);
    const t2 = tier(4);
    const t3 = tier(1);

    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const lite = Boolean(conn?.saveData || /(^|-)(2g|3g)$/.test(conn?.effectiveType ?? ''));
    this.tiers = lite ? [t0, t1, t2] : [t0, t1, t2, t3];
    this.earlyTotal = t0.length + t1.length;
  }

  url(i: number): string {
    return `${this.set.path}f_${String(i).padStart(4, '0')}.webp`;
  }

  start(): void {
    this.pump();
  }

  stop(): void {
    this.stopped = true;
  }

  isLoaded(i: number): boolean {
    return this.loaded[i] === 1;
  }

  get(i: number): HTMLImageElement | undefined {
    return this.loaded[i] ? this.imgs[i] : undefined;
  }

  /** Nearest loaded frame to i (searching ±1, ±2 …). */
  nearest(i: number): number {
    if (this.loaded[i]) return i;
    for (let d = 1; d < this.count; d++) {
      const a = i - d;
      const b = i + d;
      if (a >= 0 && this.loaded[a]) return a;
      if (b < this.count && this.loaded[b]) return b;
      if (a < 0 && b >= this.count) break;
    }
    return -1;
  }

  /** Decode the next few frames in the scroll direction to avoid jank on first draw. */
  decodeAhead(i: number, dir: number, n = 6): void {
    const step = dir < 0 ? -1 : 1;
    for (let k = 1; k <= n; k++) {
      const j = i + k * step;
      if (j < 0 || j >= this.count) break;
      const img = this.imgs[j];
      if (img && this.loaded[j] && !this.decoded[j]) {
        this.decoded[j] = 1;
        img.decode().catch(() => {});
      }
    }
  }

  private next(): number {
    for (const tier of this.tiers) {
      if (!tier.length) continue;
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k < tier.length; k++) {
        const d = Math.abs(tier[k] - this.focus);
        if (d < bestD) (bestD = d), (best = k);
      }
      return tier.splice(best, 1)[0];
    }
    return -1;
  }

  private pump(): void {
    while (!this.stopped && this.active < MAX_CONCURRENT) {
      const i = this.next();
      if (i < 0) return;
      this.load(i);
    }
  }

  private load(i: number): void {
    this.active++;
    const img = new Image();
    img.decoding = 'async';
    const early = i === 0 || this.earlyIndex(i);
    const done = (ok: boolean) => {
      this.active--;
      if (ok) {
        this.imgs[i] = img;
        this.loaded[i] = 1;
        this.onFrame(i);
      }
      if (early) {
        this.earlyDone++;
        this.onProgress(this.earlyDone, this.earlyTotal);
        if (!this.readyFired && this.earlyDone >= this.earlyTotal) {
          this.readyFired = true;
          this.onReady();
        }
      }
      this.pump();
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = this.url(i);
  }

  private earlyIndex(i: number): boolean {
    return i % 12 === 0 || i === this.count - 1;
  }
}
