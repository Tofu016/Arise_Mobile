const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Metro only treats certain file extensions as bundleable "assets" by
// default (images, fonts, etc.) — 3D model formats aren't included out of
// the box, so requiring a .obj file fails to resolve without this. .mtl
// (material files, used alongside .obj for texture/color info) added too,
// even though we don't have one yet, since it'll be needed the moment a
// model with real textures shows up.
config.resolver.assetExts.push("obj", "mtl");

module.exports = config;
