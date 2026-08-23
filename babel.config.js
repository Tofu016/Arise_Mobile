module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Required for react-native-reanimated to work at all — must be the
    // LAST plugin in this array (Reanimated's own docs are explicit about
    // this ordering requirement).
    plugins: ["react-native-reanimated/plugin"],
  };
};
