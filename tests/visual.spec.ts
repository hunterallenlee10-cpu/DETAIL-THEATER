/**
 * Visual checkpoint pass: screenshots of the theater at fixed scroll progress
 * values plus every section, for desktop (1440×900) and mobile (390×844).
 * Output: tests/screenshots/<project>/ (git-ignored). Fails on console errors.
 *   npm run test:visual
 */
import { test, expect, type Page } from '@playwright/test';

const P = [0, 0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95, 1];

async function scrollTheater(page: Page, p: number) {
  await page.evaluate((p) => {
    const t = document.getElementById('theater')!;
    const top = t.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (t.offsetHeight - window.innerHeight) * p);
  }, p);
  await page.waitForTimeout(1200);
}

test('theater checkpoints + full page', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.loaderDone === '1', null, { timeout: 6000 });
  const dir = `tests/screenshots/${info.project.name}`;

  for (const p of P) {
    await scrollTheater(page, p);
    await page.screenshot({ path: `${dir}/theater-p${p.toFixed(2)}.png` });
  }

  // gloss ring reaches 100 and turns gold at the end
  await expect(page.locator('.hud')).toHaveClass(/is-gold/);
  await expect(page.locator('.ring-num')).toHaveText('100');

  // walk the rest of the page so reveal animations fire, then capture it
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = page.viewportSize()!.height;
  for (let y = await page.evaluate(() => window.scrollY); y < H; y += vh * 0.6) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(800);
  // per-section captures (a single full-page shot would exceed Chrome's ~16k px limit)
  const ids = await page.$$eval('main > section:not(#theater), body > footer', (els) =>
    els.map((el, i) => {
      el.setAttribute('data-shot', String(i));
      return el.id || el.className.split(' ')[0] || `s${i}`;
    }),
  );
  for (const [i, id] of ids.entries()) {
    await page.locator(`[data-shot="${i}"]`).screenshot({ path: `${dir}/section-${String(i + 1).padStart(2, '0')}-${id}.png`, timeout: 15_000 });
  }

  expect(errors, errors.join('\n')).toEqual([]);
});

test('reduced motion gets the stacked stills', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/static-theater/);
  await expect(page.locator('.theater-static')).toBeVisible();
  await expect(page.locator('canvas.frames')).toBeHidden();
  await ctx.close();
});
