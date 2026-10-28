/**
 * BRAND BLOCK — the single source of truth for one client.
 *
 * Swapping clients = edit this file (+ optional new assets in assets-src/).
 * Anything still in [brackets] is a visible placeholder Hunter must fill.
 * NEVER invent reviews, ratings, badges or specs: leave them empty and the
 * site hides them (or shows a neutral fallback).
 */

export interface Review {
  name: string;
  text: string;
  source: string;
  stars: number;
}

export interface Package {
  id: string;
  name: string;
  blurb: string;
  /** One price per entry in VEHICLE_SIZES, same order. */
  prices: number[];
  duration: string;
  featured?: boolean;
  badge?: string;
  includes: string[];
}

export interface Addon {
  id: string;
  name: string;
  price: number;
}

export interface CeramicStat {
  contact_angle: string;
  protection: string;
  hardness: string;
}

export interface BrandConfig {
  // ── IDENTITY
  BRAND_NAME: string;
  BRAND_SHORT: string;
  TAGLINE: string;
  OWNER_FIRST_NAME: string;
  /** Path under /public (e.g. "/logo.svg"). Blank = auto mark. */
  LOGO_FILE: string;
  DOMAIN: string;

  // ── CONTACT
  PHONE_DISPLAY: string;
  PHONE_E164: string;
  SMS_ENABLED: boolean;
  EMAIL: string;
  HOURS: string;
  BOOKING_URL: string;
  LEAD_WEBHOOK_URL: string;

  // ── LOCATION
  PRIMARY_CITY: string;
  SERVICE_AREA_SHORT: string;
  SERVICE_TOWNS: string[];

  // ── SOCIAL PROOF
  GOOGLE_REVIEWS_URL: string;
  GOOGLE_RATING: string;
  GOOGLE_REVIEW_COUNT: string;
  REVIEWS: Review[];
  INSTAGRAM_URL: string;
  FACEBOOK_URL: string;
  TIKTOK_URL: string;
  TRUST_BADGES: {
    fully_insured: boolean;
    own_water_and_power: boolean;
    satisfaction_guarantee: boolean;
    certified_coating_installer: boolean;
  };

  // ── LOOK & FEEL
  COLOR_BG: string;
  COLOR_ACCENT: string;
  COLOR_HIGHLIGHT: string;
  FONT_DISPLAY: string;
  FONT_BODY: string;
  FONT_MONO: string;

  // ── ON-CAMERA (drives the Higgsfield prompts)
  VEHICLE: string;
  VEHICLE_SHORT: string;
  INTERIOR: string;
  SCENE: string;
  DETAILER_LOOK: string;

  // ── PACKAGES
  VEHICLE_SIZES: string[];
  PACKAGES: Package[];
  ADDONS: Addon[];

  // ── CERAMIC "BEAD LAB" STATS
  CERAMIC_STATS: { coated: CeramicStat; unprotected: CeramicStat };

  // ── FOOTER CREDIT
  CREDIT_TEXT: string;
  CREDIT_URL: string;
}

