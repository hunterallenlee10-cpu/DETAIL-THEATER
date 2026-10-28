/**
 * Text → SVG path data via opentype.js, so generated images (OG image,
 * placeholder frames) render identically on Windows/macOS/Linux.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import opentype from 'opentype.js';

const require = createRequire(import.meta.url);
const cache = new Map();

const FILES = {
  'display-300': '@fontsource/unbounded/files/unbounded-latin-300-normal.woff',
  'display-800': '@fontsource/unbounded/files/unbounded-latin-800-normal.woff',
  'display-900': '@fontsource/unbounded/files/unbounded-latin-900-normal.woff',
  'mono-400': '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff',
  'mono-500': '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff',
};

export function font(key) {
  if (!cache.has(key)) {
    const buf = readFileSync(require.resolve(FILES[key]));
    cache.set(key, opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
  }
  return cache.get(key);
}

/** Width of `text` at `size` px with `tracking` (em) letter-spacing. */
export function measure(f, text, size, tracking = 0) {
  const glyphs = f.stringToGlyphs(text);
  const scale = size / f.unitsPerEm;
  let w = 0;
  glyphs.forEach((g, i) => {
    w += (g.advanceWidth ?? 0) * scale;
    if (i < glyphs.length - 1) {
      w += f.getKerningValue(g, glyphs[i + 1]) * scale + tracking * size;
    }
  });
  return w;
}

/**
 * Path data for a line of text. anchor: start | middle | end. y = baseline.
 * Returns { d, width }.
 */
export function textPath(f, text, { x = 0, y = 0, size = 16, anchor = 'start', tracking = 0 } = {}) {
  const width = measure(f, text, size, tracking);
  let cx = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const glyphs = f.stringToGlyphs(text);
  const scale = size / f.unitsPerEm;
  let d = '';
  glyphs.forEach((g, i) => {
    d += g.getPath(cx, y, size).toPathData(2);
    cx += (g.advanceWidth ?? 0) * scale;
    if (i < glyphs.length - 1) cx += f.getKerningValue(g, glyphs[i + 1]) * scale + tracking * size;
  });
  return { d, width };
}

/** Shrink `size` until the text fits `maxWidth`. */
export function fitSize(f, text, size, maxWidth, tracking = 0) {
  const w = measure(f, text, size, tracking);
  return w > maxWidth ? Math.floor((size * maxWidth) / w) : size;
}
