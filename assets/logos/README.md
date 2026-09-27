# Logos

## SDCA
`sdca-logo-horizontal.png` — the official SDCA logo (globe + wordmark, in
colour), trimmed and resized from the designer's original. Shown by
`src/components/BrandLogo.js` (top of the tour, Sign in, Register), which
hard-codes its 1200:341 aspect ratio — update it if the file is replaced.

## ARISE (`arise/`)
The app's own logo, cut from the designer's "Arise Logo (1)–(3).svg" at 2x:
`button.png` (the red AR-scan button) and `letter-a…e.png` (the gold
ARISE letters). `src/components/AriseLogo.js` draws the frame, dot and
cursor itself and animates these into place (the startup screen); the
positions there are in the SVGs' units.

Logo (1) as a whole is also the app icon and the splash image: see
`../icon.png`, `../adaptive-icon.png` and `../splash-icon.png`.
