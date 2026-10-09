# Design — Dogear

The locked design system for this app. Pages share it; they differ only in
layout. Tokens live in `src/app/tokens.css` and are mapped to Tailwind in
`src/app/globals.css`.

## Brand
- **Name:** Dogear, after folding a page corner to keep your place.
- **Mark:** an open book whose right page has its corner folded down
  (`src/components/brand.tsx`, `src/app/icon.svg`). The fold reappears on
  generated covers.
- **Voice:** soft, plain, specific. “Right where you folded the corner.”

## Genre and tone
Editorial genre, soft tone. Phone-first app shell: bottom tab bar on phones,
inline tabs + search pill from 768px up.

## Theme (light / dark follows the device)
| Token | Light | Dark |
| --- | --- | --- |
| `--paper` | oklch(97.4% 0.009 85) | oklch(19% 0.01 70) |
| `--paper-2` (raised) | oklch(99.2% 0.004 85) | oklch(23% 0.012 70) |
| `--paper-3` (sunken) | oklch(94.6% 0.011 85) | oklch(26.5% 0.012 70) |
| `--ink` | oklch(24% 0.016 60) | oklch(93% 0.01 85) |
| `--muted` | oklch(51% 0.016 70) | oklch(70% 0.014 75) |
| `--accent` (library-lamp green) | oklch(49% 0.085 160) | oklch(76% 0.09 160) |
| `--accent-soft` | oklch(93.5% 0.03 160) | oklch(31% 0.035 160) |

Contrast: ink/paper 15:1, muted/paper 5.3:1, accent/paper 5.6:1 (light);
ink/paper 15:1, muted/paper 6.9:1, accent/paper 8.9:1 (dark).

## Typography
- Display: **Fraunces**, weight 600, `SOFT` axis 100 (rounded, never sharp). Roman only.
- Body/UI: **Manrope**, 400–600.
- Book text: the reader's own choice (Literata/Bookerly by default).

## Shape and motion
- Radii: covers 6px, cards 20px, sheets 28px, controls fully rounded.
- Easing: expo-out `cubic-bezier(0.16, 1, 0.3, 1)`; 120 / 220 / 380 ms.
- Motion is limited to sheets sliding up, bars fading, and a 2px cover lift on
  hover. Reduced motion collapses to short fades.

## Patterns
- **Book actions** live in a bottom sheet (Read, favorite, shelves, collections),
  never in hover menus.
- **Reader chrome** derives every color from the reading theme, so controls
  always match the page. Page turns stay on the left/right quarters; the
  middle of the page toggles the chrome.
- **Accent** marks the primary action, active navigation, and progress only.
