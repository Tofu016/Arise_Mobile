// Extends app.json (which Expo passes in as `config`) with native build
// settings. Native settings: a change here needs a rebuild (npx expo
// prebuild --clean, then build), not just a Metro reload.
//
// ARM only. Every phone runs arm64-v8a (or, for older/budget 32-bit ones,
// armeabi-v7a); x86/x86_64 exist only for emulators, and with ViroReact,
// ML Kit and React Native each shipping a native library per architecture,
// those two alone added ~75 MB to the APK. To test in an x86 emulator,
// add "x86_64" here temporarily.
//
// Cleartext HTTP on Android: release builds refuse plain http:// by
// default; only debug builds allow it. While Arise_API is served over
// http:// (XAMPP on the local network), the app has to opt in, or every
// request in a preview/production build fails with a network error. The
// opt-in is derived from EXPO_PUBLIC_API_BASE_URL itself, so the day the
// API moves to https:// it switches off without anyone editing this file.
//
// Build variant (APP_VARIANT, set per profile in eas.json; a local
// `expo run:android` counts as development). Only the development build
// may switch to another Arise_API server from the Sign in screen
// (extra.serverSetting, see src/api/serverAddress.js), so only it allows
// plain http:// to any host. Preview and production builds can't switch
// server, and allow http:// only if their own built-in address is http://.
//
// iOS (App Transport Security), always set explicitly: Expo's template
// otherwise allows plain http:// to ANY host (NSAllowsArbitraryLoads).
// Here only the local network is exempt — LAN IPs and .local hosts, which
// covers XAMPP on the LAN and Metro during development — and everything
// on the internet must be https://.

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost/Arise_API/index.php";
const apiUsesHttp = API_BASE_URL.startsWith("http://");
const APP_VARIANT = process.env.APP_VARIANT || "development";
const isDevelopment = APP_VARIANT === "development";

module.exports = ({ config }) => {
  const android = { buildArchs: ["armeabi-v7a", "arm64-v8a"] };
  if (isDevelopment || apiUsesHttp) android.usesCleartextTraffic = true;

  const ios = {
    ...config.ios,
    infoPlist: {
      ...config.ios?.infoPlist,
      NSAppTransportSecurity: { NSAllowsArbitraryLoads: isDevelopment, NSAllowsLocalNetworking: true },
    },
  };

  return {
    ...config,
    ios,
    extra: { ...config.extra, appVariant: APP_VARIANT, serverSetting: isDevelopment },
    plugins: [...(config.plugins || []), ["expo-build-properties", { android }]],
  };
};
