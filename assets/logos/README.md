# Logos

## SDCA
`sdca-logo-horizontal.png` — the official SDCA logo (globe + wordmark, in
colour), trimmed and resized from the designer's original. Shown by
`src/components/BrandLogo.js` (top of the tour, Sign in, Register), which
hard-codes its 1200:341 aspect ratio — update it if the file is replaced.

## ARISE (`arise/`)
The app's own logo, grey version, cut at 2x from the designer's SVGs:
`button.png` (the red AR-scan button, from "Animation Start") and
`letter-a…e.png` (the ARISE letters, recoloured #f2f1ec; from "Animation end"; A and R
are from "Letters.svg", with see-through counters). `src/components/AriseLogo.js` draws the grey frame, dot
and cursor itself and animates everything through the designer's
keyframes — Neutral State → Animation Start → in between → end — on the
startup screen; the positions there are in the SVGs' units.

The Neutral State (square frame + button) is the native splash
(`../splash-icon.png`, shown at 123dp — the animation's first frame), and
the designer's "App icon.svg" is the app icon (`../icon.png`; on Android
the red button alone on grey, `../adaptive-icon.png`).
