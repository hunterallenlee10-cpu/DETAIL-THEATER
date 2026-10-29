# DECISIONS

Running log of judgment calls made while building the Detail Theater template.

## Hunter must fill (before launch)

Everything below is still a `[bracket]` placeholder or an unconfirmed default in `src/config/brand.ts`:

- [ ] `BRAND_NAME`, `BRAND_SHORT`, `OWNER_FIRST_NAME`
- [ ] `DOMAIN` (until set, canonical/OG/sitemap URLs use `https://example.com`)
- [ ] `PHONE_DISPLAY`, `PHONE_E164`, `EMAIL`
- [ ] `PRIMARY_CITY`, `SERVICE_AREA_SHORT`, `SERVICE_TOWNS`
- [ ] `HOURS` (default "Mon–Sat · 8am–6pm" — confirm)
- [ ] **Package prices + add-on prices** are EXAMPLE numbers from the template — confirm with the client
- [ ] `CERAMIC_STATS` — confirm against the client's actual coating spec sheet
- [ ] `TRUST_BADGES` — all `false`; set `true` only for what the client confirms
- [ ] `REVIEWS`, `GOOGLE_RATING`, `GOOGLE_REVIEW_COUNT`, `GOOGLE_REVIEWS_URL` — empty, so the Reviews section and its nav link are hidden
- [ ] Socials (`INSTAGRAM_URL`, `FACEBOOK_URL`, `TIKTOK_URL`) — empty, hidden
- [ ] `LEAD_WEBHOOK_URL` (optional) — empty, so quotes go out via the SMS/email fallback
- [ ] `BOOKING_URL` (optional)
- [ ] FAQ answers flagged for confirmation (in `src/config/copy.ts`):
  - "Do you do fleets, RVs or boats?" — neutral placeholder answer ("Ask us…")
  - "How do I pay?" — says payment methods are confirmed at booking
  - "What if it rains?" — says free reschedule; confirm this is the client's policy
  - "Do I need to be home?" — confirm
- [ ] Privacy page copy (`src/pages/privacy.astro`) — generic; have the client review

## Architecture

- **Node ≥ 22.22 is required** (Astro 7's minimum). Added `.nvmrc`. On Windows install the current Node 22 LTS or newer.
- **Scripts run through `tsx`** so they can import `src/config/brand.ts` directly (one source of truth, works on Windows without flags).
- **Copy split:** brand facts live in `brand.ts`; reusable template copy (headlines, FAQ wording, microcopy) lives in `src/config/copy.ts`, which pulls brand values in. Components contain no copy. Swapping clients only needs `brand.ts`; `copy.ts` is for changing the template's voice.
- **Brand colors/fonts are injected** as `--brand-*` CSS variables in `layouts/Base.astro` from `brand.ts`; `tokens.css` derives everything else from them.
- **Fonts:** self-hosted variable WOFF2 (Latin subset only) via `@fontsource-variable/*`, declared manually in `Base.astro` so only Latin is shipped. Display font is preloaded.
- **Text in generated images** (OG image, placeholder frames) is converted to vector paths with `opentype.js` from the static `@fontsource/*` WOFF files. This makes it look identical on Windows/Mac/Linux without relying on system fonts or fontconfig.
- **Placeholder frames are committed** (small, ~5–10KB each) so a fresh clone or a Vercel build works with zero setup. Real frames overwrite them in place.
- **Raw Higgsfield files (`assets-src/**`) are git-ignored** (they're large). Built frames in `public/seq` and stills in `public/stills` are committed.
- **Shotlist `[EDIT LOCK — except …]` prompts** are written out already trimmed (without "time of day, lighting") so Hunter can paste them directly.

## Theater engine

- **Manifest is embedded** in the page at build time (`<script type="application/json" id="seq-manifest">`) instead of fetched, saving a round trip. `public/seq/manifest.json` is still written and is the source of truth.
- **Versioned frame folders:** `/seq/<build>/desktop/…` and `/stills/<version>/…`. Every rebuild writes a new folder and deletes the old one, so the year-long `immutable` cache headers in `vercel.json` can never serve stale frames.
- **"Frames" in `segments.json` = frames sampled.** A segment that continues the previous one (same keyframe at the seam) drops its first sample, so the default set is 284 frames with flash cuts at frames 169 and 212, matching the spec.
- **Gold moment = outro moment.** The spec says both "gold at p ≥ 0.985" and "turns gold exactly as the outro appears". The outro starts at 55% of S13 (p ≈ 0.955), so the gloss number reaches 100 and turns gold exactly when the outro starts appearing. This is tied to the frame math, not a hardcoded p.
- **Flash peak** is centered on the instant the displayed frame switches across the cut (frame `cut − 0.5`), so the bloom fully covers the hard change.
- **HUD jump** lands 22% into a chapter (`theaterTuning.jumpOffset`), where the step card is fully visible, rather than on the chapter's first frame (where the card is still invisible).
- **Autoplay duration** scales with the remaining distance (`segments × 2.2s × (1 − p)`), so pressing "Watch" mid-way doesn't crawl.
- **Mobile HUD sheet** lives inside the sticky stage. Opening it adds `html.hud-open`, which hides the mobile action bar so it can't cover the sheet.
- **Loader + LCP:** the hero paints immediately underneath the opaque loader (so Largest Contentful Paint isn't delayed by up to 2.5s). As the loader starts fading, the hero snaps to its hidden state and the mask reveal plays. Visually identical to "reveal after the loader", but Lighthouse mobile performance went from 79 → 98.
- **All three fonts are preloaded** (≈115KB total). Without that, the body font swapping in moved the bottom-anchored hero and caused a 0.095 layout shift.
- **`.hero-overlay` max-width:** the 640px cap from the spec forced "GLASS OUT." onto two lines at 1440px. The overlay now spans the gutter-limited width; the body copy keeps its 44ch measure.

## Sections

- **Before/After** renders all three pairs and toggles `hidden`, so switching tabs never shifts layout. The handle is a real `<input type="range">` (keyboard + screen-reader friendly) with `aria-valuetext`.
- **Bead Lab:** drop sizes scale with panel width (×1.0–1.45 from a 560px base) so beads read on large desktop panels; on phones the spec's exact sizes apply. Unprotected puddles merge at 1.15× radius (not their full 1.7× drawn size), otherwise everything collapses into a few giant blobs. Switching back to Ceramic wipes water spots and breaks big puddles into beads that roll off. The touch press-and-hold (120ms) behavior can't be simulated in Playwright — **check it on a real phone**.
- **Quote drawer** syncs the vehicle size with the Packages switch both ways (`<html data-vehicle-size>` + a `vehicle-size` event). The anti-spam minimum fill time is measured from opening step 2; too-fast submissions silently "succeed" without sending.
- **Reviews:** with no `REVIEWS` and no `GOOGLE_REVIEWS_URL` (the current state), the section and its nav link are not rendered at all.
- **JSON-LD `openingHours`** is parsed from the `HOURS` string ("Mon–Sat · 8am–6pm" → "Mo-Sa 08:00-18:00"); if the format can't be parsed, the raw string is used.
- **Service area route line** is decorative SVG drawn with a scrubbed ScrollTrigger (no map API).

## Tooling

- **Playwright web server** uses `scripts/serve-dist.mjs` (a 40-line static server) because Astro 7's `astro preview` detaches into the background in agent environments, which Playwright reads as "exited early".
- **Visual test screenshots** are per section, because a single full-page capture of a ~17,000px page exceeds Chrome's screenshot height limit.
