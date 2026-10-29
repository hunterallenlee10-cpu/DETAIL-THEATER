/**
 * Placeholder artwork (SVG strings) for frames and stills, used until the real
 * Higgsfield assets land. Deliberately crude but legible: hue shifts per
 * chapter, the car brightens as the detail progresses, wheels spin with the
 * frame index so scrub direction is obvious.
 */
import { font, textPath, fitSize } from './text.mjs';

const KIND = {
  arrival: 'car',
  foam: 'car',
  wash: 'car',
  rinse: 'car',
  wheels: 'wheel',
  iron: 'wheel',
  dry: 'car',
  vacuum: 'interior',
  leather: 'interior',
  glass: 'car',
  protect: 'car',
  reveal: 'car',
};

const HUE = {
  arrival: 28,
  foam: 200,
  wash: 210,
  rinse: 190,
  wheels: 230,
  iron: 290,
  dry: 175,
  vacuum: 35,
  leather: 20,
  glass: 30,
  protect: 15,
  reveal: 225,
};

export const kindFor = (chapter) => KIND[chapter] ?? 'car';
export const hueFor = (chapter) => HUE[chapter] ?? 210;

// Crude sedan, nose to the right, drawn in a 1000×360 box (wheel centers at y=300).
const BODY =
  'M40 300 L42 238 Q52 206 140 194 L320 178 Q392 118 470 102 L640 98 Q724 104 796 172 L908 192 Q966 204 972 248 L974 300 Z';
const GLASS = 'M352 176 Q410 128 474 116 L630 113 Q690 118 742 172 Z';

function car({ cx, cy, w, t, spin, hue, dirt }) {
  const s = w / 1000;
  const L = 7 + 46 * t; // lightness rises with progress
  const body = `hsl(${hue} 22% ${L}%)`;
  const glass = `hsl(${hue} 30% ${Math.min(80, L + 18)}%)`;
  const rim = `hsl(${hue} 12% ${Math.min(85, 20 + 55 * t)}%)`;
  const wheel = (x) => {
    const spokes = Array.from({ length: 5 }, (_, k) => {
      const a = (spin + (k * Math.PI * 2) / 5).toFixed(3);
      return `<line x1="${x}" y1="300" x2="${(x + Math.cos(a) * 40).toFixed(1)}" y2="${(300 + Math.sin(a) * 40).toFixed(1)}" stroke="${rim}" stroke-width="9" stroke-linecap="round"/>`;
    }).join('');
    return `<circle cx="${x}" cy="300" r="64" fill="#050607"/><circle cx="${x}" cy="300" r="44" fill="none" stroke="${rim}" stroke-width="6"/>${spokes}`;
  };
  const highlight =
    t > 0.6
      ? `<path d="M200 190 L860 186" stroke="white" stroke-opacity="${((t - 0.6) * 1.4).toFixed(2)}" stroke-width="5" stroke-linecap="round"/>`
      : '';
  const mud = dirt > 0.05 ? `<path d="M60 296 L960 296 L960 252 Q520 270 60 262 Z" fill="#3a2a1a" opacity="${(dirt * 0.8).toFixed(2)}"/>` : '';
  return `<g transform="translate(${cx - (1000 * s) / 2} ${cy - 300 * s}) scale(${s})">
    <ellipse cx="507" cy="366" rx="520" ry="26" fill="black" opacity=".55"/>
    <path d="${BODY}" fill="${body}"/>${mud}
    <path d="${GLASS}" fill="${glass}" opacity=".7"/>${highlight}
    ${wheel(230)}${wheel(790)}
  </g>`;
}

