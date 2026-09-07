# Dependency audit & Expo SDK 57 upgrade — 2026-09-07

## Summary

| | Before | After |
|---|---|---|
| `npm audit` | 31 (14 high, 17 moderate) | **14 (0 high, 14 moderate)** |
| Distinct advisories behind those | ~8 | **2** (`decode-uri-component`, `uuid`) |
| Runtime-shipped advisories | 1 (`decode-uri-component`) | 1 (`decode-uri-component`) — unchanged, see below |
| Deprecated packages | 8 (`uuid`, `core-js@1`, `inflight`, `rimraf@3`, `glob@7`, `jest-native`, `text-encoding`, `domexception`) | 3 (`inflight`, `rimraf@3`, `glob@7` — all build-time, transitive under RN/Expo tooling) |
| Expo SDK | 54 | 57 |
| React Native | 0.81.5 | 0.86.3 |
| Peer-dependency state | `expo` + `react-native` reported **invalid** against `@reactvision/react-viro` | valid |
| `expo-three` | installed, **unused** | removed |
| Tracked package dirs in `node_modules` | ~855 | ~472 |

## What changed (committed)

### `package.json`
- `expo` `~54.0.0` → `^57.0.0`
- `react` `19.1.0` → `19.2.3`
- `react-native` `0.81.5` → `0.86.3`
- `react-native-reanimated` `~4.1.1` → `4.5.1`
- `react-native-worklets` `0.5.1` → `0.10.1`
- `react-native-screens` `~4.16.0` → `~4.26.0`
- `react-native-safe-area-context` `~5.6.0` → `~5.7.0`
- `react-native-gesture-handler` `~2.28.0` → `~2.32.0`
- All `expo-*` modules → `~57.x`
- **Removed `expo-three`** — it was not imported anywhere. 3D-in-JS
  (`src/components/PanoramaViewer.js`) uses `@react-three/fiber` + `three`
  directly. Removing it deleted the entire
  `@expo/browser-polyfill → fbemitter → fbjs → isomorphic-fetch → node-fetch`
  chain plus `core-js@1.2.7`, `uuid@8`, `text-encoding`, `domexception`.
- **Added `@expo/config-plugins` `~57.0.9` to `devDependencies`** — see
  "Known issue" below.
- `@react-native-async-storage/async-storage` unchanged (SDK 57 still pins
  `2.2.0`).
- `@babel/core` unchanged (`babel-preset-expo@57` still targets Babel 7).
- `three` unchanged (`^0.185.1` is current).

### `app.json`
- Removed the top-level `splash` key (invalid in SDK 57's schema).
- Added the `expo-splash-screen` config plugin with
  `{ "backgroundColor": "#FFFFFF" }` (the SDK 55+ replacement for `splash`).

### New files
- `THIRD-PARTY-NOTICES.md` — records the `node-forge` BSD-3-Clause election and
  the distributed-tree license picture. **The licensing note belongs here, at the
  repo root, not in the README or research docs** — it's the file an
  OSS-compliance / SBOM reviewer looks for.

## Validation performed

- `npx expo config --json` — resolves cleanly; all 4 plugins load
  (`expo-router`, `expo-font`, `expo-camera`, `@reactvision/react-viro`,
  `expo-splash-screen`).
- `npx expo export --platform ios` — **Metro bundle builds: 1791 modules, no
  transform errors.** Confirms:
  - Babel + `react-native-reanimated/plugin` ordering still valid
  - `metro.config.js` `.obj` / `.mtl` `assetExts` push still resolves —
    `assets/models/door-frame.obj` and `portal-mask.obj` bundled
  - `@reactvision/react-viro` JS imports resolve under RN 0.86
  - ViroReact runtime assets (spinner PNGs) bundled
- `npx expo-doctor` — 19/21 pass. The 2 non-passes:
  1. "Check Expo config schema" — only fails on a network timeout to
     `exp.host` in this environment; the actual `splash` schema error is fixed.
     Re-run on a stable connection to confirm green.
  2. "packages that should not be installed directly" — the intentional
     `@expo/config-plugins` entry. Expo-doctor itself says this is ignorable
     when the package is present to satisfy a config-plugin peer dep.
- `react-native@0.86.3` is inside `@reactvision/react-viro`'s peer range
  (`>=0.83.0 <0.87.0`); `expo@57` is inside its range (`>=55.0.0 <58.0.0`).
  **SDK 57 was the right target — no need to drop to SDK 56.**
- **`npx expo prebuild --clean` + `./gradlew :app:assembleDebug` → BUILD
  SUCCESSFUL** (~10 min). This compiled ViroReact's native code (CMake, all
  ABIs) and ran RN 0.86 New Architecture codegen — the two things most at risk
  from the RN bump — and produced a working `app-debug.apk`. iOS native build
  (CocoaPods) still needs to be done on macOS.

