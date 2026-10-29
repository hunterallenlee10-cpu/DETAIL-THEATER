/**
 * The Bead Lab: drag across glossy paint to make it rain.
 *  - Ceramic: water beads into near-perfect spheres, merges, and big beads roll off.
 *  - Unprotected: water smears into flat puddles that cling, creep, and dry into spots.
 * Canvas 2D, own rAF loop that only runs while the panel is visible.
 */
import { track } from './analytics';

export type Mode = 'ceramic' | 'unprotected';

/** All tunables in one place (units: CSS px, seconds). */
export const CFG = {
  maxDrops: 450,
  spawnRate: 70,
  spawnRateMobile: 40,
  spawnRateReduced: 24,
  spawnRadius: 26,
  rMin: 1.5,
  rMax: 4.5,
  /** Spawn size skew: >1 favours small drops. */
  sizeSkew: 2.1,
  splashCount: 12,
  splashRadius: 18,
  dprMax: 2,
  /** Sizes above are for a panel this wide; they scale with the panel (clamped). */
  refWidth: 560,
  scaleMin: 1,
  scaleMax: 1.45,
  /** Pointer must move this far / be held this long before a press counts as rain (else a click = splash). */
  dragThreshold: 6,
  holdDelay: 120,
  grid: 20,

  ceramic: {
    breakFree: 3.2,
    gravity: 1500,
    maxSpeed: 900,
    drift: 60,
    damping: 0.9,
    /** chance per second that a rolling bead sheds a tiny bead behind it */
    shedRate: 2.2,
  },

  unprotected: {
    spread: 1.7,
    /** merge distance multiplier (vs. the 1.7× drawn radius) */
    mergeSpread: 1.15,
    /** only puddles bigger than this creep */
    creepR: 8,
    creepSpeed: 14,
    dryAfter: 4,
    dryJitter: 1.6,
    dryDuration: 1.1,
    spotAlpha: 0.12,
    trailStep: 3,
    trailMax: 60,
  },

  idle: { delay: 3, repeat: 9, duration: 2.6, rate: 55 },
  stroke: { duration: 2.2 },
  tilt: { y: -9, x: 4, yMobile: -4, xMobile: 2.5, range: 3, ease: 0.08 },
};

interface Drop {
  x: number;
  y: number;
  px: number;
  py: number;
  r: number;
  vx: number;
  vy: number;
  stuck: boolean;
  age: number;
  wobble: number;
  dead: boolean;
  /** 0–1 fade-out (over-limit culling or drying) */
  fade: number;
  fading: boolean;
  dryAt: number;
  shape: Float32Array;
  trail: number[] | null;
  lastTrailY: number;
}

const SHAPE_POINTS = 10;
const TAU = Math.PI * 2;