function bigWheel({ cx, cy, r, t, spin, hue, purple }) {
  const rim = `hsl(${hue} 10% ${18 + 60 * t}%)`;
  const spokes = Array.from({ length: 10 }, (_, k) => {
    const a = spin + (k * Math.PI * 2) / 10;
    const x2 = cx + Math.cos(a) * r * 0.72;
    const y2 = cy + Math.sin(a) * r * 0.72;
    return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${rim}" stroke-width="${(r * 0.06).toFixed(1)}" stroke-linecap="round"/>`;
  }).join('');
  const bleed =
    purple > 0.02
      ? `<circle cx="${cx}" cy="${cy}" r="${r * 0.74}" fill="#b02cff" opacity="${(purple * 0.55).toFixed(2)}"/>`
      : '';
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#040506"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.76}" fill="hsl(${hue} 8% ${6 + 10 * t}%)"/>${bleed}
    <circle cx="${cx}" cy="${cy}" r="${r * 0.76}" fill="none" stroke="${rim}" stroke-width="${r * 0.05}"/>
    ${spokes}<circle cx="${cx}" cy="${cy}" r="${r * 0.12}" fill="${rim}"/>`;
}

function interior({ W, H, t, hue, sweep }) {
  const L = 8 + 30 * t;
  const seat = `hsl(${hue} 10% ${L}%)`;
  const dash = `hsl(${hue} 8% ${L * 0.7}%)`;
  const glow = t > 0.5 ? `<path d="M${W * 0.1} ${H * 0.42} Q${W * 0.5} ${H * 0.36} ${W * 0.9} ${H * 0.42}" stroke="hsl(190 90% 70%)" stroke-opacity="${((t - 0.5) * 1.6).toFixed(2)}" stroke-width="${H * 0.006}" fill="none"/>` : '';
  const crumbs = Array.from({ length: 40 }, (_, k) => {
    const x = (Math.sin(k * 91.7) * 0.5 + 0.5) * W;
    const y = H * 0.55 + (Math.cos(k * 47.3) * 0.5 + 0.5) * H * 0.4;
    if (x < sweep * W) return '';
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(H * 0.004).toFixed(1)}" fill="#c9a26b" opacity=".7"/>`;
  }).join('');
  return `<path d="M0 ${H * 0.3} Q${W / 2} ${H * 0.18} ${W} ${H * 0.3} L${W} ${H * 0.45} Q${W / 2} ${H * 0.36} 0 ${H * 0.45} Z" fill="${dash}"/>${glow}
    <rect x="${W * 0.1}" y="${H * 0.5}" width="${W * 0.3}" height="${H * 0.52}" rx="${H * 0.06}" fill="${seat}"/>
    <rect x="${W * 0.6}" y="${H * 0.5}" width="${W * 0.3}" height="${H * 0.52}" rx="${H * 0.06}" fill="${seat}"/>
    <rect x="${W * 0.44}" y="${H * 0.6}" width="${W * 0.12}" height="${H * 0.42}" rx="${H * 0.02}" fill="${dash}"/>${crumbs}`;
}

/**
 * @param {object} o
 * @param {number} o.W
 * @param {number} o.H
 * @param {string} o.chapter
 * @param {number} o.t        global detail progress 0–1 (drives cleanliness)
 * @param {number} o.local    progress inside the segment 0–1
 * @param {number} o.frame    absolute frame index (drives wheel spin)
 * @param {string} o.label    big label
 * @param {string} o.sub      small label
 * @param {string} [o.segId]
 */
