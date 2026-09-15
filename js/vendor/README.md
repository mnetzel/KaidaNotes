# html-to-image

`html-to-image.js` is the unmodified UMD distribution of html-to-image 1.11.11,
from https://registry.npmjs.org/html-to-image/-/html-to-image-1.11.11.tgz.
Upstream: https://github.com/bubkoo/html-to-image. MIT license included alongside.

This version recursively copies SVG child styles, required by our block timeline.
The presentation exporter embeds both local Iosevka fonts without the library's
preferred-format filter, then normalizes SVG geometry and logical borders.
The library is loaded locally on demand; no third-party image service is used.
