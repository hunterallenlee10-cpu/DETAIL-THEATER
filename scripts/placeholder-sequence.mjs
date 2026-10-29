#!/usr/bin/env node
/**
 * npm run sequence:placeholder
 * Generates labeled dummy frames for every segment (desktop 1440×810 + mobile
 * 720×1280), a valid manifest.json, posters, and placeholder stills — so the
 * whole site works before any Higgsfield asset exists.
 */
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { PUB, ensureDir, loadSegments, pad, planFrames, pool } from './lib/util.mjs';
import { sceneSvg } from './lib/placeholder.mjs';
import { buildStills } from './build-stills.mjs';

const SETS = {
  desktop: { w: 1440, h: 810 },
  mobile: { w: 720, h: 1280 },
};

const cfg = loadSegments();
const plan = planFrames(cfg);
const version = `p${Date.now().toString(36)}`;
const seqRoot = path.join(PUB, 'seq');

// Clean previous builds (any version folder).
rmSync(seqRoot, { recursive: true, force: true });
ensureDir(seqRoot);

const t0 = Date.now();
const sets = {};

for (const [name, { w, h }] of Object.entries(SETS)) {
  const dir = ensureDir(path.join(seqRoot, version, name));
  const jobs = [];
  for (const seg of plan.segments) {
    const n = seg.end - seg.start + 1;
    for (let k = 0; k < n; k++) {
      const frame = seg.start + k;
      jobs.push({ seg, frame, local: n > 1 ? k / (n - 1) : 0 });
    }
  }
  await pool(jobs, 8, async ({ seg, frame, local }) => {
    const svg = sceneSvg({
      W: w,
      H: h,
      chapter: seg.chapter,
      segId: seg.id,
      t: frame / (plan.count - 1),
      local,
      frame,
      label: `${seg.id} · ${seg.chapter.toUpperCase()}`,
      sub: `FRAME ${pad(frame)} / ${pad(plan.count - 1)}`,
    });
    const img = sharp(Buffer.from(svg));
    await img.clone().webp({ quality: 55, effort: 4 }).toFile(path.join(dir, `f_${pad(frame)}.webp`));
    if (frame === 0) await img.clone().webp({ quality: 85 }).toFile(path.join(dir, 'poster.webp'));
  });
  sets[name] = { count: plan.count, w, h, path: `/seq/${version}/${name}/` };
  console.log(`✔ ${name}: ${plan.count} placeholder frames (${w}×${h})`);
}

const manifest = {
  version: 3,
  build: version,
  placeholder: true,
  sets,
  segments: plan.segments.map(({ id, start, end, chapter, transitionOut }) => ({ id, start, end, chapter, transitionOut })),
  chapters: plan.chapters,
  cuts: plan.cuts,
};
writeFileSync(path.join(seqRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`✔ manifest.json (${plan.count} frames, cuts at ${plan.cuts.join(', ')}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

await buildStills();
