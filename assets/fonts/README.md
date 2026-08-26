# App fonts

Drop the SDCA brand font files here, named **exactly** as below (the
`expo-font` config plugin in `app.json` and the family names in
`src/theme/typography.js` both reference these stems):

| File | Role |
|---|---|
| `SourceSans3-Regular.ttf`   | body copy |
| `SourceSans3-Medium.ttf`    | body, medium emphasis |
| `SourceSans3-SemiBold.ttf`  | body, strong emphasis |
| `Montserrat-SemiBold.ttf`   | UI labels, eyebrows, section titles |
| `Montserrat-Bold.ttf`       | headings, buttons, nav |
| `Montserrat-ExtraBold.ttf`  | large display / hero CTAs |
| `SourceSerif4-SemiBold.ttf` | the single editorial hero line (login title) |

Notes:
- `.otf` works too — if you use `.otf`, update the extensions in the
  `expo-font` plugin `fonts` array in `app.json` to match.
- Fonts are embedded at build time, so a **native rebuild** is required
  after adding them (`npx expo prebuild --clean` then `npx expo run:android`
  / `run:ios`, or an EAS dev build). Until then the app falls back to the
  system font — layout and weights still work, only the typeface differs.
- If iOS renders a fallback after the rebuild, the font's internal
  PostScript name differs from its filename; switch the `app.json` entry to
  the object form (`{ "fontFamily": "...", "fontDefinitions": [...] }`) or
  rename to match the PostScript name.