### Build fix required during the upgrade (commit `b5ca57a`)

The first Android build failed at `:app:processDebugResources`:
`resource drawable/splashscreen_logo not found`. `expo-splash-screen@57.0.8`
writes `windowSplashScreenAnimatedIcon=@drawable/splashscreen_logo` into
`styles.xml` whenever `backgroundColor` is set, but only generates that drawable
when an `image` is also given. Fixed by passing `image: ./assets/icon.png`
(+ `imageWidth: 200`) to the plugin, and adding `expo-system-ui` (prebuild
flagged it as required for `userInterfaceStyle: light`). Both were behaviours
SDK 54 handled implicitly.

## Known issue: `@expo/config-plugins` direct dependency

`@reactvision/react-viro`'s config plugin (`app.plugin.js`) does a bare
`require('@expo/config-plugins')`. Up to Expo SDK 54 that package was hoisted to
the top level of `node_modules` by the Expo toolchain; from SDK 55 it is nested
under `@expo/cli/node_modules` and the bare require fails during
`expo prebuild` / EAS Build with `PluginError: Cannot find module
'@expo/config-plugins'`.

**Workaround applied:** add `@expo/config-plugins` (`~57.0.9`, matching what
`@expo/cli@57` bundles) as an explicit `devDependency` so it hoists to the top
level. This is the community-standard fix for third-party config plugins on
SDK 55+.

**Cost:** `expo-doctor` shows one failed check ("should not be installed
directly"), and the dep pulls `xcode@3` → `uuid@7.0.3` (one of the 14 remaining
moderate advisories). `xcode`/`uuid` is *also* pulled by `@expo/cli`
independently, so this adds no advisory that wasn't already present via the
toolchain — it only makes it show in `devDependencies` too.

**Real fix (upstream):** `@reactvision/react-viro` should switch its plugin
import to `expo/config-plugins` (the sub-export of the `expo` package). Track
ReactVision releases; when they do, remove this `devDependency`. Keep the pinned
version in sync with `expo` patch bumps in the meantime.

## Remaining `npm audit` findings (14 moderate, accepted)

All 14 collapse to two advisories, both present on the latest Expo SDK 57 — not
fixable by us without Expo shipping new transitive versions:

1. **`decode-uri-component` ≤0.4.2 — DoS via malformed percent-encoded input**
   (GHSA-vcc3-ghjq-m6fr). Chain: `expo-router@57 → query-string@7.1.3 →
   decode-uri-component@0.2.2`. This is the only finding in code that **runs on
   the device**. Practical risk is low: an attacker must get a user to open a
   crafted `arise://` deep link, and the impact is CPU spin (no RCE, no data
   exposure). `query-string@7` is the version Expo Router 57 ships; wait for
   Expo to bump it.
2. **`uuid` <11.1.1 — missing buffer bounds check in v3/v5/v6**
   (GHSA-w5hq-g745-h8pq). Chain: `@expo/config-plugins → xcode@3.0.1 →
   uuid@7.0.3`. **Build-time only** — `xcode` runs during prebuild to edit the
   iOS `.pbxproj`. Not in the app binary. The vulnerable code path (`uuid` with
   a caller-supplied `buf`) is not exercised by `xcode`.

Suggested `npm audit` CI gate: fail on `high` and above; allow the current
`moderate` set with an allowlist referencing this document.

---

# MANUAL STEPS — you must do these

The JS/dependency/config work is done and committed on branch
`chore/expo-sdk57-upgrade`. A rollback tag `deps-sdk54-baseline` points at the
pre-upgrade `main`. The **Android debug build has been verified locally on this
machine** (see Validation above). What remains: the **iOS** native build
(macOS-only) and **on-device AR regression testing** (physical device required).

## 1. Regenerate native projects — DONE for Android on this machine

The local `android/` folder was regenerated with `npx expo prebuild --clean` and
built successfully. It is gitignored/easignored so it is not in the repo; EAS and
other machines regenerate it from `app.json`.

On a fresh checkout / another machine:
```
git checkout chore/expo-sdk57-upgrade
npm ci
npx expo prebuild --clean
```
If `expo prebuild` throws `Cannot find module '@expo/config-plugins'`, confirm
`@expo/config-plugins` is in `devDependencies` and `npm ci` completed — that is
the workaround described above.

On macOS, `expo prebuild` also generates `ios/`; then `cd ios && pod install`.

### `SDK location not found` after `prebuild --clean`

