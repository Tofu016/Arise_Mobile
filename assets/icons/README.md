# Icons

The brand board's icon set, exported from the designer's SVGs (not kept
in the repo — ask the designer for the "icons - grey" / "icons - white"
exports to re-export).

Canva's SVGs embed raster images inside masks and filters, which React
Native doesn't render reliably, so each icon is exported to PNG instead:

- `*.png` are single-colour glyphs, trimmed and **pure white**. They're
  drawn by `src/components/Icon.js` with `tintColor`, so one file covers
  the grey, white and red states. The white set is the preferred source
  because its cut-outs (the arrow in `directions`, the arrows in
  `scan-landscape` and `scan-portrait`) are transparent, which tinting
  needs.
- `color/gyro-control-on.png` / `-off.png` are the gyro toggle: the
  board's compass inside its four arrows, combined, with a soft white
  outline. They're shown as-is through `COLOR_ICONS` in `Icon.js`.
- `color/joystick-base.png` / `joystick-knob.png` are `gyro-control-off.png`
  cut in two (the chevrons; the compass), for the AR screen's joystick
  (`src/components/ArJoystick.js`).
- Only the icons the app shows are exported; the rest of the board's set
  is in the designer's SVG exports if it's ever needed.

To add or update an icon, render the SVG (headless Chrome at 6x works),
trim it to its glyph, make it white on transparent, cap the longest side at
96 px, save it here, and add it to `ICONS` in `Icon.js`.
