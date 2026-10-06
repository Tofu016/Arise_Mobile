# Third-Party Notices & License Elections

This file records open-source license obligations for the ARISE mobile app and
the elections ARISE has made where a dependency is offered under more than one
license. It is the authoritative record for OSS-compliance / SBOM review — not
the README.

Last reviewed: 2026-09-07 (Expo SDK 57 upgrade).

## License election: `node-forge`

`node-forge` is distributed under a **disjunctive dual license**:
`(BSD-3-Clause OR GPL-2.0)`.

**ARISE elects to use `node-forge` under the BSD-3-Clause option.**

- Rationale: BSD-3-Clause is a permissive license compatible with a closed-source
  mobile application. The GPL-2.0 option is not exercised.
- Scope: `node-forge` is a **build-time-only** dependency. It is pulled in by
  `@expo/cli` / `@expo/code-signing-certificates` and is used during
  `expo prebuild` / EAS Build for code-signing certificate handling. It is **not
  bundled into the shipped iOS or Android application binary** and is never
  distributed to end users.
- A disjunctive ("OR") dual license grants the recipient the right to choose
  either license; there is no legal requirement to record the choice in writing.
  This note is kept as good-practice documentation for downstream compliance
  review.

## Distributed dependency licenses (shipped in the app binary)

The runtime dependency tree that is compiled into the app is entirely permissive:

| License | Notable packages |
|---|---|
| MIT | react, react-native, expo + all `expo-*` modules, `@reactvision/react-viro` (ViroReact), `three`, `@react-three/fiber`, `expo-router`, `react-native-reanimated`, `react-native-gesture-handler`, `fuse.js` |
| Apache-2.0 | `@infinitered/react-native-mlkit-*` |
| BSD-3-Clause / BSD-2-Clause / ISC / 0BSD | assorted transitive utilities |
| SIL Open Font License 1.1 | icon fonts bundled by `@expo/vector-icons` (Font Awesome Free fonts, Material Design Icons) |
| MIT (artwork) | `assets/icons/link.png`: Phosphor Icons "link-simple", bold weight, Copyright (c) 2023 Phosphor Icons |

No copyleft (GPL / LGPL / AGPL) or share-alike (CC-BY-SA) licensed code is
compiled into the distributed application.

### Brand fonts (not open source)

The app bundles the two typefaces from the SDCA brand board
(`assets/fonts/`). Neither is open-licensed, so each needs a licence that
covers embedding in a distributed app:

| Font | Files | Owner / terms |
|---|---|---|
| Century Gothic Paneuropean | `CenturyGothic-*.ttf` | Monotype, commercial. Needs an **app-embedding licence** before the APK is distributed. |
| Optimus Princeps | `OptimusPrinceps-*.ttf` | Manfred Klein, freeware. Confirm the terms allow app embedding. |

Open-licensed stand-ins (TeX Gyre Adventor, GUST licence; Cinzel, SIL OFL)
are kept in `assets/fonts/open-alternatives/` with their licences. They are
not bundled unless `app/_layout.js` is pointed back at them.

## Build-time-only dependencies of note (not distributed)

These appear in `node_modules` for tooling but are not in the app binary. Listed
for completeness:

| Package | License | Used by |
|---|---|---|
| `node-forge` | BSD-3-Clause (elected) / GPL-2.0 | EAS code signing |
| `lightningcss` | MPL-2.0 | Metro CSS transform. Used unmodified as a dependency — MPL-2.0's source-disclosure obligation applies only to modified MPL files, so there is nothing to disclose. |
| `caniuse-lite` | CC-BY-4.0 | `browserslist` data (build) |
| `argparse` | Python-2.0 | build tooling |
| `big-integer`, `stream-buffers` | Unlicense (public domain) | build tooling |

## How to re-verify

```
npm ls --all --omit=dev            # inspect the distributed tree
npx license-checker-rseidelsohn --production --summary
```

Re-review this file on every Expo SDK major upgrade or when adding a direct
dependency.
