/**
 * Quote math + lead payload helpers. Pure (no DOM) so it can be unit-tested.
 */
import { brand, type BrandConfig } from '../config/brand';

export interface QuoteSelection {
  size: number;
  packageId: string;
  addons: string[];
}

export interface LeadDetails {
  name: string;
  phone: string;
  zip: string;
  vehicle: string;
  date: string;
  window: string;
  notes: string;
}

type Data = Pick<BrandConfig, 'PACKAGES' | 'ADDONS' | 'VEHICLE_SIZES'>;

const clampSize = (size: number, data: Data): number =>
  Math.min(Math.max(0, Math.floor(Number.isFinite(size) ? size : 0)), data.VEHICLE_SIZES.length - 1);

/** Price of one package at a size index (0 for unknown packages). */
export function packagePrice(packageId: string, size: number, data: Data = brand): number {
  const pkg = data.PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return 0;
  const i = clampSize(size, data);
  return pkg.prices[i] ?? pkg.prices[pkg.prices.length - 1] ?? 0;
}

/** Sum of add-ons (unknown ids and duplicates ignored). */
export function addonsTotal(addonIds: string[], data: Data = brand): number {
  return [...new Set(addonIds)].reduce((sum, id) => sum + (data.ADDONS.find((a) => a.id === id)?.price ?? 0), 0);
}

/** Starting-point estimate for a size / package / add-ons combo. */
export function estimate(size: number, packageId: string, addonIds: string[] = [], data: Data = brand): number {
  return packagePrice(packageId, size, data) + addonsTotal(addonIds, data);
}

export const formatPrice = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

/** Light US phone formatting while typing: (301) 555-0123. */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').replace(/^1(?=\d{10})/, '').slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export const phoneLooksValid = (raw: string): boolean => raw.replace(/\D/g, '').length >= 10;

function names(sel: QuoteSelection, data: Data) {
  const pkg = data.PACKAGES.find((p) => p.id === sel.packageId);
  const size = data.VEHICLE_SIZES[clampSize(sel.size, data)];
  const addons = [...new Set(sel.addons)]
    .map((id) => data.ADDONS.find((a) => a.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  return { pkgName: pkg?.name ?? sel.packageId, size, addons };
}

/** UTM params from a query string. */
export function utmParams(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  new URLSearchParams(search).forEach((v, k) => {
    if (k.toLowerCase().startsWith('utm_') && v) out[k.toLowerCase()] = v;
  });
  return out;
}

/** JSON body for LEAD_WEBHOOK_URL. */
export function leadPayload(
  sel: QuoteSelection,
  details: LeadDetails,
  ctx: { pageUrl: string; search: string; now?: Date },
  data: Data & { BRAND_NAME?: string } = brand,
) {
  const n = names(sel, data);
  return {
    source: 'website' as const,
    brand: data.BRAND_NAME ?? brand.BRAND_NAME,
    package: n.pkgName,
    package_id: sel.packageId,
    size: n.size,
    addons: n.addons,
    estimate: estimate(sel.size, sel.packageId, sel.addons, data),
    name: details.name.trim(),
    phone: details.phone.trim(),
    zip: details.zip.trim(),
    vehicle: details.vehicle.trim(),
    date: details.date,
    window: details.window,
    notes: details.notes.trim(),
    page_url: ctx.pageUrl,
    ...utmParams(ctx.search),
    submitted_at: (ctx.now ?? new Date()).toISOString(),
  };
}

/** Plain-text summary for the SMS / email fallback. */
export function leadSummary(sel: QuoteSelection, details: LeadDetails, data: Data = brand): string {
  const n = names(sel, data);
  const lines = [
    `Hi! I'd like a quote.`,
    `Package: ${n.pkgName} (${n.size})`,
    n.addons.length ? `Add-ons: ${n.addons.join(', ')}` : '',
    `Estimate: ${formatPrice(estimate(sel.size, sel.packageId, sel.addons, data))}`,
    details.name.trim() ? `Name: ${details.name.trim()}` : '',
    details.phone.trim() ? `Phone: ${details.phone.trim()}` : '',
    details.vehicle.trim() ? `Vehicle: ${details.vehicle.trim()}` : '',
    details.zip.trim() ? `Location: ${details.zip.trim()}` : '',
    details.date || details.window ? `When: ${[details.date, details.window].filter(Boolean).join(' · ')}` : '',
    details.notes.trim() ? `Notes: ${details.notes.trim()}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}
