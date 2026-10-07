import { copyFile, mkdir, rm } from "node:fs/promises";
import './verify-vendor.mjs';

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyFile(new URL("src/index.js", root), new URL("index.js", dist));
await copyFile(new URL('src/code-provenance.js', root), new URL('code-provenance.js', dist));
await copyFile(new URL('src/metric-provenance.js', root), new URL('metric-provenance.js', dist));
await copyFile(new URL('src/card-provenance.js', root), new URL('card-provenance.js', dist));
await copyFile(new URL('src/media-provenance.js', root), new URL('media-provenance.js', dist));
await copyFile(new URL('src/heading-provenance.js', root), new URL('heading-provenance.js', dist));
await copyFile(new URL('src/text-provenance.js', root), new URL('text-provenance.js', dist));
await copyFile(new URL('src/rich-heading.js', root), new URL('rich-heading.js', dist));
await copyFile(new URL('src/timeline-provenance.js', root), new URL('timeline-provenance.js', dist));
await copyFile(new URL('src/quote-provenance.js', root), new URL('quote-provenance.js', dist));
await copyFile(new URL('src/furniture-provenance.js', root), new URL('furniture-provenance.js', dist));
await copyFile(new URL('src/annotation-export.js', root), new URL('annotation-export.js', dist));
await copyFile(new URL('src/annotation-provenance.js', root), new URL('annotation-provenance.js', dist));
await copyFile(new URL('src/document-provenance.js', root), new URL('document-provenance.js', dist));
await copyFile(new URL('src/content-topology.js', root), new URL('content-topology.js', dist));
await copyFile(new URL('src/run-colors.js', root), new URL('run-colors.js', dist));
await copyFile(new URL('src/sections.js', root), new URL('sections.js', dist));
await copyFile(new URL('src/furniture-fields.js', root), new URL('furniture-fields.js', dist));
await copyFile(new URL('src/native-furniture.js', root), new URL('native-furniture.js', dist));
await copyFile(new URL('src/chart-workbook.js', root), new URL('chart-workbook.js', dist));
await copyFile(new URL('src/chart-types.js', root), new URL('chart-types.js', dist));
await copyFile(new URL('src/chartex.js', root), new URL('chartex.js', dist));
await copyFile(new URL('src/chart-options.js', root), new URL('chart-options.js', dist));
await copyFile(new URL('src/chart-alt.js', root), new URL('chart-alt.js', dist));
await copyFile(new URL('src/chart-data.js', root), new URL('chart-data.js', dist));
await copyFile(new URL('src/chart-highlight.js', root), new URL('chart-highlight.js', dist));
await copyFile(new URL('src/data-provenance.js', root), new URL('data-provenance.js', dist));
await copyFile(new URL("src/index.d.ts", root), new URL("index.d.ts", dist));
await copyFile(new URL("src/image-geometry.js", root), new URL("image-geometry.js", dist));
await copyFile(new URL('src/slide-image-provenance.js', root), new URL('slide-image-provenance.js', dist));
await copyFile(new URL('src/media-dedupe.js', root), new URL('media-dedupe.js', dist));
await copyFile(new URL('src/watermark-provenance.js', root), new URL('watermark-provenance.js', dist));
await copyFile(new URL('src/logo-provenance.js', root), new URL('logo-provenance.js', dist));
await copyFile(new URL('src/svg-image.js', root), new URL('svg-image.js', dist));
await copyFile(new URL('src/master-themes.js', root), new URL('master-themes.js', dist));
await copyFile(new URL('src/vendor-compat.js', root), new URL('vendor-compat.js', dist));
for (const name of ['image-fallback-node.js', 'image-fallback-browser.js']) {
  await copyFile(new URL(`src/${name}`, root), new URL(name, dist));
}

await copyFile(new URL('src/background.js', root), new URL('background.js', dist));
await copyFile(new URL('src/background-import.js', root), new URL('background-import.js', dist));
await copyFile(new URL('src/image-import.js', root), new URL('image-import.js', dist));
await copyFile(new URL('src/import-signals.js', root), new URL('import-signals.js', dist));

await copyFile(new URL('src/table-import.js', root), new URL('table-import.js', dist));
for (const name of ['native-text-style.js', 'body-text-import.js', 'font-weights.js']) await copyFile(new URL(`src/${name}`, root), new URL(name, dist));
await copyFile(new URL('src/table-cell-import.js', root), new URL('table-cell-import.js', dist));
await copyFile(new URL('src/table-border-import.js', root), new URL('table-border-import.js', dist));
await copyFile(new URL('src/color-ref.js', root), new URL('color-ref.js', dist));
await copyFile(new URL('src/format-check.js', root), new URL('format-check.js', dist));
await copyFile(new URL('src/theme-colors.js', root), new URL('theme-colors.js', dist));
await copyFile(new URL('src/typeface-inventory.js', root), new URL('typeface-inventory.js', dist));
await copyFile(new URL('src/package-fonts.js', root), new URL('package-fonts.js', dist));
await copyFile(new URL('src/script-fonts.js', root), new URL('script-fonts.js', dist));
await copyFile(new URL('src/numbered-list.js', root), new URL('numbered-list.js', dist));