/** Organic outline: a few low-frequency harmonics sampled at SHAPE_POINTS angles. */
function makeShape(): Float32Array {
  const s = new Float32Array(SHAPE_POINTS);
  const a2 = 0.06 + Math.random() * 0.08;
  const a3 = 0.03 + Math.random() * 0.06;
  const a5 = Math.random() * 0.035;
  const p2 = Math.random() * TAU;
  const p3 = Math.random() * TAU;
  const p5 = Math.random() * TAU;
  for (let k = 0; k < SHAPE_POINTS; k++) {
    const t = (k / SHAPE_POINTS) * TAU;
    s[k] = a2 * Math.sin(2 * t + p2) + a3 * Math.sin(3 * t + p3) + a5 * Math.sin(5 * t + p5);
  }
  return s;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

interface Stroke {
  t: number;
  duration: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  rate: number;
  acc: number;
}

export class BeadLabSim {
  private ctx: CanvasRenderingContext2D;
  private spots: HTMLCanvasElement;
  private spotsCtx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  /** size scale for the current panel width */
  private s = 1;
  private drops: Drop[] = [];
  private mode: Mode = 'ceramic';
  private time = 0;
  private sprites = new Map<number, HTMLCanvasElement>();

  // grid
  private cols = 0;
  private rows = 0;
  private head = new Int32Array(0);
  private next = new Int32Array(CFG.maxDrops * 2 + 64);

  // input
  private pointerDown = false;
  private pointerType = 'mouse';
  private raining = false;
  private downX = 0;
  private downY = 0;
  private px = 0;
  private py = 0;
  private emitAcc = 0;
  private holdTimer = 0;
  private strokes: Stroke[] = [];
  private lastInteract = performance.now();
  private lastIdle = -Infinity;
  private interacted = false;

  // loop
  private visible = false;
  private running = false;
  private raf = 0;
  private lastT = 0;

  // tilt
  private tiltX = 0;
  private tiltY = 0;
  private tiltTX = 0;
  private tiltTY = 0;
  private baseY: number;
  private baseX: number;

  private readonly rate: number;
  private cleanup: (() => void)[] = [];

  constructor(
    private panel: HTMLElement,
    private canvas: HTMLCanvasElement,
    private opts: { reduced: boolean; mobile: boolean },
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.spots = document.createElement('canvas');
    this.spotsCtx = this.spots.getContext('2d')!;
    this.rate = opts.reduced ? CFG.spawnRateReduced : opts.mobile ? CFG.spawnRateMobile : CFG.spawnRate;
    this.baseY = opts.mobile ? CFG.tilt.yMobile : CFG.tilt.y;
    this.baseX = opts.mobile ? CFG.tilt.xMobile : CFG.tilt.x;

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas);
    this.cleanup.push(() => ro.disconnect());
    this.resize();

    const io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) {
        this.lastInteract = performance.now();
        this.start();
      } else this.stop();
    }, { threshold: 0.12 });
    io.observe(panel);
    this.cleanup.push(() => io.disconnect());

    const onVis = () => (document.hidden ? this.stop() : this.visible && this.start());
    document.addEventListener('visibilitychange', onVis);
    this.cleanup.push(() => document.removeEventListener('visibilitychange', onVis));

    this.bindInput();
  }

  // ── public ─────────────────────────────────────────────────────────────
  setMode(mode: Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'unprotected') {
      for (const d of this.drops) {
        d.stuck = true;
        d.vx = d.vy = 0;
        d.age = 0;
        d.dryAt = CFG.unprotected.dryAfter + Math.random() * CFG.unprotected.dryJitter;
        d.trail = null;
      }
    } else {
      // the coating sheds the water: spots wipe clean, big puddles roll off as beads
      this.spotsCtx.clearRect(0, 0, this.spots.width, this.spots.height);
      for (const d of this.drops) {
        d.trail = null;
        d.fading = false;
        d.fade = 0;
        // break big puddles into a couple of beads so the shed reads as "beading up"
        if (d.r > 6 * this.s) {
          const pieces = Math.min(4, Math.floor(d.r / (3 * this.s)));
          const rr = d.r / Math.sqrt(pieces);
          d.r = rr;
          for (let k = 1; k < pieces; k++) {
            const nd = this.makeDrop(d.x + (Math.random() - 0.5) * rr * 4, d.y + (Math.random() - 0.5) * rr * 4, rr);
            this.drops.push(nd);
          }
        }
      }
    }
    if (!this.running && this.visible) this.start();
  }

  /** Sweep a diagonal rain stroke (MAKE IT RAIN button). */
  rain(): void {
    this.interact();
    this.addStroke(CFG.stroke.duration, this.rate * 1.1);
  }

  destroy(): void {
    this.stop();
    this.cleanup.forEach((f) => f());
  }

  // ── setup ──────────────────────────────────────────────────────────────
  private resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, CFG.dprMax);
    const dprChanged = dpr !== this.dpr;
    // keep drops proportionally placed when the panel resizes
    if (this.w && this.h) {
      const sx = w / this.w;
      const sy = h / this.h;
      for (const d of this.drops) {
        d.x *= sx;
        d.y *= sy;
        d.px = d.x;
        d.py = d.y;
      }
    }
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.s = clamp(w / CFG.refWidth, CFG.scaleMin, CFG.scaleMax);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.spots.width = this.canvas.width;
    this.spots.height = this.canvas.height;
    if (dprChanged) this.sprites.clear();
    this.cols = Math.ceil(w / CFG.grid) + 2;
    this.rows = Math.ceil(h / CFG.grid) + 2;
    this.head = new Int32Array(this.cols * this.rows);
    if (!this.running) this.draw();
  }

  private bindInput(): void {
    const c = this.canvas;
    const on = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement | Window,
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      o?: AddEventListenerOptions,
    ) => {
      el.addEventListener(type, fn as EventListener, o);
      this.cleanup.push(() => el.removeEventListener(type, fn as EventListener, o));
    };

    on(c, 'pointerdown', (e) => {
      if (e.button !== 0) return;
      this.interact();
      this.pointerDown = true;
      this.pointerType = e.pointerType;
      this.raining = false;
      this.downX = this.px = e.offsetX;
      this.downY = this.py = e.offsetY;
      this.emitAcc = 0;
      // press-and-hold (without scrolling away) starts the rain
      window.clearTimeout(this.holdTimer);
      this.holdTimer = window.setTimeout(() => {
        if (this.pointerDown && !this.raining) this.beginRain();
      }, CFG.holdDelay);
      if (e.pointerType !== 'touch') c.setPointerCapture(e.pointerId);
      if (!this.running && this.visible) this.start();
    });

    on(c, 'pointermove', (e) => {
      // tilt follows any pointer over the panel
      this.setTiltTarget(e.offsetX / Math.max(1, this.w), e.offsetY / Math.max(1, this.h));
      if (!this.pointerDown) return;
      this.px = e.offsetX;
      this.py = e.offsetY;
      const dx = this.px - this.downX;
      const dy = this.py - this.downY;
      if (this.raining) return;
      if (this.pointerType === 'touch') {
        // horizontal drags can't scroll (touch-action: pan-y), so rain right away;
        // vertical ones are left to the browser to scroll
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) this.beginRain();
      } else if (dx * dx + dy * dy > CFG.dragThreshold * CFG.dragThreshold) {
        this.beginRain();
      }
    });

    // non-passive so a held finger can rain without scrolling the page
    on(
      c,
      'touchmove',
      (e) => {
        if (this.raining && e.cancelable) e.preventDefault();
      },
      { passive: false },
    );

    const end = (e: PointerEvent, cancelled: boolean) => {
      if (!this.pointerDown) return;
      window.clearTimeout(this.holdTimer);
      // a click/tap that never turned into rain = splash
      if (!cancelled && !this.raining) this.splash(this.downX, this.downY);
      this.pointerDown = false;
      this.raining = false;
      this.panel.style.touchAction = '';
      if (c.hasPointerCapture?.(e.pointerId)) c.releasePointerCapture(e.pointerId);
      this.interact();
    };
    on(c, 'pointerup', (e) => end(e, false));
    on(c, 'pointercancel', (e) => end(e, true));
    on(c, 'pointerleave', () => !this.pointerDown && this.setTiltTarget(0.5, 0.5));
  }

  private beginRain(): void {
    this.raining = true;
    this.panel.style.touchAction = 'none';
  }

  private interact(): void {
    this.lastInteract = performance.now();
    this.lastIdle = -Infinity;
    this.strokes = this.strokes.filter((s) => s.rate !== CFG.idle.rate);
    if (!this.interacted) {
      this.interacted = true;
      track('beadlab_interact', {}, true);
    }
  }

  private setTiltTarget(nx: number, ny: number): void {
    if (this.opts.reduced) return;
    this.tiltTX = clamp((nx - 0.5) * 2, -1, 1);
    this.tiltTY = clamp((ny - 0.5) * 2, -1, 1);
    if (!this.running && this.visible) this.start();
  }

  // ── loop ───────────────────────────────────────────────────────────────
  private start(): void {
    if (this.running || document.hidden) return;
    this.running = true;
    this.lastT = performance.now();
    const tick = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.lastT) / 1000);
      this.lastT = t;
      this.step(dt, t);
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private step(dt: number, now: number): void {
    this.time += dt;

    // idle invite
    if (
      !this.opts.reduced &&
      !this.pointerDown &&
      !this.strokes.length &&
      now - this.lastInteract > CFG.idle.delay * 1000 &&
      now - this.lastIdle > CFG.idle.repeat * 1000
    ) {
      this.lastIdle = now;
      this.addStroke(CFG.idle.duration, CFG.idle.rate);
    }

    // emission: pointer
    if (this.pointerDown && this.raining) {
      this.emitAcc += dt * this.rate;
      while (this.emitAcc >= 1) {
        this.emitAcc -= 1;
        this.spawnAround(this.px, this.py, CFG.spawnRadius * this.s);
      }
    }
    // emission: strokes
    for (const s of this.strokes) {
      s.t += dt / s.duration;
      const e = easeInOut(Math.min(1, s.t));
      const x = s.x0 + (s.x1 - s.x0) * e;
      const y = s.y0 + (s.y1 - s.y0) * e;
      s.acc += dt * s.rate;
      while (s.acc >= 1) {
        s.acc -= 1;
        this.spawnAround(x, y, CFG.spawnRadius * this.s);
      }
    }
    if (this.strokes.length) this.strokes = this.strokes.filter((s) => s.t < 1);

    // over the limit: oldest stuck drops fade first
    let excess = this.drops.length - CFG.maxDrops;
    if (excess > 0) {
      for (const d of this.drops) {
        if (excess <= 0) break;
        if (d.stuck && !d.fading && !d.dead) {
          d.fading = true;
          excess--;
        }
      }
    }

    if (this.mode === 'ceramic') this.stepCeramic(dt);
    else this.stepUnprotected(dt);

    this.mergePass();

    // compact
    let j = 0;
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      if (!d.dead) this.drops[j++] = d;
    }
    this.drops.length = j;

    // tilt easing
    const k = CFG.tilt.ease;
    this.tiltX += (this.tiltTX - this.tiltX) * k;
    this.tiltY += (this.tiltTY - this.tiltY) * k;
    const ry = this.baseY + this.tiltX * CFG.tilt.range;
    const rx = this.baseX - this.tiltY * CFG.tilt.range;
    this.panel.style.transform = `perspective(1200px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)`;

  }

  private stepCeramic(dt: number): void {
    const C = CFG.ceramic;
    const n = this.drops.length;
    for (let i = 0; i < n; i++) {
      const d = this.drops[i];
      if (d.dead) continue;
      d.age += dt;
      d.px = d.x;
      d.py = d.y;
      if (d.fading) {
        d.fade += dt * 1.5;
        if (d.fade >= 1) d.dead = true;
        continue;
      }
      const bf = C.breakFree * this.s;
      if (d.r > bf) d.stuck = false;
      if (d.stuck) continue;
      const a = (C.gravity * (d.r - bf)) / d.r;
      d.vy = Math.min(C.maxSpeed, d.vy + a * dt);
      d.vx += Math.sin(this.time * 1.7 + d.wobble * 9) * C.drift * dt;
      d.vx *= Math.pow(C.damping, dt * 10);
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      // shed a tiny bead behind now and then (keeps total area)
      if (d.r > bf * 1.2 && d.vy > 120 && Math.random() < C.shedRate * dt) {
        const rs = (0.9 + Math.random() * 0.7) * this.s;
        d.r = Math.sqrt(Math.max(0.5, d.r * d.r - rs * rs));
        const nd = this.makeDrop(d.x + (Math.random() - 0.5) * d.r, d.y - d.r * 1.6, rs);
        this.drops.push(nd);
      }
      if (d.y - d.r > this.h + 4 || d.x < -20 || d.x > this.w + 20) d.dead = true;
    }
  }

  private stepUnprotected(dt: number): void {
    const U = CFG.unprotected;
    const n = this.drops.length;
    for (let i = 0; i < n; i++) {
      const d = this.drops[i];
      if (d.dead) continue;
      d.age += dt;
      d.px = d.x;
      d.py = d.y;
      if (d.fading) {
        d.fade += dt * 1.5;
        if (d.fade >= 1) d.dead = true;
        continue;
      }
      // drying → water spot
      if (d.age > d.dryAt) {
        d.fade = (d.age - d.dryAt) / U.dryDuration;
        if (d.fade >= 1) {
          this.stampSpot(d);
          d.dead = true;
        }
        continue;
      }
      const cr = U.creepR * this.s;
      if (d.r > cr) {
        d.stuck = false;
        d.vy = (U.creepSpeed * (d.r - cr)) / d.r;
        d.y += d.vy * dt;
        d.x += Math.sin(this.time * 0.6 + d.wobble * 7) * 3 * dt;
        if (!d.trail) {
          d.trail = [d.x, d.y, d.r];
          d.lastTrailY = d.y;
        } else if (d.y - d.lastTrailY > U.trailStep) {
          d.trail.push(d.x, d.y, d.r);
          d.lastTrailY = d.y;
          if (d.trail.length > U.trailMax * 3) d.trail.splice(0, 3);
        }
        if (d.y - d.r * U.spread > this.h) d.dead = true;
      }
    }
  }

  /** Merge overlapping drops (area-conserving, momentum-weighted) using a uniform grid. */
  private mergePass(): void {
    const drops = this.drops;
    const n = drops.length;
    if (n < 2) return;
    if (this.next.length < n) this.next = new Int32Array(n * 2);
    const head = this.head;
    head.fill(-1);
    const G = CFG.grid;
    const cols = this.cols;
    const rows = this.rows;
    // puddles visually overlap into a smeared film; they only truly merge when their cores touch
    const spread = this.mode === 'unprotected' ? CFG.unprotected.mergeSpread : 1;
    let maxR = 0;
    for (let i = 0; i < n; i++) {
      const d = drops[i];
      if (d.dead) continue;
      if (d.r > maxR) maxR = d.r;
      const cx = clamp(Math.floor(d.x / G) + 1, 0, cols - 1);
      const cy = clamp(Math.floor(d.y / G) + 1, 0, rows - 1);
      const c = cy * cols + cx;
      this.next[i] = head[c];
      head[c] = i;
    }
    maxR *= spread;

    for (let i = 0; i < n; i++) {
      const a = drops[i];
      if (a.dead || a.fading) continue;
      const ra = a.r * spread;
      // moving drops sweep their path so fast beads don't tunnel past small ones
      const moving = !a.stuck;
      const minX = Math.min(a.x, a.px) - ra - maxR;
      const maxX = Math.max(a.x, a.px) + ra + maxR;
      const minY = Math.min(a.y, a.py) - ra - maxR;
      const maxY = Math.max(a.y, a.py) + ra + maxR;
      const c0 = clamp(Math.floor(minX / G) + 1, 0, cols - 1);
      const c1 = clamp(Math.floor(maxX / G) + 1, 0, cols - 1);
      const r0 = clamp(Math.floor(minY / G) + 1, 0, rows - 1);
      const r1 = clamp(Math.floor(maxY / G) + 1, 0, rows - 1);
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          for (let j = head[cy * cols + cx]; j !== -1; j = this.next[j]) {
            if (j === i) continue;
            const b = drops[j];
            if (b.dead || b.fading) continue;
            // stuck pairs are checked once; moving drops handle their own sweep
            if (!moving && (!b.stuck || j < i)) continue;
            const lim = ra + b.r * spread;
            let dx: number;
            let dy: number;
            if (moving) {
              // distance from b to segment p→a
              const sx = a.x - a.px;
              const sy = a.y - a.py;
              const len2 = sx * sx + sy * sy;
              const t = len2 > 0 ? clamp(((b.x - a.px) * sx + (b.y - a.py) * sy) / len2, 0, 1) : 1;
              dx = b.x - (a.px + sx * t);
              dy = b.y - (a.py + sy * t);
            } else {
              dx = b.x - a.x;
              dy = b.y - a.y;
            }
            if (dx * dx + dy * dy > lim * lim) continue;
            this.merge(a, b);
            if (a.dead) break;
          }
        }
      }
    }
  }

  private merge(a: Drop, b: Drop): void {
    const ma = a.r * a.r;
    const mb = b.r * b.r;
    const m = ma + mb;
    // keep the moving / bigger drop's momentum dominant
    a.x = (a.x * ma + b.x * mb) / m;
    a.y = (a.y * ma + b.y * mb) / m;
    a.vx = (a.vx * ma + b.vx * mb) / m;
    a.vy = (a.vy * ma + b.vy * mb) / m;
    a.r = Math.sqrt(m);
    a.age = Math.min(a.age, b.age);
    a.dryAt = Math.max(a.dryAt, b.dryAt);
    a.stuck = a.stuck && b.stuck;
    if (b.trail && !a.trail) a.trail = b.trail;
    if (mb > ma) a.shape = b.shape;
    b.dead = true;
  }

  private makeDrop(x: number, y: number, r: number): Drop {
    return {
      x,
      y,
      px: x,
      py: y,
      r,
      vx: 0,
      vy: 0,
      stuck: true,
      age: 0,
      wobble: Math.random(),
      dead: false,
      fade: 0,
      fading: false,
      dryAt: CFG.unprotected.dryAfter + Math.random() * CFG.unprotected.dryJitter,
      shape: makeShape(),
      trail: null,
      lastTrailY: y,
    };
  }

  private spawnAround(x: number, y: number, radius: number): void {
    const a = Math.random() * TAU;
    const d = Math.sqrt(Math.random()) * radius;
    const r = (CFG.rMin + (CFG.rMax - CFG.rMin) * Math.pow(Math.random(), CFG.sizeSkew)) * this.s;
    const px = x + Math.cos(a) * d;
    const py = y + Math.sin(a) * d;
    if (px < 0 || py < 0 || px > this.w || py > this.h) return;
    this.drops.push(this.makeDrop(px, py, r));
  }

  private splash(x: number, y: number): void {
    for (let k = 0; k < CFG.splashCount; k++) {
      const a = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * CFG.splashRadius * this.s;
      this.drops.push(this.makeDrop(x + Math.cos(a) * d, y + Math.sin(a) * d, (1.1 + Math.random() * 1.3) * this.s));
    }
  }

  private addStroke(duration: number, rate: number): void {
    const { w, h } = this;
    this.strokes.push({
      t: 0,
      duration,
      x0: w * 0.1,
      y0: h * 0.16,
      x1: w * 0.88,
      y1: h * 0.8,
      rate,
      acc: 0,
    });
    if (!this.running && this.visible) this.start();
  }

  // ── rendering ──────────────────────────────────────────────────────────
  private draw(): void {
    const { ctx, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.mode === 'unprotected') ctx.drawImage(this.spots, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.mode === 'ceramic') this.drawBeads();
    else this.drawPuddles();
    ctx.globalAlpha = 1;
  }

  private drawBeads(): void {
    const { ctx } = this;
    for (const d of this.drops) {
      if (d.dead) continue;
      const sprite = this.sprite(d.r);
      const shimmer = d.stuck ? 0.86 + 0.14 * Math.sin(this.time * 2.4 + d.wobble * 40) : 1;
      ctx.globalAlpha = shimmer * (1 - d.fade);
      const s = sprite.width / this.dpr;
      // rolling beads stretch a touch along their path
      if (!d.stuck && d.vy > 80) {
        const k = Math.min(0.22, d.vy / 3000);
        ctx.drawImage(sprite, d.x - (s * (1 - k * 0.5)) / 2, d.y - (s * (1 + k)) / 2, s * (1 - k * 0.5), s * (1 + k));
      } else {
        ctx.drawImage(sprite, d.x - s / 2, d.y - s / 2, s, s);
      }
    }
  }

  private puddlePath(ctx: CanvasRenderingContext2D, d: Drop, R: number): void {
    const n = SHAPE_POINTS;
    const px = (k: number) => {
      const a = (k / n) * TAU + d.wobble * TAU;
      return d.x + Math.cos(a) * R * (1 + d.shape[k % n]);
    };
    const py = (k: number) => {
      const a = (k / n) * TAU + d.wobble * TAU;
      // flat puddles sag slightly downward
      return d.y + Math.sin(a) * R * (1 + d.shape[k % n]) * 0.92 + R * 0.04;
    };
    ctx.beginPath();
    ctx.moveTo((px(0) + px(1)) / 2, (py(0) + py(1)) / 2);
    for (let k = 1; k <= n; k++) {
      const x1 = px(k);
      const y1 = py(k);
      const x2 = px(k + 1);
      const y2 = py(k + 1);
      ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
    }
    ctx.closePath();
  }

  private drawPuddles(): void {
    const { ctx } = this;
    const S = CFG.unprotected.spread;
    // wet trails
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const d of this.drops) {
      if (d.dead || !d.trail || d.trail.length < 6) continue;
      const t = d.trail;
      ctx.globalAlpha = 1 - d.fade;
      ctx.strokeStyle = 'rgba(190,205,215,0.045)';
      ctx.lineWidth = d.r * S * 0.6;
      ctx.beginPath();
      ctx.moveTo(t[0], t[1]);
      for (let k = 3; k < t.length; k += 3) ctx.lineTo(t[k], t[k + 1]);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }
    for (const d of this.drops) {
      if (d.dead) continue;
      const R = d.r * S;
      const a = 1 - d.fade;
      ctx.globalAlpha = a;
      // drying puddles shrink from the edges in
      const RR = R * (1 - d.fade * 0.25);
      this.puddlePath(ctx, d, RR);
      ctx.fillStyle = 'rgba(170,185,195,0.075)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(235,242,248,0.16)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      // soft, broad (not crisp) sheen
      if (R > 3) {
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.ellipse(d.x - RR * 0.25, d.y - RR * 0.3, RR * 0.45, RR * 0.22, -0.5, 0, TAU);
        ctx.fill();
      }
    }
  }

  private stampSpot(d: Drop): void {
    const c = this.spotsCtx;
    const R = d.r * CFG.unprotected.spread * 0.9;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.puddlePath(c, d, R);
    c.fillStyle = 'rgba(255,255,255,0.018)';
    c.fill();
    c.strokeStyle = `rgba(255,255,255,${CFG.unprotected.spotAlpha})`;
    c.lineWidth = R > 4 ? 1.1 : 0.8;
    c.stroke();
    if (R > 6) {
      // mineral ring tends to be doubled
      this.puddlePath(c, d, R * 0.82);
      c.strokeStyle = `rgba(255,255,255,${CFG.unprotected.spotAlpha * 0.45})`;
      c.lineWidth = 0.7;
      c.stroke();
    }
  }

  /** Pre-rendered bead sprite per radius bucket. */
  private sprite(r: number): HTMLCanvasElement {
    const key = r < 6 ? Math.round(r * 4) : 24 + Math.round((r - 6) * 2);
    let s = this.sprites.get(key);
    if (s) return s;
    const R = key < 24 ? key / 4 : 6 + (key - 24) / 2;
    const dpr = this.dpr;
    const size = Math.ceil((R * 2 + 6) * dpr);
    s = document.createElement('canvas');
    s.width = s.height = size;
    const g = s.getContext('2d')!;
    g.scale(dpr, dpr);
    const c = size / dpr / 2;

    // contact shadow, +1px down
    const sh = g.createRadialGradient(c, c + 1.2, R * 0.3, c, c + 1.2, R * 1.18);
    sh.addColorStop(0, 'rgba(0,0,0,0.5)');
    sh.addColorStop(0.75, 'rgba(0,0,0,0.28)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh;
    g.beginPath();
    g.arc(c, c + 1.2, R * 1.18, 0, TAU);
    g.fill();

    // translucent body: dark center → faint light edge
    const body = g.createRadialGradient(c - R * 0.12, c - R * 0.12, 0, c, c, R);
    body.addColorStop(0, 'rgba(0,0,0,0.35)');
    body.addColorStop(0.62, 'rgba(0,0,0,0.3)');
    body.addColorStop(0.86, 'rgba(255,255,255,0.03)');
    body.addColorStop(1, 'rgba(255,255,255,0.1)');
    g.fillStyle = body;
    g.beginPath();
    g.arc(c, c, R, 0, TAU);
    g.fill();

    // edge definition
    g.strokeStyle = 'rgba(255,255,255,0.14)';
    g.lineWidth = Math.max(0.5, R * 0.06);
    g.beginPath();
    g.arc(c, c, R - g.lineWidth / 2, 0, TAU);
    g.stroke();

    // refraction crescent, bottom-right (light focused through the bead)
    g.save();
    g.beginPath();
    g.arc(c, c, R * 0.94, 0, TAU);
    g.clip();
    const cr = g.createRadialGradient(c + R * 0.35, c + R * 0.42, 0, c + R * 0.35, c + R * 0.42, R * 0.9);
    cr.addColorStop(0, 'rgba(255,255,255,0.0)');
    cr.addColorStop(0.55, 'rgba(255,255,255,0.0)');
    cr.addColorStop(0.75, 'rgba(255,255,255,0.5)');
    cr.addColorStop(1, 'rgba(255,255,255,0)');
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,255,255,0.42)';
    g.lineWidth = Math.max(0.6, R * 0.1);
    g.beginPath();
    g.arc(c, c, R * 0.84, 0.08 * Math.PI, 0.58 * Math.PI);
    g.stroke();
    g.fillStyle = cr;
    g.fillRect(c - R, c - R, R * 2, R * 2);
    g.restore();

    // crisp specular, top-left
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.ellipse(c - R * 0.36, c - R * 0.4, Math.max(0.55, R * 0.27), Math.max(0.4, R * 0.17), -0.65, 0, TAU);
    g.fill();
    if (R > 2.5) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath();
      g.arc(c - R * 0.02, c - R * 0.58, R * 0.06, 0, TAU);
      g.fill();
    }

    if (this.sprites.size > 90) this.sprites.clear();
    this.sprites.set(key, s);
    return s;
  }
}

/** Wire the sim to a Bead Lab section. */
export function mountBeadLab(section: HTMLElement): BeadLabSim | null {
  const panel = section.querySelector<HTMLElement>('.bl-panel');
  const canvas = section.querySelector<HTMLCanvasElement>('.bl-canvas');
  if (!panel || !canvas) return null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 819px)').matches || matchMedia('(pointer: coarse)').matches;
  const sim = new BeadLabSim(panel, canvas, { reduced, mobile });
  sim.setMode((section.dataset.mode as Mode) || 'ceramic');
  section.querySelector('.bl-rain')?.addEventListener('click', () => sim.rain());
  return sim;
}
