/**
 * Template copy shared by every client build. Brand-specific values are pulled
 * from brand.ts — edit wording here, edit facts there.
 */
import { brand, withArticle, isPlaceholder } from './brand';

const firstTown = brand.SERVICE_TOWNS[0] ?? brand.PRIMARY_CITY;

export const copy = {
  meta: {
    title: `${brand.BRAND_NAME} | Mobile Car Detailing in ${brand.PRIMARY_CITY}`,
    description: `Mobile car detailing that comes to your driveway in ${brand.SERVICE_TOWNS.slice(0, 3).join(', ')} and across ${brand.PRIMARY_CITY}. Hand washes, interior detailing and ceramic coatings.`.slice(
      0,
      158,
    ),
  },

  loader: { label: 'Prepping the bay' },

  nav: {
    links: [
      { href: '#packages', label: 'Packages' },
      { href: '#ceramic', label: 'Ceramic' },
      { href: '#reviews', label: 'Reviews', reviews: true },
    ],
    cta: 'Book a detail',
    ctaShort: 'Book',
  },

  hero: {
    eyebrow: `Mobile detailing · ${brand.SERVICE_AREA_SHORT}`,
    line1: 'Grime in.',
    line2: 'Glass out.',
    srOnly: `Mobile car detailing in ${brand.PRIMARY_CITY}`,
    body: `Concierge detailing that pulls into your driveway. Keep scrolling and watch ${withArticle(brand.VEHICLE_SHORT)} go from road-tired to showroom, one step at a time.`,
    watch: 'Watch the detail',
    stop: 'Stop',
    book: 'Book a detail',
    scroll: 'Scroll',
  },

  hud: { gloss: 'Gloss %', stages: 'Stages' },

  outro: {
    eyebrow: 'Gloss 100% · Done in your driveway',
    line1: 'The showroom',
    line2: 'came to you.',
    cta: 'Build my quote',
    link: 'Drag the before & after ↓',
  },

  beforeAfter: {
    eyebrow: 'Same car · Same driveway',
    line1: 'See the',
    line2: 'difference.',
    tabs: [
      { id: 'exterior', label: 'Exterior', before: 'KF00', after: 'BA-CLEAN', pos: '58% 55%' },
      { id: 'wheels', label: 'Wheels', before: 'KF05', after: 'KF07', pos: '50% 50%' },
      { id: 'interior', label: 'Interior', before: 'KF09', after: 'KF11', pos: '45% 50%' },
    ],
    before: 'Before',
    after: 'After',
    hint: 'Drag to compare',
  },

  beadLab: {
    eyebrow: 'The Bead Lab · Try it',
    line1: 'Rain',
    line2: 'rolls off.',
    body: 'Drag across the paint to make it rain. A ceramic coating bonds a hard, glass-like layer to your clear coat, so water beads up and rolls away, taking the dirt with it.',
    coated: 'Ceramic coated',
    unprotected: 'Unprotected',
    stats: [
      { key: 'contact_angle', label: 'Contact angle' },
      { key: 'protection', label: 'Protection' },
      { key: 'hardness', label: 'Hardness' },
    ] as const,
    caption: 'Drag or hold to rain · Watch it bead',
    rain: 'Make it rain',
    srDescription:
      'Interactive demo: a close-up of glossy black car paint. Dragging across it adds water drops. In ceramic-coated mode the drops form round beads, merge and roll off. In unprotected mode they spread into flat puddles that stick and dry into water spots.',
  },

  whyUs: {
    eyebrow: 'Why us',
    line1: 'Detailing,',
    line2: 'delivered.',
    tiles: [
      { title: 'We come to you', body: 'Driveway, office, apartment lot. You keep your day.' },
      { title: 'Booked in 60 seconds', body: 'Build a quote, we confirm it by text.' },
      { title: 'Paint-safe process', body: 'The steps above. No automatic brushes, ever.' },
      { title: 'Protection that lasts', body: 'Sealants and coatings that keep it beading.' },
    ],
  },

  packages: {
    eyebrow: 'Packages',
    line1: 'Pick your',
    line2: 'finish.',
    cta: 'Build this quote',
    fine: 'Prices are starting points. Final price is confirmed after a quick look at your vehicle (heavy pet hair, sap or stains may add time).',
  },

  quote: {
    title: 'Build your quote',
    steps: ['Build', 'Details', 'Sent'],
    size: 'Vehicle size',
    package: 'Package',
    addons: 'Add-ons',
    estimate: 'Estimate',
    next: 'Next: your details',
    back: 'Back',
    submit: 'Send my quote',
    sending: 'Sending…',
    consent: 'By submitting you agree to be contacted about your quote by call or text.',
    fields: {
      name: 'Name',
      phone: 'Mobile phone',
      zip: 'ZIP or address',
      vehicle: 'Vehicle (year / make / model)',
      date: 'Preferred date',
      window: 'Time window',
      notes: 'Notes',
    },
    windows: ['Morning', 'Midday', 'Afternoon'],
    sentTitle: 'Got it.',
    sentBody: `${brand.OWNER_FIRST_NAME} will text you shortly to confirm.`,
    sentFallback: 'Your text/email app opened with your quote, just hit send.',
    textNow: 'Text us now',
    calendar: 'Pick a time on our calendar ↗',
    close: 'Close',
  },

  reviews: {
    eyebrow: 'Reviews',
    line1: 'Straight from',
    line2: 'the driveway.',
    fallback: `Read what ${isPlaceholder(firstTown) ? firstTown : firstTown.toUpperCase()} says about us`,
    fallbackCta: 'See our Google reviews ↗',
  },

  area: {
    eyebrow: `Service area · ${brand.PRIMARY_CITY}`,
    line1: 'We pull up',
    line2: 'to you.',
    body: 'Fully mobile. We bring the setup and work wherever the car is parked.',
    notListed: 'Not listed? Text us →',
  },

  faq: {
    eyebrow: 'FAQ',
    line1: 'Good',
    line2: 'questions.',
    items: [
      {
        q: 'Do you need my water or power?',
        a: brand.TRUST_BADGES.own_water_and_power
          ? 'No. We bring our own water and power, so all we need is room to park next to your car.'
          : 'Usually we need access to an outdoor water spigot and a standard outlet. Let us know when you book if that is tricky and we will work it out.',
      },
      {
        q: 'How long does it take?',
        a: `It depends on the package: ${brand.PACKAGES.map((p) => `${p.name} takes about ${p.duration}`).join(', ')}. Heavily soiled vehicles can take longer.`,
      },
      {
        q: 'What if it rains?',
        a: 'We watch the forecast and will text you to reschedule at no charge if the weather turns. Covered spots like a garage or carport usually work fine.',
      },
      {
        q: 'Do I need to be home?',
        a: 'Not for the whole detail. We just need access to the vehicle (and keys for interior work) at the start, and we will text you when it is done.',
      },
      {
        q: 'How do I pay?',
        a: 'You pay when the job is done and you are happy with it. We will confirm accepted payment methods when we confirm your booking.',
      },
      {
        q: 'How long does a ceramic coating last?',
        a: `With basic care, a ceramic coating offers protection of ${brand.CERAMIC_STATS.coated.protection.toLowerCase()} and keeps water beading at a contact angle of ${brand.CERAMIC_STATS.coated.contact_angle}. A spray sealant lasts around 3 months.`,
      },
      {
        q: 'Do you do fleets, RVs or boats?',
        a: 'Ask us. Text a photo and a few details and we will tell you what we can do and what it costs.',
      },
    ],
  },

  finalCta: {
    line1: 'Your driveway.',
    line2: 'Our showroom.',
    quote: 'Build my quote',
    call: 'Call',
    text: 'Text',
    smsBody: "Hi! I'd like a quote for my [vehicle]",
  },

  footer: {
    hours: 'Hours',
    area: 'Service area',
    contact: 'Contact',
    social: 'Follow',
    privacy: 'Privacy',
  },

  actionBar: { call: 'Call', text: 'Text', quote: 'Quote' },

};
