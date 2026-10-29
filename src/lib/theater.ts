/**
 * Detail Theater engine.
 *  - scroll progress p (one ScrollTrigger) → smoothed frame → canvas (cover-fit + focal points)
 *  - one GSAP timeline in FRAME units, scrubbed with the smoothed frame, drives every overlay
 *  - HUD gloss ring + stage checklist, FX (bubbles + flash cuts), "Watch the detail" autoplay
 * Everything runs inside the GSAP ticker (the page's single rAF loop).
 */
import { chapters as chapterConfig, theaterTuning, type Focal } from '../config/chapters';
import { brand } from '../config/brand';
import { FrameStore, MOBILE_QUERY, pickSet, type Manifest } from './frames';
import { Fx } from './bubbles';
import { gsap, ScrollTrigger, initScroll, scrollToY, cancelScroll, easeInOutCubic, reducedMotion } from './lenis';
import { track } from './analytics';

interface Ch {
  id: string;
  index: number;
  step: number | null;
  start: number;
  end: number;
  focal: Focal;
  title?: string;
  body?: string;
  chips?: string[];
  fx?: string | null;
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const pad2 = (n: number) => String(n).padStart(2, '0');

function fallback(err?: unknown): void {
  if (err) console.error('[theater] falling back to static layout:', err);
  document.documentElement.classList.add('static-theater');
  document.getElementById('theater')?.classList.add('is-revealed');
  window.dispatchEvent(new CustomEvent('theater:ready'));
}

export function initTheater(root: HTMLElement): void {
  initScroll();
  if (reducedMotion()) {
    fallback();
    return;
  }
  try {
    run(root);
  } catch (err) {
    fallback(err);
  }
}

function run(root: HTMLElement): void {
  const $ = <T extends Element>(sel: string) => root.querySelector(sel) as T;
  const manifest: Manifest = JSON.parse($<HTMLScriptElement>('#seq-manifest').textContent || '{}');
  if (!manifest.sets?.desktop) throw new Error('manifest missing');

  const stage = $<HTMLElement>('.stage');
  const canvas = $<HTMLCanvasElement>('canvas.frames');
  const fxCanvas = $<HTMLCanvasElement>('canvas.fx');
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const hero = $<HTMLElement>('.hero-overlay');
  const heroScrim = $<HTMLElement>('.scrim-left');
  const hint = $<HTMLElement>('.scroll-hint');
  const card = $<HTMLElement>('.step-card');
  const numEl = $<HTMLElement>('.num-cur');
  const titleEl = $<HTMLElement>('.card-title');
  const bodyEl = $<HTMLElement>('.card-body');
  const chipEls = Array.from(root.querySelectorAll<HTMLElement>('.step-card .chip'));
  const hud = $<HTMLElement>('.hud');
  const ringBar = $<SVGCircleElement>('.ring-bar');
  const ringNum = $<HTMLElement>('.ring-num');
  const ringSr = $<HTMLElement>('.ring-sr');
  const ringBtn = $<HTMLButtonElement>('.ring-btn');
  const listBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('.checklist button'));
  const outro = $<HTMLElement>('.outro-inner');
  const outroScrim = $<HTMLElement>('.scrim-outro');
  const progress = $<HTMLElement>('.progress-line span');
  const watchBtn = $<HTMLButtonElement>('.watch-btn');
  const watchLabel = $<HTMLElement>('.watch-label');
  const watchIcon = watchBtn.querySelector('.btn-icon') as HTMLElement;

  // ── chapters with frame ranges from the manifest ──────────────────────
  const chs: Ch[] = chapterConfig.map((c, index) => {
    const r = manifest.chapters.find((m) => m.id === c.id);
    if (!r) throw new Error(`chapter ${c.id} missing from manifest`);
    return { ...c, index, start: r.start, end: r.end };
  });
  const stepChs = chs.filter((c) => c.step !== null);

  // ── frame store ──────────────────────────────────────────────────────
  let { name: setName, set } = pickSet(manifest);
  let store = new FrameStore(set);
  const N = set.count;
  const LAST = N - 1;

  const wireStore = (s: FrameStore) => {
    s.onProgress = (done, total) =>
      window.dispatchEvent(new CustomEvent('theater:progress', { detail: { done, total } }));
    s.onReady = () => window.dispatchEvent(new CustomEvent('theater:ready'));
    s.onFrame = () => (needsDraw = true);
  };
  wireStore(store);

