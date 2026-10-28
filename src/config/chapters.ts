/**
 * Detail Theater chapters. Frame ranges come from /seq/manifest.json at runtime,
 * so timing stays exact when real clips replace the placeholders.
 */
import { brand } from './brand';

export type Fx = 'bubbles' | null;

export interface Focal {
  x: number;
  y: number;
}

export interface Chapter {
  id: string;
  /** Segment ids that make up this chapter (must match assets-src/segments.json). */
  segments: string[];
  /** Short label in the HUD checklist. */
  hud: string;
  /** Long label for the HUD button's aria-label. */
  aria: string;
  /** Step number shown on the card (null = hero / outro chapter, no card). */
  step: number | null;
  title?: string;
  body?: string;
  chips?: string[];
  fx?: Fx;
  /** Crop focus (0–1) when frames are cover-cropped (e.g. desktop frames on a phone). */
  focal: Focal;
  /** Still used for the reduced-motion / no-JS fallback list. */
  still: string;
}

const WIDE: Focal = { x: 0.58, y: 0.55 };
const CLOSE: Focal = { x: 0.5, y: 0.5 };
const INTERIOR: Focal = { x: 0.45, y: 0.5 };

const ownWater = brand.TRUST_BADGES.own_water_and_power;

export const chapters: Chapter[] = [
  {
    id: 'arrival',
    segments: ['S01'],
    hud: 'Arrival',
    aria: 'Arrival',
    step: null,
    focal: WIDE,
    still: 'KF00',
  },
  {
    id: 'foam',
    segments: ['S02'],
    hud: 'Foam',
    aria: 'Snow foam',
    step: 1,
    title: 'Snow foam',
    body: 'A thick blanket of pH-neutral foam soaks in and loosens grit, so nothing gets dragged across your paint.',
    chips: ['pH-neutral', 'Dwell time', 'Touchless pre-wash'],
    fx: 'bubbles',
    focal: WIDE,
    still: 'KF02',
  },
  {
    id: 'wash',
    segments: ['S03'],
    hud: 'Wash',
    aria: 'Two-bucket wash',
    step: 2,
    title: 'Two-bucket wash',
    body: 'Clean mitt, clean water, every panel. Grit guards trap dirt at the bottom of the bucket instead of in your clear coat.',
    chips: ['Grit guards', 'Top-down', 'Soft mitts'],
    fx: 'bubbles',
    focal: WIDE,
    still: 'KF03',
  },
  {
    id: 'rinse',
    segments: ['S04'],
    hud: 'Rinse',
    aria: 'Spot-free rinse',
    step: 3,
    title: 'Spot-free rinse',
    body: 'Top to bottom with filtered water, so it dries clear instead of spotty.',
    chips: ['Filtered water', ownWater ? 'Our own water + power' : 'Top-down', 'No mineral spots'],
    focal: WIDE,
    still: 'KF04',
  },
  {
    id: 'wheels',
    segments: ['S05'],
    hud: 'Wheels',
    aria: 'Wheels, close up',
    step: 4,
    title: 'Wheels, close up',
    body: 'Brake dust bakes on hot. Wheels get their own tools, their own chemicals and their own bucket.',
    chips: ['Faces + barrels', 'Calipers', 'Lug nuts'],
    focal: CLOSE,
    still: 'KF05',
  },
  {
    id: 'iron',
    segments: ['S06', 'S07'],
    hud: 'Iron',
    aria: 'Iron decontamination',
    step: 5,
    title: 'Watch it bleed',
    body: "That purple is the chemical grabbing iron particles soap can't touch. Soft brushes reach every spoke, then it all rinses away.",
    chips: ['Fallout remover', 'Purple = working', 'Spoke brushes'],
    focal: CLOSE,
    still: 'KF06',
  },
  {
    id: 'dry',
    segments: ['S08'],
    hud: 'Dry',
    aria: 'Touch-safe dry',
    step: 6,
    title: 'Touch-safe dry',
    body: 'Forced air chases water out of mirrors and trim, then plush towels finish the job. No chamois, no swirls.',
    chips: ['Forced air', 'Plush towels', 'Clay on request'],
    focal: WIDE,
    still: 'KF08',
  },
  {
    id: 'vacuum',
    segments: ['S09'],
    hud: 'Vacuum',
    aria: 'The deep vacuum',
    step: 7,
    title: 'The deep vacuum',
    body: "Seat rails, seams, vents, under the mats. If a crumb can hide there, we've already been there.",
    chips: ['HEPA vac', 'Seat rails', 'Vents + seams'],
    focal: INTERIOR,
    still: 'KF09',
  },
  {
    id: 'leather',
    segments: ['S10'],
    hud: 'Leather',
    aria: 'Leather and touchpoints',
    step: 8,
    title: 'Leather + touchpoints',
    body: 'Wheel, shifter, door pulls and seats cleaned, then conditioned so it feels new, not greasy.',
    chips: ['pH-balanced care', 'Matte finish', 'UV guard'],
    focal: INTERIOR,
    still: 'KF11',
  },
  {
    id: 'glass',
    segments: ['S11'],
    hud: 'Glass',
    aria: 'Glass and trim',
    step: 9,
    title: 'Glass + trim',
    body: 'Streak-free glass inside and out, trim back to deep black, tires dressed satin, not wet-look.',
    chips: ['Streak-free', 'Trim restored', 'Satin tires'],
    focal: WIDE,
    still: 'KF12',
  },
  {
    id: 'protect',
    segments: ['S12'],
    hud: 'Protect',
    aria: 'Protect and inspect',
    step: 10,
    title: 'Protect + inspect',
    body: 'A slick protective layer goes down, then every panel gets checked under an inspection light before you get your keys back.',
    chips: ['Sealant layer', 'Inspection light', 'Keys back'],
    focal: WIDE,
    still: 'KF13',
  },
  {
    id: 'reveal',
    segments: ['S13'],
    hud: 'Reveal',
    aria: 'The reveal',
    step: null,
    focal: WIDE,
    still: 'KF14',
  },
];

export const stepCount = chapters.filter((c) => c.step !== null).length;

/** Theater tuning knobs. */
export const theaterTuning = {
  /** Total section height in vh. Default: 100 + segments × 85. */
  vh: (segments: number): number => 100 + segments * 85,
  /** Frame-smoothing factor per rAF (higher = snappier). */
  smoothing: 0.18,
  /** Seconds of autoplay per segment for "Watch the detail". */
  autoplayPerSegment: 2.2,
  /** Where a HUD jump lands inside a chapter (0 = first frame). 0.22 = card fully in. */
  jumpOffset: 0.22,
};
