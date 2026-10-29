#!/usr/bin/env node
/**
 * npm run sequence
 * Higgsfield clips (assets-src/<set>/clips/S01.mp4 …) → contiguous WebP frames in
 * public/seq/<build>/<set>/ + public/seq/manifest.json.
 *
 * Per segment (assets-src/segments.json): trimStart/trimEnd (s), reverse,
 * speedCurve (linear|easeIn|easeOut|easeInOut), eq {brightness,contrast,saturation,gamma},
 * crop {x,y,w,h} in source px. Exactly `frames` frames are sampled per segment; the first
 * frame of a segment that continues the previous one is dropped (no duplicate at seams).
 */
import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import { PUB, SRC, ensureDir, loadSegments, pad, planFrames, pool } from './lib/util.mjs';

const cfg = loadSegments();
const plan = planFrames(cfg);
const version = `r${Date.now().toString(36)}`;
const seqRoot = path.join(PUB, 'seq');
const cacheRoot = path.join(SRC, '.cache');
const LIMITS = { desktop: 30, mobile: 15 }; // MB

const CURVES = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

const clipPath = (set, id) =>
  ['.mp4', '.mov', '.webm'].map((e) => path.join(SRC, set, 'clips', id + e)).find((p) => existsSync(p));

function probe(file) {
  const out = execFileSync(ffprobe.path, [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate,nb_frames:format=duration',
    '-of', 'json', file,
  ]).toString();
  const j = JSON.parse(out);
  const s = j.streams[0];
  const [a, b] = s.r_frame_rate.split('/').map(Number);
  return { w: s.width, h: s.height, fps: b ? a / b : a, duration: Number(j.format.duration), frames: Number(s.nb_frames) || null };
}

function filterChain(seg, width) {
  const f = [];
  if (seg.crop) f.push(`crop=${seg.crop.w}:${seg.crop.h}:${seg.crop.x}:${seg.crop.y}`);
  f.push(`scale=${width}:-2:flags=lanczos`);
  if (seg.eq) {
    const e = seg.eq;
    const parts = ['brightness', 'contrast', 'saturation', 'gamma'].filter((k) => e[k] !== undefined).map((k) => `${k}=${e[k]}`);
    if (parts.length) f.push(`eq=${parts.join(':')}`);
  }
  return f.join(',');
}

async function buildSet(name, opts) {
  const missing = cfg.segments.filter((s) => !clipPath(name, s.id)).map((s) => `assets-src/${name}/clips/${s.id}.mp4`);
  if (missing.length) {
    if (name === 'mobile' && missing.length === cfg.segments.length) return null;
    console.error(`\n✖ ${name}: missing ${missing.length} clip(s):\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }

  const outDir = ensureDir(path.join(seqRoot, version, name));
  const rows = [];
  let dims = null;

  for (const [i, seg] of cfg.segments.entries()) {
    const p = plan.segments[i];
    const file = clipPath(name, seg.id);
    const info = probe(file);
    const t0 = seg.trimStart ?? 0;
    const t1 = Math.max(t0 + 0.1, info.duration - (seg.trimEnd ?? 0));

    // decode the (trimmed, filtered) clip to temporary PNGs, then pick frames by timestamp
    const tmp = path.join(cacheRoot, name, seg.id);
    rmSync(tmp, { recursive: true, force: true });
    ensureDir(tmp);
    execFileSync(ffmpegPath, [
      '-y', '-loglevel', 'error',
      '-ss', String(t0), '-to', String(t1), '-i', file,
      '-vf', filterChain(seg, opts.width),
      '-fps_mode', 'passthrough', '-an',
      path.join(tmp, '%05d.png'),
    ]);
    const decoded = readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
    const M = decoded.length;
    if (!M) throw new Error(`${seg.id}: ffmpeg produced no frames`);

    const curve = CURVES[seg.speedCurve ?? 'linear'] ?? CURVES.linear;
    const n = seg.frames;
    const picks = [];
    for (let k = 0; k < n; k++) {
      if (k === 0 && p.dropFirst) continue;
      const u = n > 1 ? k / (n - 1) : 0;
      let idx = Math.round(curve(u) * (M - 1));
      if (seg.reverse) idx = M - 1 - idx;
      picks.push(idx);
    }

    let bytes = 0;
    await pool(picks, 6, async (srcIdx, k) => {
      const frame = p.start + k;
      const out = path.join(outDir, `f_${pad(frame)}.webp`);
      const img = sharp(path.join(tmp, decoded[srcIdx]));
      if (!dims) {
        const m = await img.metadata();
        dims = { w: m.width, h: m.height };
      }
      await img.clone().resize(dims.w, dims.h, { fit: 'cover' }).webp({ quality: opts.quality, effort: 5 }).toFile(out);
      if (frame === 0) await img.clone().resize(dims.w, dims.h, { fit: 'cover' }).webp({ quality: 85 }).toFile(path.join(outDir, 'poster.webp'));
      bytes += statSync(out).size;
    });
    rmSync(tmp, { recursive: true, force: true });
    rows.push({
      seg: seg.id,
      chapter: seg.chapter,
      src: `${info.w}×${info.h} ${info.fps.toFixed(2)}fps ${info.duration.toFixed(2)}s`,
      decoded: M,
      frames: picks.length,
      kb: Math.round(bytes / 1024),
    });
    process.stdout.write(`  ${seg.id} ✔\r`);
  }

  console.log(`\n${name.toUpperCase()} (${dims.w}×${dims.h}, q${opts.quality})`);
  console.table(rows);
  const totalMb = rows.reduce((a, r) => a + r.kb, 0) / 1024;
  console.log(`  total: ${plan.count} frames · ${totalMb.toFixed(1)} MB`);
  if (totalMb > LIMITS[name]) {
    console.warn(`  ⚠ ${name} payload ${totalMb.toFixed(1)} MB is over the ${LIMITS[name]} MB budget — lower "quality" for this set or "frames" per segment in assets-src/segments.json.`);
  }
  return { count: plan.count, w: dims.w, h: dims.h, path: `/seq/${version}/${name}/`, mb: totalMb };
}

const t0 = Date.now();
// keep the old build until the new one succeeds
const old = existsSync(seqRoot) ? readdirSync(seqRoot).filter((d) => d !== 'manifest.json') : [];

const desktop = await buildSet('desktop', cfg.desktop);
const mobile = await buildSet('mobile', cfg.mobile);

const sets = { desktop: { count: desktop.count, w: desktop.w, h: desktop.h, path: desktop.path } };
if (mobile) sets.mobile = { count: mobile.count, w: mobile.w, h: mobile.h, path: mobile.path };
else console.log('\n  ↳ no mobile clips — phones will use the desktop frames with focal-point cropping');

const manifest = {
  version: 3,
  build: version,
  placeholder: false,
  sets,
  segments: plan.segments.map(({ id, start, end, chapter, transitionOut }) => ({ id, start, end, chapter, transitionOut })),
  chapters: plan.chapters,
  cuts: plan.cuts,
};
writeFileSync(path.join(seqRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
for (const d of old) rmSync(path.join(seqRoot, d), { recursive: true, force: true });
rmSync(cacheRoot, { recursive: true, force: true });

console.log(`\n✔ manifest.json · ${plan.count} frames · cuts at ${plan.cuts.join(', ')} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log('  Next: npm run stills (if keyframes changed) → npm run build');