`expo prebuild --clean` deletes `android/`, including `android/local.properties`
(the file that pins `sdk.dir`). It is correctly gitignored — it is machine
specific — so after a clean prebuild Gradle has nothing pointing at the SDK and
fails with:

```
SDK location not found. Define a valid SDK location with an ANDROID_HOME
environment variable or by setting the sdk.dir path in ... local.properties
```

Fix (do this once, permanently, so it survives every future clean prebuild):

- **Set `ANDROID_HOME` as a user environment variable** to your SDK path
  (`C:\Users\dothy\AppData\Local\Android\Sdk`) and **open a new terminal** — an
  already-open shell will not pick up a newly-set variable. Verified: with
  `ANDROID_HOME` set and no `local.properties`, Gradle configures fine.
- Or, after each `prebuild --clean`, recreate the file:
  `echo "sdk.dir=C:/Users/dothy/AppData/Local/Android/Sdk" > android/local.properties`
- `npx expo run:android` writes `android/local.properties` itself when it can
  detect the SDK, so prefer it over calling `./gradlew` directly.

## 2. Confirm `expo-doctor` is green on a stable network

```
npx expo-doctor
```

Expect only the `@expo/config-plugins` "installed directly" item to remain. If
the Expo config **schema** check still fails with a real message (not a network
timeout), fix the reported `app.json` field before building.

## 3. Build

Android debug APK is already verified on this machine
(`android/app/build/outputs/apk/debug/app-debug.apk`). Remaining:

```
npx expo run:android        # to install the dev client on a device + start Metro
npx expo run:ios            # macOS only — Xcode + pod install; NOT yet verified
```

or EAS (recommended — matches your `eas.json`):
```
eas build --profile development --platform android
eas build --profile development --platform ios
```

Watch the native build logs for:
- ViroReact Gradle/CocoaPods integration (the `withViro` config plugin edits
  `MainApplication`, `AndroidManifest`, `Info.plist`, Podfile).
- React Native **New Architecture** codegen — RN 0.86 has the New Arch on by
  default. ViroReact 2.5x targets New Arch, so this is expected to work, but
  it's the most likely place for a native break. If it fails, check for a
  ReactVision release note about the exact RN 0.86 patch line, and as a fallback
  try `newArchEnabled: false` in `app.json` to isolate whether New Arch is the
  cause.

## 4. On-device AR regression checklist

Test on a **physical ARCore (Android) / ARKit (iOS) device** — AR does not work
in simulators/emulators.

- [ ] App launches past the splash screen (verify `expo-splash-screen`
      background is white).
- [ ] Camera + microphone permission prompts appear with the ARISE strings from
      `app.json` (the `@reactvision/react-viro` plugin generates these).
- [ ] `app/ar-viewer.js` — AR camera session starts, `ViroARScene` renders,
      `ViroTrackingStateConstants` transitions from unavailable → normal
      (tracking-status UI updates).
- [ ] `app/ar-portal.js` — portal scene:
  - [ ] `.obj` door-frame model loads and is visible (this exercises the
        `metro.config.js` assetExts change + `Viro3DObject`).
  - [ ] Door "rise" animation plays (`ViroAnimations`), scale looks correct.
  - [ ] `Viro360Image` panorama renders inside the portal when you walk
        through it.
  - [ ] `ViroMaterials` / lighting (`ViroAmbientLight`) look right.
- [ ] `src/components/PanoramaViewer.js` (the non-Viro, `@react-three/fiber`
      path) — panorama still renders and responds to device rotation; hotspot
      raycasting still works.
- [ ] Placard scanner OCR (`@infinitered/react-native-mlkit-text-recognition`)
      still recognises text — this package was bumped transitively for RN 0.86.
- [ ] Firebase calls still succeed (auth/firestore/whatever the app uses).
- [ ] `react-native-gesture-handler` 2.32 + `react-native-screens` 4.26:
      navigation gestures, swipe-back, modal presentation all still work.
- [ ] `react-native-reanimated` 4.5: any animated UI outside AR still runs.

## 5. Merge

Once the device regression passes:

```
git checkout main
git merge --no-ff chore/expo-sdk57-upgrade
```

Keep the `deps-sdk54-baseline` tag until the SDK 57 build has been in a release
for a cycle, in case you need to roll back.

## 6. Follow-ups (not blocking)

- Add an `npm audit` step to CI: `npm audit --audit-level=high` (fails the
  build on high/critical, tolerates the documented moderate set).
- Add `.nvmrc` / `"engines"` pinning Node 24.x to match the dev environment.
- Consider pinning `three` to an exact version (it ships breaking changes in
  minor releases even though npm semver treats `0.x` minors as majors).
- Watch for a `@reactvision/react-viro` release that fixes the
  `@expo/config-plugins` import, then drop that `devDependency`.
