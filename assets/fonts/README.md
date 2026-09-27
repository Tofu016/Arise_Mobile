# App fonts

The UI designer's brand board (sdca2026.my.canva.site/virtualtour) uses
two typefaces, and the app ships the real files:

| Design font | Used for | Files |
|---|---|---|
| Century Gothic (Paneuropean) | everything: Black headings, Bold buttons/labels, Regular body | `CenturyGothic-Regular/SemiBold/Bold/Black.ttf` |
| Optimus Princeps | the "St. Dominic College of Asia" wordmark style | `OptimusPrinceps-Regular/SemiBold.ttf` |

Fonts are loaded at runtime by `app/_layout.js` (expo-font `useFonts`,
`FONT_FILES`), so adding or swapping a file needs only a Metro reload, not a
native rebuild. The family names in `src/theme/typography.js` are the keys
registered there.

## Licensing

Century Gothic is a commercial Monotype font. Distributing it inside an
APK needs a licence that covers app embedding. Optimus Princeps is
freeware by Manfred Klein, so confirm its terms allow embedding too. See
`THIRD-PARTY-NOTICES.md`.

If a licence can't be had, switch to the open look-alikes in
`open-alternatives/`: TeX Gyre Adventor (for Century Gothic, GUST licence)
and Cinzel (for Optimus Princeps, SIL OFL). Their licences are in
`open-alternatives/licenses/`. Point `FONT_FILES` at them, keeping the same
keys or updating `fontFamily` in `src/theme/typography.js`. TeX Gyre
Adventor has no Black weight, so map `displayHeavy` to its Bold.