  // ── focal points: anchors at 20% / 80% of every chapter, lerped between ─
  const anchors: { f: number; x: number; y: number }[] = [];
  for (const c of chs) {
    const L = c.end - c.start + 1;
    anchors.push({ f: c.start + L * 0.2, ...c.focal }, { f: c.end - L * 0.2, ...c.focal });
  }
  const focalAt = (f: number): Focal => {
    if (f <= anchors[0].f) return anchors[0];
    for (let k = 1; k < anchors.length; k++) {
      const a = anchors[k - 1];
      const b = anchors[k];
      if (f <= b.f) {
        const t = easeInOutSine(clamp((f - a.f) / Math.max(0.0001, b.f - a.f)));
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
    }
    return anchors[anchors.length - 1];
  };

  // ── bubbles: merged ranges of fx:bubbles chapters, ramped at the edges ─
  const bubbleRanges: [number, number][] = [];
  for (const c of chs) {
    if (c.fx !== 'bubbles') continue;
    const last = bubbleRanges[bubbleRanges.length - 1];
    if (last && c.start <= last[1] + 1) last[1] = c.end;
    else bubbleRanges.push([c.start, c.end]);
  }
  const bubbleWeight = (f: number): number => {
    let w = 0;
    for (const [s, e] of bubbleRanges) {
      const R = 8;
      w = Math.max(w, clamp(Math.min((f - s + R * 0.5) / R, (e - f + R * 0.5) / R)));
    }
    return w;
  };
  const flashAt = (f: number): number => {
    let a = 0;
    for (const cut of manifest.cuts) {
      const d = Math.abs(f - (cut - 0.5));
      if (d < 5) a = Math.max(a, 0.85 * Math.pow(1 - d / 5, 1.6));
    }
    return a;
  };

  // ── GSAP timeline in frame units ─────────────────────────────────────
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  const num = { n: stepChs[0].step ?? 1 };
  {
    const a = chs[0];
    const L = a.end - a.start + 1;
    tl.fromTo(hint, { autoAlpha: 1 }, { autoAlpha: 0, duration: L * 0.25 }, 0);
    tl.fromTo(
      hero,
      { autoAlpha: 1, y: 0, filter: 'blur(0px)' },
      { autoAlpha: 0, y: -40, filter: 'blur(6px)', duration: L * 0.4, ease: 'power1.in' },
      a.start + L * 0.6,
    );
    tl.fromTo(heroScrim, { autoAlpha: 1 }, { autoAlpha: 0, duration: L * 0.4 }, a.start + L * 0.6);
  }
  stepChs.forEach((c, k) => {
    const L = c.end - c.start + 1;
    const inAt = c.start + L * 0.06;
    const inDur = Math.max(2, L * 0.16);
    const outDur = Math.max(1.5, L * 0.12);
    const outAt = c.end + 1 - L * 0.06 - outDur;
    const first = k === 0;
    tl.fromTo(
      card,
      { autoAlpha: 0, y: 28, filter: 'blur(10px)' },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: inDur, ease: 'power2.out', immediateRender: first },
      inAt,
    );
    tl.fromTo(
      chipEls,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: inDur * 0.6, stagger: inDur * 0.12, ease: 'power2.out', immediateRender: first },
      inAt + inDur * 0.25,
    );
    tl.fromTo(num, { n: (c.step ?? 1) - 1 }, { n: c.step ?? 1, duration: inDur * 0.8, immediateRender: false }, inAt);
    tl.fromTo(card, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -16, duration: outDur, ease: 'power2.in', immediateRender: false }, outAt);
  });
  const reveal = chs[chs.length - 1];
  const RL = reveal.end - reveal.start + 1;
  const outroAt = reveal.start + RL * 0.55;
  tl.fromTo(
    outro,
    { autoAlpha: 0, y: 30, filter: 'blur(8px)' },
    { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: RL * 0.22, ease: 'power2.out' },
    outroAt,
  );
  tl.fromTo(outroScrim, { autoAlpha: 0 }, { autoAlpha: 1, duration: RL * 0.3 }, outroAt - RL * 0.08);
  tl.set({}, {}, LAST);

  // ── canvas sizing ────────────────────────────────────────────────────
  const fx = new Fx(fxCanvas, { accent: brand.COLOR_ACCENT, gold: brand.COLOR_HIGHLIGHT }, matchMedia('(max-width: 819px)').matches);
  let cssW = 0;
  let cssH = 0;
  const resize = () => {
    const r = stage.getBoundingClientRect();
    cssW = r.width;
    cssH = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    fx.resize(cssW, cssH);
    needsDraw = true;
  };
  new ResizeObserver(resize).observe(stage);

  // ── state ────────────────────────────────────────────────────────────
  let p = 0;
  let cur = 0;
  let lastDrawn = -1;
  let lastFocal = { x: -1, y: -1 };
  let needsDraw = true;
  let visible = true;
  let lastTime = performance.now();
  let activeIdx = -1;
  let cardIdx = -1;
  let lastNum = '';
  let lastGloss = -1;
  let gold = false;
  let firstFrameDrawn = false;

  const drawFrame = (i: number, focal: Focal): boolean => {
    const j = store.nearest(i);
    if (j < 0) return false;
    const img = store.get(j);
    if (!img || !img.naturalWidth) return false;
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const s = Math.max(cw / iw, ch / ih);
    const dw = iw * s;
    const dh = ih * s;
    const dx = clamp(cw / 2 - focal.x * dw, cw - dw, 0);
    const dy = clamp(ch / 2 - focal.y * dh, ch - dh, 0);
    ctx.drawImage(img, dx, dy, dw, dh);
    lastDrawn = j;
    if (!firstFrameDrawn) {
      firstFrameDrawn = true;
      root.classList.add('has-frames');
    }
    return true;
  };

  const setCard = (c: Ch) => {
    titleEl.textContent = c.title ?? '';
    bodyEl.textContent = c.body ?? '';
    chipEls.forEach((el, k) => (el.textContent = c.chips?.[k] ?? ''));
  };

  const setActive = (idx: number) => {
    listBtns.forEach((b, k) => {
      b.classList.toggle('is-active', k === idx);
      b.classList.toggle('is-done', k < idx);
      if (k === idx) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
  };

  const C = 2 * Math.PI * 28;
  const setGloss = (f: number) => {
    const g = clamp(f / outroAt);
    const val = Math.round(12 + 88 * easeInOutSine(g));
    if (val !== lastGloss) {
      lastGloss = val;
      ringNum.textContent = String(val);
      ringBar.style.strokeDashoffset = (C * (1 - val / 100)).toFixed(2);
      ringSr.textContent = `Gloss ${val}%. Show all steps.`;
    }
    const isGold = f >= outroAt;
    if (isGold !== gold) {
      gold = isGold;
      hud.classList.toggle('is-gold', gold);
    }
  };

  const chapterAt = (f: number): number => {
    for (let k = chs.length - 1; k >= 0; k--) if (f >= chs[k].start) return k;
    return 0;
  };

  const render = (dt: number) => {
    const target = p * LAST;
    const diff = target - cur;
    if (Math.abs(diff) < 0.01) cur = target;
    else cur += diff * theaterTuning.smoothing;

    const idx = Math.round(cur);
    const focal = focalAt(cur);
    const focalMoved = Math.abs(focal.x - lastFocal.x) + Math.abs(focal.y - lastFocal.y) > 0.0005;
    const wantJ = store.nearest(idx);
    if (needsDraw || wantJ !== lastDrawn || focalMoved) {
      if (drawFrame(idx, focal)) {
        lastFocal = focal;
        needsDraw = false;
      }
    }
    if (diff !== 0) store.decodeAhead(idx, Math.sign(diff));
    store.focus = idx;

    tl.time(clamp(cur, 0, LAST));

    const a = chapterAt(idx);
    if (a !== activeIdx) {
      activeIdx = a;
      setActive(a);
    }
    const c = chs[a];
    const cardCh = c.step !== null ? c : a === 0 ? stepChs[0] : stepChs[stepChs.length - 1];
    if (cardCh.index !== cardIdx) {
      cardIdx = cardCh.index;
      setCard(cardCh);
    }
    const n = pad2(Math.max(1, Math.round(num.n)));
    if (n !== lastNum) numEl.textContent = lastNum = n;

    setGloss(cur);
    progress.style.transform = `scaleX(${(cur / LAST).toFixed(4)})`;
    fx.update(dt, bubbleWeight(cur), flashAt(cur));

    if (idx >= LAST) track('theater_complete', {}, true);
  };

  // ── scroll progress ──────────────────────────────────────────────────
  const st = ScrollTrigger.create({
    trigger: root,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => (p = self.progress),
    onRefresh: (self) => (p = self.progress),
  });
  p = st.progress;
  cur = p * LAST;

  // ── ticker / visibility ──────────────────────────────────────────────
  new IntersectionObserver(
    ([e]) => {
      const was = visible;
      visible = e.isIntersecting;
      if (visible && !was && Math.abs(p * LAST - cur) > 30) {
        cur = p * LAST;
        needsDraw = true;
      }
    },
    { rootMargin: '10% 0px' },
  ).observe(root);

  gsap.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (!visible || document.hidden) return;
    render(dt);
  });

  // pointer for popping bubbles
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    fx.setPointer(e.clientX - r.left, e.clientY - r.top);
  });
  stage.addEventListener('pointerleave', () => fx.setPointer(-999, -999));

  // ── set switching (orientation change) ───────────────────────────────
  matchMedia(MOBILE_QUERY).addEventListener('change', () => {
    const next = pickSet(manifest);
    if (next.name === setName) return;
    store.stop();
    setName = next.name;
    set = next.set;
    store = new FrameStore(set);
    wireStore(store);
    store.focus = Math.round(cur);
    store.start();
    needsDraw = true;
  });

  // ── geometry helpers ─────────────────────────────────────────────────
  const sectionTop = () => root.getBoundingClientRect().top + window.scrollY;
  const range = () => root.offsetHeight - window.innerHeight;
  const yForFrame = (f: number) => sectionTop() + (f / LAST) * range();

  // ── HUD: jump to chapter + mobile sheet ──────────────────────────────
  const mqMobile = matchMedia('(max-width: 819px)');
  const syncRingBtn = () => {
    ringBtn.tabIndex = mqMobile.matches ? 0 : -1;
    if (mqMobile.matches) ringBtn.removeAttribute('aria-hidden');
    else ringBtn.setAttribute('aria-hidden', 'true');
    if (!mqMobile.matches) setSheet(false);
  };
  const setSheet = (open: boolean) => {
    hud.classList.toggle('is-open', open);
    ringBtn.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('hud-open', open);
    if (open) listBtns[Math.max(0, activeIdx)]?.focus({ preventScroll: true });
  };
  mqMobile.addEventListener('change', syncRingBtn);
  syncRingBtn();
  ringBtn.addEventListener('click', () => mqMobile.matches && setSheet(!hud.classList.contains('is-open')));
  hud.querySelector('.hud-backdrop')!.addEventListener('click', () => setSheet(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hud.classList.contains('is-open')) {
      setSheet(false);
      ringBtn.focus();
    }
  });
  listBtns.forEach((b) =>
    b.addEventListener('click', () => {
      const c = chs[Number(b.dataset.jump)];
      const L = c.end - c.start + 1;
      const f = c.index === 0 ? 0 : c.index === chs.length - 1 ? LAST : c.start + L * theaterTuning.jumpOffset;
      stopAutoplay();
      setSheet(false);
      scrollToY(yForFrame(f), { duration: 1.6, easing: easeInOutCubic });
    }),
  );

  // ── "Watch the detail" autoplay ──────────────────────────────────────
  let playing = false;
  const interrupt = (e: Event) => {
    if (!playing) return;
    if (e.target instanceof Node && watchBtn.contains(e.target)) return;
    stopAutoplay();
  };
  const setPlayingUi = (on: boolean) => {
    watchBtn.setAttribute('aria-pressed', String(on));
    watchLabel.textContent = on ? watchLabel.dataset.stop! : watchLabel.dataset.play!;
    watchIcon.textContent = on ? '■' : '▶';
  };
  function stopAutoplay() {
    if (!playing) return;
    playing = false;
    cancelScroll();
    setPlayingUi(false);
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => window.removeEventListener(t, interrupt, true));
  }
  const startAutoplay = () => {
    playing = true;
    setPlayingUi(true);
    const segs = manifest.segments.length;
    const remaining = 1 - p;
    const duration = Math.max(1, segs * theaterTuning.autoplayPerSegment * remaining);
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) =>
      window.addEventListener(t, interrupt, { capture: true, passive: true }),
    );
    scrollToY(sectionTop() + range() - 1, {
      duration,
      easing: (t) => t,
      onComplete: () => {
        if (!playing) return;
        playing = false;
        setPlayingUi(false);
        ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => window.removeEventListener(t, interrupt, true));
      },
    });
  };
  watchBtn.addEventListener('click', () => (playing ? stopAutoplay() : startAutoplay()));

  // ── hero reveal as the loader fades ──────────────────────────────────
  const revealHero = () => {
    if (root.classList.contains('is-prereveal')) return;
    root.classList.add('is-prereveal');
    void root.offsetWidth; // commit the hidden state while the loader is still opaque
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-revealed')));
  };
  if (!document.documentElement.dataset.loaderDone) {
    window.addEventListener('loader:leaving', revealHero, { once: true });
  }

  // start loading frames after first paint
  const kick = () => store.start();
  if ('requestIdleCallback' in window) requestIdleCallback(kick, { timeout: 300 });
  else setTimeout(kick, 300);
}
