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