export const brand: BrandConfig = {
  // ── IDENTITY ───────────────────────────────────────────────
  BRAND_NAME: '[Business Name]',
  BRAND_SHORT: '[BN]',
  TAGLINE: 'Mobile detailing · Paint protection',
  OWNER_FIRST_NAME: '[Owner first name]',
  LOGO_FILE: '',
  DOMAIN: '[clientdomain.com]',

  // ── CONTACT ────────────────────────────────────────────────
  PHONE_DISPLAY: '[(301) 555-0123]',
  PHONE_E164: '[+13015550123]',
  SMS_ENABLED: true,
  EMAIL: '[hello@clientdomain.com]',
  HOURS: 'Mon–Sat · 8am–6pm',
  BOOKING_URL: '',
  LEAD_WEBHOOK_URL: '',

  // ── LOCATION ───────────────────────────────────────────────
  PRIMARY_CITY: '[City, ST]',
  SERVICE_AREA_SHORT: '[TOWN A & TOWN B]',
  SERVICE_TOWNS: ['[Town 1]', '[Town 2]', '[Town 3]', '[Town 4]', '[Town 5]'],

  // ── SOCIAL PROOF (never invent any of this) ───────────────
  GOOGLE_REVIEWS_URL: '',
  GOOGLE_RATING: '',
  GOOGLE_REVIEW_COUNT: '',
  REVIEWS: [],
  INSTAGRAM_URL: '',
  FACEBOOK_URL: '',
  TIKTOK_URL: '',
  TRUST_BADGES: {
    fully_insured: false,
    own_water_and_power: false,
    satisfaction_guarantee: false,
    certified_coating_installer: false,
  },

  // ── LOOK & FEEL ────────────────────────────────────────────
  COLOR_BG: '#060809',
  COLOR_ACCENT: '#62F0D8',
  COLOR_HIGHLIGHT: '#FFC94A',
  FONT_DISPLAY: 'Unbounded',
  FONT_BODY: 'Manrope',
  FONT_MONO: 'JetBrains Mono',

  // ── ON-CAMERA ──────────────────────────────────────────────
  VEHICLE: 'midnight-blue metallic 2025 Mercedes-Benz E-Class sedan',
  VEHICLE_SHORT: 'E-Class',
  INTERIOR: 'black Nappa leather seats, open-pore dark walnut trim, slim ambient light strips',
  SCENE:
    'modern farmhouse with white board-and-batten siding, black steel window frames, warm cedar entry door, wide light-grey concrete driveway, ornamental grasses and boxwoods, mature oak trees, quiet Maryland suburb',
  DETAILER_LOOK:
    'man in his late 20s, short dark hair, clean-shaven, athletic build, plain black crew-neck t-shirt, black work pants, black sneakers, black nitrile gloves',

  // ── PACKAGES (EXAMPLE prices — confirm with client before launch) ──
  VEHICLE_SIZES: ['Sedan / Coupe', 'SUV / Crossover', 'Truck / 3-Row'],
  PACKAGES: [
    {
      id: 'maintenance',
      name: 'Maintenance Wash',
      blurb: 'Keeps a clean car clean. Every 2–4 weeks.',
      prices: [89, 109, 129],
      duration: '1–1.5 hrs',
      includes: [
        'Snow foam pre-wash',
        'Two-bucket hand wash',
        'Wheels + tires',
        'Spot-free dry',
        'Interior vacuum + wipe-down',
        'Glass inside & out',
      ],
    },
    {
      id: 'signature',
      name: 'Signature Detail',
      blurb: 'The full treatment from the scroll above.',
      prices: [249, 289, 329],
      duration: '3–4 hrs',
      featured: true,
      badge: 'Most booked',
      includes: [
        'Everything in Maintenance',
        'Iron decontamination',
        'Clay on request',
        'Deep vacuum + seat rails',
        'Leather clean + condition',
        'Trim + tire dressing',
        'Spray sealant (≈3 months)',
      ],
    },
    {
      id: 'ceramic',
      name: 'Ceramic Shield',
      blurb: 'Signature Detail + a ceramic coating that keeps beading for years.',
      prices: [699, 799, 899],
      duration: '1 day',
      includes: [
        'Everything in Signature',
        'Single-stage polish',
        'Ceramic coating',
        'Coated wheels faces',
        'Maintenance plan option',
      ],
    },
  ],
  ADDONS: [
    { id: 'pet_hair', name: 'Pet hair removal', price: 40 },
    { id: 'engine_bay', name: 'Engine bay detail', price: 45 },
    { id: 'headlights', name: 'Headlight restoration', price: 79 },
    { id: 'odor', name: 'Odor treatment', price: 59 },
    { id: 'shampoo', name: 'Carpet + seat shampoo', price: 69 },
  ],

  // ── CERAMIC "BEAD LAB" STATS (confirm against the client's coating spec sheet) ──
  CERAMIC_STATS: {
    coated: { contact_angle: '110°+', protection: 'Up to 5 yrs', hardness: '9H' },
    unprotected: { contact_angle: '≈70°', protection: 'Weeks', hardness: '—' },
  },

  // ── FOOTER CREDIT ──────────────────────────────────────────
  CREDIT_TEXT: 'Site by Lee Enterprises Unlimited',
  CREDIT_URL: 'https://leeenterprisesunlimited.com',
};

// ── Derived helpers (no brand data below this line) ──────────────────────

/** True while a value is still a `[bracket]` placeholder. */
export const isPlaceholder = (v: string): boolean => /\[[^\]]*\]/.test(v);

/** Digits-only phone for tel:/sms: links. */
export const phoneDigits = brand.PHONE_E164.replace(/[^\d+]/g, '');
export const telHref = `tel:${phoneDigits}`;
export const smsHref = (body = ''): string =>
  `sms:${phoneDigits}${body ? `?&body=${encodeURIComponent(body)}` : ''}`;
export const mailHref = (subject = '', body = ''): string => {
  const q = new URLSearchParams();
  if (subject) q.set('subject', subject);
  if (body) q.set('body', body);
  const qs = q.toString().replace(/\+/g, '%20');
  return `mailto:${brand.EMAIL.replace(/[[\]]/g, '')}${qs ? `?${qs}` : ''}`;
};

/** Canonical site URL. Falls back to example.com while DOMAIN is a placeholder. */
export const siteUrl = isPlaceholder(brand.DOMAIN)
  ? 'https://example.com'
  : `https://${brand.DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;

/** "a E-Class" → "an E-Class". */
export const withArticle = (noun: string): string =>
  `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;

export const socials = [
  { id: 'instagram', label: 'Instagram', url: brand.INSTAGRAM_URL },
  { id: 'facebook', label: 'Facebook', url: brand.FACEBOOK_URL },
  { id: 'tiktok', label: 'TikTok', url: brand.TIKTOK_URL },
].filter((s) => s.url);

export const hasRating = Boolean(brand.GOOGLE_RATING && brand.GOOGLE_REVIEW_COUNT);
export const showReviews = brand.REVIEWS.length > 0 || Boolean(brand.GOOGLE_REVIEWS_URL);

export const TRUST_BADGE_LABELS: Record<keyof BrandConfig['TRUST_BADGES'], string> = {
  fully_insured: 'Fully insured',
  own_water_and_power: 'Own water + power',
  satisfaction_guarantee: 'Satisfaction guarantee',
  certified_coating_installer: 'Certified coating installer',
};

export const activeBadges = (
  Object.keys(brand.TRUST_BADGES) as (keyof BrandConfig['TRUST_BADGES'])[]
)
  .filter((k) => brand.TRUST_BADGES[k])
  .map((k) => TRUST_BADGE_LABELS[k]);

/** First word / rest of the brand name, for the 800/300 wordmark split. */
export const nameParts = (() => {
  const [first = '', ...rest] = brand.BRAND_NAME.split(' ');
  return { first, rest: rest.join(' ') };
})();
