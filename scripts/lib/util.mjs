import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SRC = path.join(ROOT, 'assets-src');
export const PUB = path.join(ROOT, 'public');

export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const ensureDir = (p) => (existsSync(p) ? p : (mkdirSync(p, { recursive: true }), p));
export const pad = (n, w = 4) => String(n).padStart(w, '0');
export const loadSegments = () => readJson(path.join(SRC, 'segments.json'));

/** Run async fn over items with limited concurrency. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Find a source file by base name, trying common image extensions. */
export function findSource(dir, base, exts = ['.png', '.jpg', '.jpeg', '.webp']) {
  for (const ext of exts) {
    const p = path.join(dir, base + ext);
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Plan the output frame layout from segments.json: which segments drop their
 * first frame (they continue the previous segment), resulting frame ranges,
 * chapters and cut points. Shared by the real and placeholder builders so they
 * always agree.
 */
export function planFrames(cfg) {
  let cursor = 0;
  const segments = cfg.segments.map((s, i) => {
    const prev = cfg.segments[i - 1];
    const continues = Boolean(prev && prev.to && s.from === prev.to && prev.transitionOut !== 'flash');
    const out = continues ? s.frames - 1 : s.frames;
    const seg = {
      id: s.id,
      chapter: s.chapter,
      start: cursor,
      end: cursor + out - 1,
      sampled: s.frames,
      dropFirst: continues,
      transitionOut: s.transitionOut ?? null,
    };
    cursor += out;
    return seg;
  });
  const chapters = [];
  for (const s of segments) {
    const last = chapters[chapters.length - 1];
    if (last && last.id === s.chapter) last.end = s.end;
    else chapters.push({ id: s.chapter, start: s.start, end: s.end });
  }
  // Flash cuts: the first frame after a segment flagged transitionOut: "flash".
  const cuts = segments.filter((_s, i) => i > 0 && segments[i - 1].transitionOut === 'flash').map((s) => s.start);
  return { count: cursor, segments, chapters, cuts };
}
