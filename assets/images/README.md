# Images

`no-image.jpg`: the "NO IMAGE" placeholder panorama (equirectangular,
2912x1440), copied unchanged from the web app's
`Arise_Web/src/assets/images/no-image.jpg`, where `PanoramaNav` shows it for
a node with no photo. Here the AR portal shows it after a placard scan
(`app/ar-portal.js`) for a room on OCR without its own AR 360 image. Keep it
in step with the web copy; Viro360Image is handed it as a bundled require(),
which is the one source shape it reliably loads besides a local JPEG file.
