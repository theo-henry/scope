# DESIGN.md — Scope

Visual and motion system for Scope. Feed this to v0 alongside `PRD.md`. It defines the
look, feel, and movement so v0 builds Scope's identity instead of a default template.

The reference feel: an editorial, near-monochrome interface with the calm authority of
The New York Times, modernized with restrained "AI" gradients and fluid, blur-up motion.
Color is removed from the brand entirely and reserved for one job only — the validity
signal. Everything else is black, white, and grey.

---

## 1. Design Principles

1. **Monochrome is the brand.** Ink, paper, and a grey scale carry the whole UI. The only
   chromatic color in the product is the validity signal (green / amber / red). If a
   surface is asking for color to look interesting, the layout or type is doing too little.
2. **Gradients are greyscale and quiet.** Keep the iridescent *aurora* technique from the
   reference, but render it in silver/charcoal — a brushed-metal or liquid-mercury sheen,
   never rainbow. Gradients are atmosphere, not decoration. They live behind content, never
   on top of text.
3. **Editorial whitespace.** Reading columns are narrow (~720px). Whitespace is generous and
   asymmetric. Density comes from typography, not from filling space.
4. **Motion is felt, not watched.** Elements arrive with a blur-up reveal and settle on a
   spring. Nothing bounces for attention. Scroll is smooth (Lenis). Animation never blocks
   reading.
5. **Type does the work.** One typeface (Switzer), tight negative tracking on display sizes,
   strong weight contrast. The headline is the hero of every screen.

---

## 2. Color System

Defined as CSS variables so v0 can drop them into `globals.css` and map them in
`tailwind.config`. Light mode is default; dark mode is a token swap.

```css
:root {
  /* Base */
  --paper:      #F4F5F7;   /* cool off-white app background (from reference #f0f2f6) */
  --surface:    #FFFFFF;   /* cards, nav, raised surfaces */
  --ink:        #0B0B0C;   /* near-black, primary text + dark surfaces */
  --graphite:   #2B2B2C;   /* secondary dark, dark-card base */

  /* Grey scale (text + lines) */
  --slate:      #606266;   /* body text on light */
  --mist:       #A5A7AD;   /* muted text, captions, icons */
  --hairline:   #E4E6EA;   /* borders, dividers (1px) */
  --hairline-2: #EDEEF1;   /* faint fills, hover wash */

  /* Validity signal — the ONLY chromatic color in the product */
  --valid-high: #1F8A52;   /* corroborated / high confidence */
  --valid-mid:  #B8841F;   /* mixed / medium */
  --valid-low:  #B23A48;   /* single-source / low */

  /* Optional single accent — OFF by default. Flip on only if a neutral UI needs one
     interactive hue. Keep it desaturated and cool, never a brand rainbow. */
  --accent:     #3A3F4A;   /* graphite-blue; defaults to behaving like ink */
}

.dark {
  --paper:      #0B0B0C;
  --surface:    #131315;
  --ink:        #F4F5F7;
  --graphite:   #E4E6EA;
  --slate:      #A5A7AD;
  --mist:       #6E7075;
  --hairline:   #232325;
  --hairline-2: #1B1B1D;
}
```

**Usage rules**
- Text: `--ink` for headlines/primary, `--slate` for body, `--mist` for captions/metadata.
- Backgrounds: `--paper` for the app, `--surface` for cards, `--ink`/`--graphite` for the
  dark "feature" cards that carry the silver aurora.
- Borders are 1px `--hairline`. Prefer a hairline over a shadow to separate surfaces.
- Validity colors appear only as a small pill, dot, or meter fill — never as a section
  background or large fill.

---

## 3. The Gradient System (signature element)

Three gradient types, all greyscale. These replace the reference's rainbow conic auroras.

**A. Silver aurora — for dark feature cards (the hero of the coverage view).**
A slow-rotating conic sheen on a near-black card. This is the "liquid mercury" look.

```css
.aurora {
  position: absolute; inset: -40%;
  background: conic-gradient(from 0deg at 50% 50%,
    #FFFFFF 0%, #C8CAD0 18%, #6E7075 38%, #1A1A1C 55%,
    #6E7075 72%, #C8CAD0 88%, #FFFFFF 100%);
  filter: blur(40px);
  opacity: 0.35;
  animation: aurora-rotate 28s linear infinite;
}
@keyframes aurora-rotate { to { transform: rotate(360deg); } }
```
Use inside a dark card with `overflow:hidden` and a `rounded-2xl` mask. Keep content above
it on a `z-10` layer. Opacity stays low (0.25–0.4) so text stays readable.

**B. Soft grey mesh — for the hero / onboarding background on paper.**
Two faint radial blobs drifting behind content. Almost subliminal.

```css
.mesh {
  background:
    radial-gradient(40% 50% at 20% 30%, #E8E9ED 0%, transparent 60%),
    radial-gradient(45% 55% at 80% 70%, #D9DBE0 0%, transparent 60%),
    var(--paper);
}
```
Optionally animate blob positions with a 24–40s ease-in-out loop for slow drift.

