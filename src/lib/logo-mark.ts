/**
 * Auto logo mark (used when brand.LOGO_FILE is blank): a water droplet inside a
 * rounded rotated square, droplet right half filled with the accent, left half
 * outlined — a "mirror" split. Pure string so build scripts can reuse it.
 */
export function logoMarkSvg(accent: string, opts: { id?: string; size?: number; bg?: string } = {}): string {
  const id = opts.id ?? 'lm';
  const size = opts.size ?? 48;
  const drop = 'M24 12.5C24 12.5 16 21.6 16 27.6A8 8 0 0 0 32 27.6C32 21.6 24 12.5 24 12.5Z';
  const bg = opts.bg ? `<rect width="48" height="48" rx="11" fill="${opts.bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">${bg}<defs><clipPath id="${id}-r"><rect x="24" y="0" width="24" height="48"/></clipPath></defs><rect x="10" y="10" width="28" height="28" rx="7.5" transform="rotate(45 24 24)" fill="none" stroke="${accent}" stroke-width="1.6" opacity=".55"/><path d="${drop}" fill="none" stroke="${accent}" stroke-width="1.6" stroke-linejoin="round"/><path d="${drop}" fill="${accent}" clip-path="url(#${id}-r)"/><path d="M24 12.5V35.6" stroke="${accent}" stroke-width="1.6"/></svg>`;
}
