#!/usr/bin/env node
/**
 * npm run shotlist
 * Writes HIGGSFIELD_SHOTLIST.md from scripts/templates/shotlist.md with every
 * {{VAR}} replaced by its value in src/config/brand.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { brand } from '../src/config/brand.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STYLE_LOCK =
  "Photorealistic premium automotive photography, full-frame camera, 35mm lens at f/5.6, tripod at 1.1 m height, front three-quarter view with the car's nose pointing toward the right side of the frame, natural color, crisp micro-detail, subtle film grain, realistic reflections, no text, no watermark, no logos added, blank front license plate, no extra people, no extra vehicles.";

const EDIT_LOCK =
  'Edit the first reference image. Keep the exact same camera position, lens, framing, perspective, time of day, lighting, house, landscaping, driveway, and the exact same car (same model, color, wheels, body lines and position). Change only the following:';

const EDIT_LOCK_EXCEPT = EDIT_LOCK.replace('time of day, lighting, ', '');

const CLIP_LOCK =
  "Single continuous shot, no cuts. Photorealistic. The car's shape, wheels, badges, color and position stay perfectly consistent. Natural real-world motion speed. Avoid: morphing or warping car body, wheels changing shape, extra people, extra hands or fingers, text, logos appearing, flicker, camera shake, sudden lighting changes.";

const CLIPS = [
  ['S01', 'KF00', 'KF01', 'Locked-off tripod shot. The detailer walks into frame from the right carrying a foam cannon on a black hose, stops beside the front bumper and starts spraying; thick white foam builds up over the hood, front bumper and front wheel.'],
  ['S02', 'KF01', 'KF02', 'Locked-off tripod shot. The detailer sweeps the foam cannon side to side, spraying thick white snow foam until the entire car is blanketed; foam slowly slides down the panels and drips onto the driveway.'],
  ['S03', 'KF02', 'KF03', 'Locked-off tripod shot. Foam slides off the panels as the detailer washes the hood in straight overlapping passes with a blue microfiber mitt, dipping it into a bucket.'],
  ['S04', 'KF03', 'KF04', 'Locked-off tripod shot. The detailer rinses the car from the roof down with a fine fan spray; the remaining foam sheets away revealing clean, deep, glossy wet paint; water runs across the driveway.'],
  ['S05', 'KF04', 'KF05', 'Slow, smooth dolly push-in, the camera lowering toward the front wheel until it fills the frame. The detailer walks out of frame. Water drips from the car.'],
  ['S06', 'KF05', 'KF06', 'Locked-off close-up. A black-gloved hand sprays clear iron remover onto the wheel; within seconds it bleeds vivid purple and runs down the spokes; the hand starts working a soft brush between the spokes.'],
  ['S07', 'KF06', 'KF07', 'Locked-off close-up. The brush works around each spoke, then a stream of rinse water washes all the purple away, revealing a spotless gleaming wheel; the hand withdraws and the tire sidewall is left a satin black.'],
  ['S08', 'KF07', 'KF08', 'Slow, smooth dolly pull-back and rise from the wheel close-up to the wide shot of the whole car; the detailer walks into frame and starts drying the hood with a large plush towel.', 'Reverse trick: generate KF08 → KF07 as a push-in and set `"reverse": true` on S08 in `assets-src/segments.json`.'],
  ['S09', 'KF09', 'KF10', 'Locked-off interior shot. The gloved hand moves the vacuum nozzle methodically across the seat, into the seat rails and along the console; crumbs and sand disappear as it passes; then the hand switches to a microfiber towel on the seat bolster.'],
  ['S10', 'KF10', 'KF11', 'Locked-off interior shot. The gloved hand wipes the leather, the steering wheel and the console; surfaces turn clean, rich and matte; the hand withdraws and the ambient light strips glow softly.'],
  ['S11', 'KF12', 'KF13', 'Locked-off tripod shot. The detailer finishes wiping the windshield, walks to the rear quarter panel and crouches with an LED inspection light; the sun sinks lower and the light warms to sunset.'],
  ['S12', 'KF13', 'KF14', 'Locked-off tripod shot. The detailer sweeps the inspection light across the flawless paint, stands, and walks out of frame; the sky fades to blue-hour dusk as warm lights switch on one by one inside the house and the landscape uplights glow.'],
  ['S13', 'KF14', null, 'Ultra-slow cinematic push-in toward the car at blue hour; one or two more windows light up; reflections glide slowly along the mirror-gloss paint. No people.'],
];

const clipsMd = CLIPS.map(([id, from, to, prompt, note]) => {
  const frames = to ? `start **${from}** → end **${to}**` : `start **${from}** only (no end frame)`;
  return [
    `### ${id} — ${frames}`,
    '',
    '```',
    `${prompt} ${CLIP_LOCK}`,
    '```',
    note ? `\n> ${note}` : '',
  ].join('\n');
}).join('\n\n');

const kf = Array.from({ length: 15 }, (_, i) => `KF${String(i).padStart(2, '0')}.png`);
const clips = Array.from({ length: 13 }, (_, i) => `S${String(i + 1).padStart(2, '0')}.mp4`);
const list = (dir, files) => files.map((f) => `- [ ] \`${dir}/${f}\``).join('\n');

const CHECKLIST = [
  '**Extras** (required)',
  list('assets-src/extras', ['DETAILER-REF.png', 'PAINT-MACRO.png', 'PAINT-MACRO-DULL.png', 'BA-CLEAN.png']),
  '',
  '**Desktop keyframes** (required, 15 files)',
  list('assets-src/desktop/keyframes', kf),
  '',
  '**Desktop clips** (required, 13 files)',
  list('assets-src/desktop/clips', clips),
  '',
  '**Mobile keyframes** (optional, 15 files, 9:16)',
  list('assets-src/mobile/keyframes', kf),
  '',
  '**Mobile clips** (optional, 13 files, 9:16)',
  list('assets-src/mobile/clips', clips),
  '',
  '**Footer loop** (optional)',
  list('assets-src/extras', ['LOOP.mp4']),
].join('\n');

const vars = {
  ...Object.fromEntries(Object.entries(brand).filter(([, v]) => typeof v === 'string')),
  STYLE_LOCK,
  EDIT_LOCK,
  EDIT_LOCK_EXCEPT,
  CLIP_LOCK,
  CLIPS: clipsMd,
  CHECKLIST,
};

const template = readFileSync(path.join(root, 'scripts/templates/shotlist.md'), 'utf8');
const missing = new Set();
const out = template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, key) => {
  if (key in vars) return vars[key];
  missing.add(key);
  return m;
});

if (missing.size) {
  console.error(`✖ Unknown template vars: ${[...missing].join(', ')}`);
  process.exit(1);
}

writeFileSync(path.join(root, 'HIGGSFIELD_SHOTLIST.md'), out);
console.log('✔ HIGGSFIELD_SHOTLIST.md written');