**C. Edge fade — for image and section transitions.**
`linear-gradient(180deg, transparent 60%, var(--paper) 100%)` over photos so they dissolve
into the page; and `linear-gradient(to bottom, var(--ink) 80%, transparent)` for legibility
scrims on dark imagery. This is the editorial "fade to paper" used between sections.

**Grain (optional, recommended):** a 3–5% opacity noise PNG overlay on dark cards kills
gradient banding and adds a premium print-like texture.

---

## 4. Typography

**Typeface: Switzer** (Fontshare, free). Fallback to Inter, then system sans — this mirrors
the reference. Load once in the root layout:

```html
<link href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700&display=swap" rel="stylesheet">
```
Set `--font-sans: "Switzer", "Inter", system-ui, sans-serif;` and apply globally.

**Weights:** 400 body · 500 UI/labels/emphasis · 600 headlines · 700 reserved for the
largest display only.

**Tracking is the signature.** Negative letter-spacing tightens as size grows.

| Role            | Size (desktop)        | Weight | Tracking  | Line-height |
|-----------------|-----------------------|--------|-----------|-------------|
| Display (hero)  | clamp(40px,6vw,72px)  | 600    | -0.04em   | 1.02        |
| Section title   | clamp(32px,4vw,52px)  | 600    | -0.03em   | 1.05        |
| H1 (headline)   | 36px                  | 600    | -0.03em   | 1.1         |
| H2              | 28px                  | 600    | -0.02em   | 1.15        |
| H3              | 22px                  | 500    | -0.02em   | 1.25        |
| Body large      | 18px                  | 400    | -0.01em   | 1.6         |
| Body            | 16px                  | 400    | -0.01em   | 1.6         |
| Small / meta    | 14px                  | 500    | 0em       | 1.45        |
| Eyebrow / label | 12px                  | 500    | 0.08em    | 1.4 · UPPERCASE |

Headlines use `--ink`; body uses `--slate` on light. Eyebrows (category/country tags) are
uppercase, tracked-out, in `--mist`. News headlines in cards stay weight 600, never lighter.

---

## 5. Spacing, Layout & Surfaces

- **Spacing scale (px):** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Use generously; default
  section padding is 96 desktop / 48 mobile.
- **Containers:** reading column `max-w-[720px]`; feed/landing `max-w-[1200px]`; full-bleed
  only for dark feature bands and the hero mesh.
- **Grid:** 12-column with 24px gutters on desktop; single column under 768px.
- **Radii:** `--r-sm 8px` (chips, inputs) · `--r-md 12px` (cards) · `--r-lg 16px` (feature
  cards) · `--r-pill 999px` (filter pills, badges). Editorial = restrained, not pill-round
  everywhere.
- **Borders:** 1px `--hairline`. This is the primary separation device.
- **Shadows (neutral, soft, rare):**
  `--shadow-sm: 0 1px 3px rgba(0,0,0,.05);`
  `--shadow-md: 0 4px 30px rgba(0,0,0,.06);`
  `--shadow-lg: 0 10px 50px rgba(0,0,0,.08);`
  Prefer hairlines over shadows; reserve `--shadow-lg` for the floating chatbot panel.
