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
| MIT | react, react-native, expo + all `expo-*` modules, `@reactvision/react-viro` (ViroReact), `three`, `@react-three/fiber`, `expo-router`, `react-native-reanimated`, `react-native-gesture-handler`, `fuse.js`, `jpeg-js` |
| Apache-2.0 | `firebase` / `@firebase/*`, `@infinitered/react-native-mlkit-*` |
| BSD-3-Clause / BSD-2-Clause / ISC / 0BSD | assorted transitive utilities |

No copyleft (GPL / LGPL / AGPL) or share-alike (CC-BY-SA) licensed code is
compiled into the distributed application.

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
