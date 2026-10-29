# Detail Theater

A cinematic, scroll-scrubbed marketing site template for mobile car detailers. Built by Lee Enterprises Unlimited.

Scrolling the hero scrubs an AI-generated video of one car being detailed, frame by frame, with glass overlays narrating each step. After the theater: a drag before/after, the Bead Lab (interactive ceramic-coating water demo), packages with a live quote builder, reviews, service area, FAQ and a booking footer.

Stack: Astro 7 (static) · TypeScript strict · vanilla CSS tokens · GSAP + ScrollTrigger · Lenis · sharp + ffmpeg-static (Node scripts, Windows-friendly).

## Requirements

- **Node 22.22 or newer** (Astro 7's minimum). Check with `node -v`.
- That's it — ffmpeg and image tools come from npm, no system installs.

```bash
npm install
npm run dev
```

Open http://localhost:4321.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server with hot reload |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run build:fast` | Build without the type-check |
| `npm run preview` | Serve the built `dist/` |
| `npm run shotlist` | Write `HIGGSFIELD_SHOTLIST.md` with this client's values filled in |
| `npm run sequence:placeholder` | Generate labeled placeholder frames + stills (use before real assets exist) |
| `npm run sequence` | Real clips in `assets-src/` → frames + `public/seq/manifest.json` |
| `npm run stills` | Keyframes + extras → optimized stills, `og.jpg`, favicon, footer loop |
| `npm run test:unit` | Quote estimate math tests |
| `npm run test:visual` | Playwright screenshots of the theater + full page (desktop + mobile) → `tests/screenshots/` |

## New client in 5 steps

1. Copy this repo.
2. Edit **`src/config/brand.ts`** — name, phone, towns, colors, prices, vehicle, etc. Anything left in `[brackets]` shows on the site as a visible placeholder. Leave reviews/ratings/badges empty unless they're real; empty sections hide themselves.
3. `npm run shotlist` → generate the assets in the Higgsfield web app following `HIGGSFIELD_SHOTLIST.md` (or reuse an existing asset set — the footage has no logos or text).
4. Drop files into `assets-src/` with the exact names from the shotlist, then:
   ```bash
   npm run sequence && npm run stills && npm run build
   ```
5. Deploy (below).

Template copy (headlines, FAQ wording, microcopy) lives in `src/config/copy.ts`. Theater chapters, step copy and focal points live in `src/config/chapters.ts`.

## Asset pipeline

```
assets-src/
  desktop/keyframes/KF00.png … KF14.png   (15, 16:9)
  desktop/clips/S01.mp4 … S13.mp4          (13)
  mobile/keyframes/ + mobile/clips/        (optional 9:16 set, same names)
  extras/BA-CLEAN.png PAINT-MACRO.png PAINT-MACRO-DULL.png DETAILER-REF.png [LOOP.mp4]
  segments.json                            (per-segment frame counts + tuning)
```

`assets-src/**` media is git-ignored (large). The built output in `public/seq/` and `public/stills/` **is** committed.

### Tuning a segment (`assets-src/segments.json`)

| Key | Use |
|---|---|
| `frames` | Frames sampled from the clip. More = smoother scrub, bigger payload |
| `trimStart` / `trimEnd` | Seconds to cut off a clip's start/end |
| `reverse` | `true` for clips generated backwards (the push-in "reverse trick") |
| `speedCurve` | `linear` · `easeIn` · `easeOut` · `easeInOut` — remaps which source frames get sampled |
| `eq` | `{ "brightness": 0.03, "contrast": 1.05, "saturation": 1.1, "gamma": 1 }` to match a clip that drifts in color |
| `crop` | `{ "x": 0, "y": 40, "w": 1920, "h": 1000 }` in source pixels |
| `mobileFocal` | Where the derived 9:16 phone crop sits (0–1 across the frame). A list like `[0.7, 0.55, 0.45]` pans the crop through those points over the clip. Only used when there are no real mobile clips and the mobile set has `"derive": true` |
| `transitionOut` | `"flash"` = light-bloom cut into the next segment (used for exterior ↔ interior jumps) |

Desktop and mobile sets always get identical frame counts so they share one scroll timeline. The script warns if desktop > 30MB or mobile > 15MB.

Other knobs: `theaterTuning` in `src/config/chapters.ts` (section height, smoothing, autoplay speed) and each chapter's `focal` point (where to crop when frames are cover-fit on a different aspect ratio).

### Cache busting

Frames and stills are served with year-long immutable caching. Every `npm run sequence` / `npm run stills` writes to a new versioned folder (`/seq/<build>/…`, `/stills/<version>/…`) and deletes the old one, so browsers never see stale frames. `manifest.json` itself is never cached.

## Lead capture

The quote drawer posts JSON to `LEAD_WEBHOOK_URL` (n8n, Zapier, a CRM…) when set. Without it — or if the webhook fails — it opens the visitor's text app (phones) or email app (desktop) with the quote prefilled. `BOOKING_URL` adds a calendar link on the confirmation step. Analytics events are stubbed in `src/lib/analytics.ts`; wire them to Vercel Analytics or GA there.

## Deploy (Vercel)

```bash
npx vercel          # preview deployment
npx vercel --prod   # production — only after the client signs off
```

Framework preset: Astro, output static. `vercel.json` sets cache headers and clean URLs. Set `DOMAIN` in `brand.ts` before going live (canonical URLs, sitemap and OG tags use it).

If the repo grows past Git/Vercel limits, move `public/seq/` to Vercel Blob and change the `path` values in `public/seq/manifest.json` to the Blob URLs (the frame loader uses `path` as a prefix, so absolute URLs work).

## Accessibility & motion

- `prefers-reduced-motion` (and no-JS) turns the theater into a vertical list of stills with the same copy; no autoplay, marquee, sweep or tilt.
- All narration is real DOM text. HUD stages are buttons ("Jump to step 5: Iron decontamination").
- Skip link to packages, focus-trapped quote drawer, Esc closes overlays.