export function sceneSvg({ W, H, chapter, t, local, frame, label, sub, segId }) {
  const hue = hueFor(chapter);
  const kind = kindFor(chapter);
  const portrait = H > W;
  const spin = frame * 0.11;
  const dusk = chapter === 'reveal' || chapter === 'protect' ? 1 : 0;
  const bgTop = `hsl(${hue} ${dusk ? 45 : 30}% ${dusk ? 9 : 7 + 5 * t}%)`;
  const bgBot = `hsl(${hue} 20% 3%)`;

  let art = '';
  if (kind === 'car') {
    const w = portrait ? W * 1.15 : W * 0.56;
    const cx = portrait ? W * 0.55 : W * 0.6;
    const cy = portrait ? H * 0.58 : H * 0.66;
    art = car({ cx, cy, w, t, spin, hue, dirt: Math.max(0, 1 - t * 3.2) });
    if (chapter === 'foam' || chapter === 'wash') {
      const amount = chapter === 'foam' ? local : 1 - local;
      art += `<g opacity="${(0.85 * amount).toFixed(2)}">${Array.from({ length: 26 }, (_, k) => {
        const x = cx - w * 0.45 + ((k * 37) % 100) / 100 * w * 0.9;
        const y = cy - w * 0.12 + ((k * 53) % 60) / 100 * w * 0.2;
        return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(w * 0.035).toFixed(0)}" fill="white"/>`;
      }).join('')}</g>`;
    }
    if (dusk) {
      art = `<g>${Array.from({ length: 6 }, (_, k) => `<rect x="${(W * (0.08 + k * 0.15)).toFixed(0)}" y="${(H * 0.18).toFixed(0)}" width="${(W * 0.07).toFixed(0)}" height="${(H * 0.12).toFixed(0)}" fill="hsl(38 95% 60%)" opacity="${(0.25 + 0.5 * local).toFixed(2)}"/>`).join('')}</g>${art}`;
    }
  } else if (kind === 'wheel') {
    const r = Math.min(W, H) * (portrait ? 0.42 : 0.4);
    const purple = chapter === 'iron' ? (segId === 'S06' ? local : 1 - local) : 0;
    const zoom = chapter === 'wheels' ? 0.6 + 0.4 * local : 1;
    art = bigWheel({ cx: W * 0.5, cy: H * 0.52, r: r * zoom, t, spin, hue, purple });
  } else {
    art = interior({ W, H, t, hue, sweep: chapter === 'vacuum' ? local : 1 });
  }

  const big = font('display-800');
  const mono = font('mono-500');
  const bigSize = fitSize(big, label, Math.round((portrait ? W : H) * 0.075), W * 0.86);
  const L1 = textPath(big, label, { x: W / 2, y: H * 0.47, size: bigSize, anchor: 'middle' });
  const subSize = Math.round((portrait ? W : H) * 0.026);
  const L2 = textPath(mono, sub, { x: W / 2, y: H * 0.47 + bigSize * 0.95, size: subSize, anchor: 'middle', tracking: 0.12 });
  const tagSize = Math.round((portrait ? W : H) * 0.018);
  const L3 = textPath(mono, 'PLACEHOLDER · REPLACE WITH HIGGSFIELD ASSET', {
    x: W / 2,
    y: portrait ? H * 0.12 : H * 0.1,
    size: tagSize,
    anchor: 'middle',
    tracking: 0.2,
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bgTop}"/><stop offset="1" stop-color="${bgBot}"/></linearGradient>
    <radialGradient id="glow" cx=".62" cy=".55" r=".6"><stop offset="0" stop-color="hsl(${hue} 60% 50%)" stop-opacity="${(0.08 + 0.14 * t).toFixed(2)}"/><stop offset="1" stop-color="black" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${kind === 'car' ? `<rect y="${(H * (portrait ? 0.62 : 0.72)).toFixed(0)}" width="${W}" height="${H}" fill="hsl(${hue} 6% ${4 + 6 * t}%)"/>` : ''}
  ${art}
  <path d="${L1.d}" fill="white" fill-opacity=".16"/>
  <path d="${L2.d}" fill="white" fill-opacity=".38"/>
  <path d="${L3.d}" fill="white" fill-opacity=".3"/>
</svg>`;
}

/** Procedural glossy black paint with a diagonal light streak (decent stand-in for PAINT-MACRO). */
export function paintSvg({ W, H, dull = false }) {
  const streak = dull
    ? `<path d="M${-W * 0.1} ${H * 0.18} L${W * 0.75} ${H * 0.58}" stroke="white" stroke-opacity=".22" stroke-width="${H * 0.16}" stroke-linecap="round" filter="url(#b2)"/>`
    : `<path d="M${-W * 0.1} ${H * 0.16} L${W * 0.78} ${H * 0.6}" stroke="white" stroke-opacity=".5" stroke-width="${H * 0.1}" stroke-linecap="round" filter="url(#b1)"/>
       <path d="M${-W * 0.1} ${H * 0.16} L${W * 0.78} ${H * 0.6}" stroke="white" stroke-opacity=".9" stroke-width="${H * 0.018}" stroke-linecap="round" filter="url(#b0)"/>`;
  const swirls = dull
    ? Array.from({ length: 70 }, (_, k) => {
        const x = W * 0.08 + ((k * 0.6180339) % 1) * W * 0.6;
        const y = H * 0.12 + ((k * 0.4142) % 1) * H * 0.55;
        const r = H * (0.03 + ((k * 0.73) % 1) * 0.1);
        return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="none" stroke="white" stroke-opacity=".05" stroke-width="1.2"/>`;
      }).join('')
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="v" cx=".42" cy=".38" r=".85"><stop offset="0" stop-color="${dull ? '#1d1f22' : '#15181c'}"/><stop offset=".6" stop-color="${dull ? '#101113' : '#07080a'}"/><stop offset="1" stop-color="#010102"/></radialGradient>
    <filter id="b0" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${H * 0.004}"/></filter>
    <filter id="b1" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${H * 0.045}"/></filter>
    <filter id="b2" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="${H * 0.09}"/></filter>
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 ${dull ? 0.07 : 0.025} 0"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#v)"/>
  ${streak}${swirls}
  <rect width="${W}" height="${H}" filter="url(#n)"/>
  ${dull ? `<rect width="${W}" height="${H}" fill="#9a958c" opacity=".06"/>` : ''}
</svg>`;
}
