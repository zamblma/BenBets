# Icon Generation

The SVG icons (`icon-192.svg`, `icon-512.svg`) are provided as source files.

To generate the PNG versions required by the manifest, convert them using any SVG-to-PNG tool:

- **Inkscape**: `inkscape icon-512.svg --export-width=512 --export-height=512 --export-filename=icon-512.png`
- **rsvg-convert** (librsvg): `rsvg-convert -w 512 -h 512 icon-512.svg -o icon-512.png`
- **Online**: https://convertio.co/svg-png/

Place the resulting `icon-192.png` and `icon-512.png` alongside the SVGs in the `public/` folder.