- **Backdrop blur:** sticky nav uses `backdrop-filter: blur(20px)` over `--surface` at ~80%
  opacity (matches the reference's frosted chrome).

---

## 6. Motion & Interaction

The reference's exact vocabulary, recreated with Framer Motion (which v0 ships). Keep these
values — they are what makes it feel like the reference rather than a generic fade.

**Master easing & timing**
```js
export const EASE = [0.44, 0, 0.56, 1];   // smooth in-out from the reference
export const DUR  = { fast: 0.4, base: 0.6, slow: 0.8 };
export const SPRING = { type: "spring", stiffness: 400, damping: 30, mass: 1 };
```

**A. Blur-up reveal (the signature entrance).** Every section/card uses this on scroll.
```js
export const revealUp = {
  hidden: { opacity: 0, y: 16, filter: "blur(5px)" },
  show:   { opacity: 1, y: 0, filter: "blur(0px)",
            transition: { duration: DUR.base, ease: EASE } },
};
// container staggers children by 0.06s:
export const stagger = { show: { transition: { staggerChildren: 0.06 } } };
```
Apply with `whileInView="show"` + `viewport={{ once: true, margin: "-10%" }}`.

**B. Hover / tap micro-interactions.** Cards and buttons lift on a spring.
```js
<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={SPRING}>
```
Card hover also raises elevation (`--shadow-sm` → `--shadow-md`) and brightens the hairline.

**C. Ambient gradient rotation.** The silver aurora rotates 360° over 28s, linear, infinite
(see §3A). Soft mesh blobs drift over 24–40s ease-in-out. These never stop and never demand
attention.

**D. Smooth scroll.** Use Lenis with `lerp ≈ 0.1`. Wrap the app once at the root.

**E. Page / route transitions.** Cross-fade with a 4px blur, `DUR.fast`. No slide-ins.

**Restraint rules:** one reveal per element (`once: true`), no animation on text the user is
actively reading, respect `prefers-reduced-motion` (drop blur/translate, keep opacity).

---

## 7. Component Styling

**Top nav.** Sticky, frosted (`blur(20px)`, `--surface`/80%), 1px bottom hairline. Wordmark
"Scope" left in Switzer 600 (consider a period — "Scope." — echoing the reference's "Draftr.").
Category filter pills centered; chatbot button + avatar right.

**Filter pills.** `--r-pill`, 1px `--hairline`, 12px/500 label. Inactive: transparent bg,
`--slate` text. Active: `--ink` bg, `--paper` text. Hover: `--hairline-2` wash.

**Story card (feed).** `--surface`, `--r-md`, 1px hairline, padding 24. Order: eyebrow row
(category · country, uppercase `--mist`) → serif-weight-600 headline (`--ink`) → one-line AI
summary (`--slate`) → footer row of source favicons + "+N outlets" + validity pill. Hover =
spring lift per §6B.

**Coverage view (hero).** Dark feature header card (`--graphite`) carrying the silver aurora
behind a `z-10` content layer: headline + neutral AI synthesis in `--paper`. Below on paper:
the **validity meter**, the agreement/divergence two-column block, then the source list.

**Validity meter.** Horizontal track, `--hairline` background, fill in the matching validity
color, 0–100 label + one-line rationale. The single most colorful element on the screen — keep
it small and precise.

**Bias badge.** Tiny pill: outlet name + a lean marker (L / C / R as a 3-segment mono dot
indicator, not colored) + a reliability dot. Lean stays greyscale; only reliability may borrow
a validity hue if needed. Default: fully monochrome.

**Chatbot panel.** Right slide-in (shadcn `Sheet`), 380px, `--surface`, `--shadow-lg`, enters
on `SPRING`. Messages: user right-aligned on `--hairline-2`, assistant left on `--surface`.
Source citations render as small numbered superscript chips linking out. Streaming = a 3-dot
pulse in `--mist`.

**Buttons.** Primary: `--ink` bg / `--paper` text, `--r-sm`, 16px/500, hover lift (spring),
no chromatic fill. Secondary: transparent, 1px `--hairline`, `--ink` text. Ghost: text-only
`--slate`. Tap scale 0.98.

**Inputs.** `--surface`, 1px `--hairline`, `--r-sm`, focus = 1px `--ink` ring (no glow). Search
field gets a leading `--mist` magnifier icon.

---

## 8. Imagery & Iconography

- **Photography:** desaturated or duotone toward grey to stay in-system; never a saturated
  photo next to the monochrome UI. Apply the §3C edge-fade so images dissolve into paper.
- **Icons:** thin line icons, 1.5px stroke (Lucide, which v0 ships), in `--slate`/`--ink`.
  Never filled, never colored.
- **Outlet logos / favicons:** rendered small and greyscale (CSS `filter: grayscale(1)`),
  regaining color only on hover if at all — keeps the source row neutral.
- **No illustration mascots, no 3D blobs, no stock gradients.** The only generated texture is
  the silver aurora and the grain overlay.

---

## 9. Accessibility & Restraint Guardrails

- Body text contrast ≥ 4.5:1 (`--slate` on `--paper` passes; never put body text on the
  aurora). Large display text ≥ 3:1.
- Validity color is never the *only* signal — always pair with a label or icon (color-blind
  safe).
- Focus states are always visible (1px `--ink` ring).
- `prefers-reduced-motion`: disable blur, translate, rotation, and Lenis; keep opacity fades.
- Hit targets ≥ 44px. Filter pills and badges get adequate padding even when small.

---

## 10. Notes for v0

- **Fonts:** load Switzer from Fontshare in the root layout (§4); set `--font-sans` and apply
  to `<body>`. Do not let v0 default to Geist/Inter alone — Switzer is core to the identity.
- **Tokens first:** paste §2 into `globals.css` and map every token in `tailwind.config`
  (`colors`, `borderRadius`, `boxShadow`, `fontFamily`). Components reference tokens, never
  raw hex.
- **Motion:** install `framer-motion` and `lenis`; centralize the §6 constants in
  `lib/motion.ts` and reuse `revealUp` / `stagger` everywhere for consistency.
- **shadcn:** use `Sheet` (chatbot), `Card`, `Badge`, `Button`, `Tabs` — then restyle to these
  tokens. Strip default shadcn shadows in favor of hairlines.
- **Do NOT:** introduce brand color, rainbow gradients, drop shadows on every card, fully
  rounded pill-everything, filled/colored icons, or animation on actively-read text. If a
  screen feels flat, add whitespace and tighten the headline — not color.
- **One-line brief if you must compress this:** "NYT-clean editorial in pure black/white/grey,
  Switzer headlines with tight negative tracking, silver liquid-mercury gradients on dark
  cards, blur-up reveals on a smooth Lenis scroll, color reserved only for the validity meter."
