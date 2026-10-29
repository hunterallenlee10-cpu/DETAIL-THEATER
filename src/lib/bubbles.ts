/**
 * FX layer over the theater: soap bubbles (foam/wash chapters) and the flash
 * cuts that hide the exterior ↔ interior jumps.
 */

interface Bubble {
  x: number;
  y: number;
  r: number;
  vy: number;
  phase: number;
  wob: number;
  born: number;
}

interface Burst {
  x: number;
  y: number;
  r: number;
  t: number;
}

export class Fx {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private bubbles: Bubble[] = [];
  private bursts: Burst[] = [];
  private pointer = { x: -999, y: -999 };
  private time = 0;
  private spawnAcc = 0;
  private dirty = false;
  readonly max: number;

  constructor(
    private canvas: HTMLCanvasElement,
    private colors: { accent: string; gold: string },
    mobile: boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.max = mobile ? 10 : 26;
  }

  resize(w: number, h: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.dirty = true;
  }

  setPointer(x: number, y: number): void {
    this.pointer.x = x;
    this.pointer.y = y;
  }

  /**
   * @param dt seconds since last update
   * @param bubbleWeight 0–1 strength of the bubble effect
   * @param flash 0–1 strength of the flash bloom
   */
  update(dt: number, bubbleWeight: number, flash: number): void {
    const { ctx } = this;
    this.time += dt;
    const idle = bubbleWeight <= 0.001 && flash <= 0.001 && !this.bubbles.length && !this.bursts.length;
    if (idle) {
      if (this.dirty) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.dirty = false;
      }
      return;
    }
    this.dirty = true;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    this.stepBubbles(dt, bubbleWeight);
    this.drawBursts(dt);
    if (flash > 0.001) this.drawFlash(flash);
  }

  private stepBubbles(dt: number, weight: number): void {
    const target = Math.round(this.max * weight);
    this.spawnAcc += dt * 6;
    while (this.bubbles.length < target && this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const r = 4 + Math.random() * 12;
      this.bubbles.push({
        x: this.w * (0.3 + Math.random() * 0.65),
        y: this.h + r + Math.random() * this.h * 0.25,
        r,
        vy: 10 + Math.random() * 20,
        phase: Math.random() * Math.PI * 2,
        wob: 4 + Math.random() * 10,
        born: this.time,
      });
    }
    if (this.spawnAcc > 2) this.spawnAcc = 2;

    const px = this.pointer.x;
    const py = this.pointer.y;
    const alive: Bubble[] = [];
    for (const b of this.bubbles) {
      b.y -= b.vy * dt * (b.r < 8 ? 1.3 : 1);
      const x = b.x + Math.sin(this.time * 1.6 + b.phase) * b.wob;
      if (b.y < -b.r * 2) continue;
      const dx = x - px;
      const dy = b.y - py;
      if (dx * dx + dy * dy < (b.r + 12) * (b.r + 12)) {
        this.bursts.push({ x, y: b.y, r: b.r, t: 0 });
        continue;
      }
      alive.push(b);
      const age = Math.min(1, (this.time - b.born) * 2);
      this.drawBubble(x, b.y, b.r, age * weight);
    }
    // outside foam/wash the layer fades with the weight, then clears
    this.bubbles = weight < 0.01 ? [] : alive;
  }

  private drawBubble(x: number, y: number, r: number, a: number): void {
    const { ctx } = this;
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.02)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(255,255,255,0.22)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // iridescent rim: three offset arcs
    ctx.lineWidth = Math.max(1, r * 0.09);
    const rims: [string, number, number][] = [
      [this.colors.accent, 0.2, 2.2],
      ['#ff7ad9', 2.3, 4.2],
      [this.colors.gold, 4.3, 6.1],
    ];
    ctx.globalAlpha = a * 0.25;
    for (const [c, s, e] of rims) {
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.93, s, e);
      ctx.stroke();
    }
    ctx.globalAlpha = a * 0.55;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - r * 0.38, y - r * 0.42, Math.max(0.8, r * 0.14), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawBursts(dt: number): void {
    const { ctx } = this;
    const keep: Burst[] = [];
    for (const b of this.bursts) {
      b.t += dt / 0.32;
      if (b.t >= 1) continue;
      keep.push(b);
      const e = 1 - Math.pow(1 - b.t, 3);
      ctx.globalAlpha = (1 - b.t) * 0.8;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * (1 + e * 0.9), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + b.r;
        const d = b.r * (1 + e * 1.6);
        ctx.beginPath();
        ctx.arc(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    this.bursts = keep;
  }

  private drawFlash(a: number): void {
    const { ctx, w, h } = this;
    const cx = w * 0.55;
    const cy = h * 0.5;
    const R = Math.hypot(w, h) * 0.75;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.7, this.colors.accent);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // anamorphic streak
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.035);
    const s = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.8);
    s.addColorStop(0, 'rgba(255,255,255,1)');
    s.addColorStop(0.4, this.colors.accent);
    s.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = s;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
