# Catalog and design application

Direct local lookup:

```js
import { catalogs, validateCatalogRecord } from '@openpresentation/opf';
const options = catalogs.layouts.filter(record => record.id.includes('text-2x'));
const font = catalogs.fontSchemes.find(record => record.id === 'roboto');
const validation = validateCatalogRecord('layouts', customLayoutRecord);
```

Check the record before copying its ID. The resolution contract is inline records, declared catalog sources, then engine/default catalogs. Core validation never fetches the declared sources. Some renderer integrations accept already loaded records; an unresolved URL is not a loaded record.

Design example:

```json
{
  "design": {
    "theme": "classic",
    "fontScheme": "roboto",
    "colorScheme": {"id": "cool-horizon", "accent1": "#0F4C81"},
    "footer": {"left": {"text": "Working draft"}, "right": {"slideNumber": true}}
  },
  "slides": [
    {"title": "Inherits shared design", "text": "The deck sets the base."},
    {"title": "A deliberate exception", "design": {"footer": false}, "text": "This slide suppresses the footer."}
  ]
}
```

Theme defaults sit below explicit deck and slide design. Inline `id` plus overrides resolve the base record before overriding fields. Header/footer/watermark `false` differs from omission. Dimensions accept presets or explicit inches; don't encode pixels as inches. Backgrounds can be theme slots, hex strings, or typed theme/solid/gradient/image/pattern objects. Background image objects use `{src, fit}`, not a bare source string.

Use font schemes for pair/role selection; load the actual font files separately. The core package contains font metadata, not every font binary. Rich text run overrides and schema-accepted design controls may exceed current SVG/PPTX visual coverage.

## Gallery reuse

With a compatible `opf-editor` build:

```js
import { loadOpfGallery, loadOpfGalleryItem } from '@openpresentation/opf-editor/galleries';
const gallery = await loadOpfGallery(registryUrl, {signal});
const chosen = gallery.items.find(item => item.id === desiredId);
if (!chosen) throw new Error('Requested example is absent from this registry');
const document = await loadOpfGalleryItem(chosen, {gallery: gallery.url, signal});
```

`registryUrl`, `signal`, and `desiredId` are host-provided. Custom registries can contain `items` with inline `opf` documents or `opfUrl` links. The helper supports PPTX.gallery descriptors, enforces size/origin boundaries, and requires browser CORS for remote requests. It does not scrape arbitrary HTML or fetch all external fonts/catalog sources. Generic galleries should supply self-contained OPF.

A local workspace snapshot and the public registry can differ. Preserve the selected source and its included records. Validate copied data against the installed OPF version before merging. Use transfer APIs or a deliberate ID-remapping merge so imported assets, catalog IDs, and slide IDs cannot alter existing slide references.
