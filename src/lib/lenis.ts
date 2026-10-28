/**
 * Shared smooth-scroll + GSAP setup. One Lenis instance, driven by the GSAP
 * ticker (a single rAF loop for the whole page). Touch stays native.
 */
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export const reducedMotion = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenis: Lenis | null = null;
let initialized = false;

export function initScroll(): Lenis | null {
  if (initialized) return lenis;
  initialized = true;
  gsap.ticker.lagSmoothing(0);
  if (reducedMotion()) return null;

  lenis = new Lenis({
    autoRaf: false,
    syncTouch: false,
    anchors: { duration: 1.4 },
    stopInertiaOnNavigate: true,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));
  return lenis;
}

export const getLenis = (): Lenis | null => lenis;

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function scrollToY(
  y: number,
  opts: { duration?: number; easing?: (t: number) => number; onComplete?: () => void } = {},
): void {
  if (lenis) {
    lenis.scrollTo(y, {
      duration: opts.duration ?? 1.4,
      easing: opts.easing ?? easeInOutCubic,
      onComplete: () => opts.onComplete?.(),
      force: true,
    });
  } else {
    window.scrollTo({ top: y, behavior: reducedMotion() ? 'auto' : 'smooth' });
    opts.onComplete?.();
  }
}

export function scrollToEl(el: Element | null, offset = 0): void {
  if (!el) return;
  const y = el.getBoundingClientRect().top + window.scrollY + offset;
  scrollToY(y);
}

/** Stop any programmatic scroll animation where it is. */
export function cancelScroll(): void {
  if (lenis) lenis.scrollTo(lenis.animatedScroll, { immediate: true, force: true });
}

let lockCount = 0;
export function lockScroll(on: boolean): void {
  lockCount = Math.max(0, lockCount + (on ? 1 : -1));
  const locked = lockCount > 0;
  if (lenis) {
    if (locked) lenis.stop();
    else lenis.start();
  }
  document.documentElement.classList.toggle('scroll-locked', locked);
}
