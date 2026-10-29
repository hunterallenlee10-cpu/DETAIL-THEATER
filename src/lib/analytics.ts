/**
 * Analytics stub. Wire `send` to Vercel Analytics, GA4, Plausible… later.
 * e.g. Vercel: import { track } from '@vercel/analytics'; track(name, props)
 */
export type AnalyticsEvent =
  | 'quote_open'
  | 'quote_step2'
  | 'quote_submit'
  | 'call_click'
  | 'text_click'
  | 'theater_complete'
  | 'beadlab_interact';

const fired = new Set<string>();

export function track(name: AnalyticsEvent, props: Record<string, unknown> = {}, once = false): void {
  if (once) {
    if (fired.has(name)) return;
    fired.add(name);
  }
  if (import.meta.env.DEV) console.debug('[analytics]', name, props);
  const w = window as Window & { gtag?: (...a: unknown[]) => void; va?: (...a: unknown[]) => void };
  w.gtag?.('event', name, props);
}

/** Delegate call/text tracking for every tel:/sms: link on the page. */
export function trackContactLinks(): void {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href^="tel:"], a[href^="sms:"]');
    if (!a) return;
    track(a.getAttribute('href')!.startsWith('tel:') ? 'call_click' : 'text_click', {
      where: a.closest('[data-track-area]')?.getAttribute('data-track-area') ?? 'page',
    });
  });
}
