/**
 * Build-time access to the generated frame manifest and stills index.
 * (Server only — reads files from /public.)
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Manifest } from './frames';

const pub = (p: string) => path.join(process.cwd(), 'public', p);

export interface StillsIndex {
  version: string;
  path: string;
  placeholders: string[];
  crops: string[];
  loop: boolean;
}

export const manifest: Manifest = JSON.parse(readFileSync(pub('seq/manifest.json'), 'utf8'));
export const stills: StillsIndex = JSON.parse(readFileSync(pub('stills/stills.json'), 'utf8'));

export const posterUrl = (set: 'desktop' | 'mobile'): string | null => {
  const s = manifest.sets[set];
  return s ? `${s.path}poster.webp` : null;
};

export const still = (name: string, w: 1920 | 960 | 'm', fmt: 'webp' | 'avif' = 'webp'): string =>
  `${stills.path}${name}-${w}.${fmt}`;

export const hasCrop = (name: string): boolean => stills.crops.includes(name);
