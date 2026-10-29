#!/usr/bin/env node
/**
 * npm run stills
 * Keyframes + extras → optimized AVIF/WebP stills (1920w + 960w, plus 4:5
 * mobile crops for the before/after pairs), og.jpg, favicon.svg,
 * apple-touch-icon.png and the optional footer loop video.
 *
 * Any missing source falls back to a placeholder (and is reported), so the
 * output set is always complete.
 */
import { existsSync, readFileSync, rmSync, statSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import { PUB, SRC, ensureDir, findSource, pool } from './lib/util.mjs';
import { paintSvg, sceneSvg } from './lib/placeholder.mjs';
import { font, textPath, fitSize } from './lib/text.mjs';
import { brand } from '../src/config/brand.ts';
import { copy } from '../src/config/copy.ts';
import { logoMarkSvg } from '../src/lib/logo-mark.ts';

// Keyframe → chapter + rough progress, for placeholder art.
const KF_SCENE = [
  ['arrival', 0], ['foam', 0.06], ['foam', 0.14], ['wash', 0.22], ['rinse', 0.3], ['wheels', 0.36],
  ['iron', 0.42], ['iron', 0.5], ['dry', 0.56], ['vacuum', 0.6], ['leather', 0.68], ['leather', 0.76],
  ['glass', 0.82], ['protect', 0.9], ['reveal', 1],
];

const KEYFRAMES = KF_SCENE.map((_, i) => `KF${String(i).padStart(2, '0')}`);
const EXTRAS = ['BA-CLEAN', 'PAINT-MACRO', 'PAINT-MACRO-DULL'];

/** Before/after pairs get 4:5 crops for phones; focal points come from copy.beforeAfter. */
function cropFocal() {
  const map = {};
  for (const tab of copy.beforeAfter.tabs) {
    const [x, y] = tab.pos.split(' ').map((v) => parseFloat(v) / 100);
    map[tab.before] = { x, y };
    map[tab.after] = { x, y };
  }
  return map;
}

function placeholderSvg(name, W = 1920, H = 1080) {
  if (name === 'PAINT-MACRO') return paintSvg({ W, H: Math.round((W * 10) / 16) });
  if (name === 'PAINT-MACRO-DULL') return paintSvg({ W, H: Math.round((W * 10) / 16), dull: true });
  if (name === 'BA-CLEAN') {
    return sceneSvg({ W, H, chapter: 'arrival', t: 1, local: 1, frame: 0, label: 'BA-CLEAN · AFTER', sub: 'PLACEHOLDER STILL' });
  }
  const i = KEYFRAMES.indexOf(name);
  const [chapter, t] = KF_SCENE[i];
  // "after" keyframes in the pairs need to look visibly cleaner than "before"
  const tt = name === 'KF07' || name === 'KF11' ? 1 : name === 'KF05' || name === 'KF09' ? 0 : t;
  return sceneSvg({ W, H, chapter, t: tt, local: name === 'KF06' ? 1 : tt, frame: i * 7, label: `${name} · ${chapter.toUpperCase()}`, sub: 'PLACEHOLDER STILL' });
}

function sourceFor(name) {
  if (KEYFRAMES.includes(name)) return findSource(path.join(SRC, 'desktop/keyframes'), name);
  return findSource(path.join(SRC, 'extras'), name);
}

async function writeVariants(input, outDir, name, focal) {
  const base = sharp(input, { limitInputPixels: false }).rotate();
  const jobs = [];
  for (const w of [1920, 960]) {
    const r = base.clone().resize({ width: w, withoutEnlargement: false });
    jobs.push(r.clone().webp({ quality: 74 }).toFile(path.join(outDir, `${name}-${w}.webp`)));
    jobs.push(r.clone().avif({ quality: 52, effort: 4 }).toFile(path.join(outDir, `${name}-${w}.avif`)));
  }
  if (focal) {
    const meta = await base.clone().metadata();
    const H = meta.height;
    const cw = Math.min(meta.width, Math.round((H * 4) / 5));
    const left = Math.round(Math.max(0, Math.min(meta.width - cw, focal.x * meta.width - cw / 2)));
    const crop = base.clone().extract({ left, top: 0, width: cw, height: H }).resize({ width: 800, height: 1000 });
    jobs.push(crop.clone().webp({ quality: 74 }).toFile(path.join(outDir, `${name}-m.webp`)));
    jobs.push(crop.clone().avif({ quality: 52, effort: 4 }).toFile(path.join(outDir, `${name}-m.avif`)));
  }
  await Promise.all(jobs);
}

async function buildOg(kf14, outFile) {
  const W = 1200;
  const H = 630;
  const bg = await sharp(kf14).resize({ width: W, height: H, fit: 'cover', position: 'right' }).toBuffer();
  const thin = font('display-300');
  const black = font('display-800');
  const mono = font('mono-500');
  const l1 = copy.hero.line1.toUpperCase();
  const l2 = copy.hero.line2.toUpperCase();
  const size = Math.min(fitSize(thin, l1, 104, 700), fitSize(black, l2, 104, 700));
  const p1 = textPath(thin, l1, { x: 72, y: 330, size, tracking: -0.02 });
  const p2 = textPath(black, l2, { x: 72, y: 330 + size * 0.95, size, tracking: -0.02 });
  const nameSize = fitSize(black, brand.BRAND_NAME.toUpperCase(), 26, 760);
  const pn = textPath(black, brand.BRAND_NAME.toUpperCase(), { x: 136, y: 104, size: nameSize, tracking: 0.02 });
  const tag = `${brand.TAGLINE} · ${brand.PRIMARY_CITY}`.toUpperCase();
  const pt = textPath(mono, tag, { x: 72, y: 540, size: fitSize(mono, tag, 17, 1000, 0.18), tracking: 0.18 });
  const mark = logoMarkSvg(brand.COLOR_ACCENT, { id: 'og', size: 48 }).replace('<svg ', '<svg x="72" y="70" ');
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".88"/><stop offset=".65" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#s)"/>
    ${mark}
    <path d="${pn.d}" fill="#F2F5F7"/>
    <path d="${p1.d}" fill="#F2F5F7"/>
    <path d="${p2.d}" fill="#F2F5F7"/>
    <rect x="72" y="500" width="64" height="2" fill="${brand.COLOR_ACCENT}"/>
    <path d="${pt.d}" fill="${brand.COLOR_ACCENT}"/>
  </svg>`;
  await sharp(bg).composite([{ input: Buffer.from(overlay) }]).jpeg({ quality: 84, mozjpeg: true }).toFile(outFile);
}

async function buildIcons() {
  const logoPath = brand.LOGO_FILE ? path.join(PUB, brand.LOGO_FILE.replace(/^\//, '')) : null;
  if (logoPath && existsSync(logoPath)) {
    if (logoPath.endsWith('.svg')) writeFileSync(path.join(PUB, 'favicon.svg'), readFileSync(logoPath));
    await sharp(logoPath).resize(140, 140, { fit: 'contain', background: brand.COLOR_BG }).extend({ top: 20, bottom: 20, left: 20, right: 20, background: brand.COLOR_BG }).png().toFile(path.join(PUB, 'apple-touch-icon.png'));
    return 'client logo';
  }
  writeFileSync(path.join(PUB, 'favicon.svg'), logoMarkSvg(brand.COLOR_ACCENT, { id: 'fav', bg: brand.COLOR_BG }));
  const touch = logoMarkSvg(brand.COLOR_ACCENT, { id: 'ati', size: 180 }).replace('<defs>', `<rect width="48" height="48" fill="${brand.COLOR_BG}"/><defs>`);
  await sharp(Buffer.from(touch)).resize(180, 180).png().toFile(path.join(PUB, 'apple-touch-icon.png'));
  return 'auto mark';
}

function buildLoop(outDir) {
  const src = [path.join(SRC, 'extras/LOOP.mp4'), path.join(SRC, 'desktop/clips/S13.mp4')].find((p) => existsSync(p));
  if (!src) return null;
  const mp4 = path.join(outDir, 'loop.mp4');
  const webm = path.join(outDir, 'loop.webm');
  const LIMIT = 2 * 1024 * 1024;
  for (const crf of [28, 32, 36]) {
    execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', src, '-an', '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    if (statSync(mp4).size <= LIMIT) break;
  }
  for (const crf of [40, 46, 52]) {
    execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', src, '-an', '-vf', 'scale=1280:-2', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(crf), '-row-mt', '1', webm]);
    if (statSync(webm).size <= LIMIT) break;
  }
  return path.relative(SRC, src);
}

export async function buildStills() {
  const t0 = Date.now();
  const stillsRoot = path.join(PUB, 'stills');
  // remove previous version folders
  if (existsSync(stillsRoot)) for (const d of readdirSync(stillsRoot)) rmSync(path.join(stillsRoot, d), { recursive: true, force: true });
  const version = `s${Date.now().toString(36)}`;
  const outDir = ensureDir(path.join(stillsRoot, version));
  const focal = cropFocal();
  const placeholders = [];

  const names = [...KEYFRAMES, ...EXTRAS];
  const inputs = {};
  await pool(names, 4, async (name) => {
    const src = sourceFor(name);
    let input;
    if (src) input = readFileSync(src);
    else {
      placeholders.push(name);
      input = await sharp(Buffer.from(placeholderSvg(name))).png().toBuffer();
    }
    inputs[name] = input;
    await writeVariants(input, outDir, name, focal[name]);
  });

  await buildOg(inputs.KF14, path.join(PUB, 'og.jpg'));
  const icons = await buildIcons();
  const loop = buildLoop(outDir);

  const meta = {
    version,
    path: `/stills/${version}/`,
    placeholders: placeholders.sort(),
    crops: Object.keys(focal),
    loop: Boolean(loop),
  };
  writeFileSync(path.join(stillsRoot, 'stills.json'), JSON.stringify(meta, null, 2));

  console.log(`✔ stills: ${names.length} images → ${meta.path} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (placeholders.length) console.log(`  ↳ placeholders used for: ${meta.placeholders.join(', ')}`);
  console.log(`✔ og.jpg · favicon.svg · apple-touch-icon.png (${icons})`);
  console.log(loop ? `✔ footer loop from ${loop}` : '  ↳ no footer loop (add assets-src/extras/LOOP.mp4 or desktop/clips/S13.mp4)');
  return meta;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await buildStills();
}
