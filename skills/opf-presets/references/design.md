# Catalog and design application

Direct local lookup:

```js
import { embed, validate, validateCatalogRecord } from '@openpresentation/opf';
import { defaultCatalog } from '@openpresentation/opf/catalog';
const options = Object.keys(defaultCatalog.layouts).filter(id => id.includes('text-2x'));
const font = defaultCatalog.fontSchemes.roboto;
const validation = validateCatalogRecord('layouts', publishedLayoutFile); // a record file with $schema and id
const report = validate(document, { catalogs: [defaultCatalog] });
const saved = embed(document, { catalogs: [defaultCatalog] }).document; // every record the deck uses, embedded
```

Check the record before copying its ID. A bare id resolves in `catalogs.custom`, then in the records embedded under `catalogs.default`, then in the catalog the host registered for its source (the first registered catalog when the document omits `default`); `name:id` resolves in that group, then in the catalog registered for its source. Nothing is fetched: a host registers catalogs with `{ catalogs }`, and a saved deck embeds what it uses.

Design example:

```json
{
  "design": {
    "theme": "classic",
    "fontScheme": "roboto",
    "colorScheme": {"id": "cool-horizon", "accent1": "#0F4C81"},
    "footer": {"left": {"text": "Working draft"}, "right": {"text": "{{slide.number}}"}}
  },
  "slides": [
    {"title": "Inherits shared design", "text": "The deck sets the base."},
    {"title": "A deliberate exception", "design": {"footer": false}, "text": "This slide suppresses the footer."}
  ]
}
```

A header/footer zone lays its fields out side by side in one row, in the order `image`, `text`, `socials`, `date`, aligned to the zone's edge; `
` breaks lines inside a text. Logos live on the organization (`"organization": {"id": "acme", "name": "Acme", "logo": {"full": "./assets/acme-logo.svg", "icon": "./assets/acme-mark.svg"}}`, each shape a path or `{"onLight": ..., "onDark": ...}`); a zone places one with `"image": "var:organization.logo.icon"` (also `.wordmark`, `.stacked`, a bare `var:organization.logo` for the full logo, and `var:organization.<id>.logo` for a partner), and the onLight or onDark file is chosen per slide background. Covers draw the primary organization's full logo; `design.logo` is only an override (`"var:organization.beta.logo"`) or `false`. Generated values are variables in `text`, written in the order you want with `\n` between lines: `{{organization.name}}`, `{{speaker.name}}, {{speaker.title}}`, `{{slide.section}}`, `{{slide.number}} / {{deck.slideCount}}`, or any built-in such as `{{organization.tagline}}`. A `{{slide.number}}` in header or footer text exports as a native PowerPoint slide-number field; `{{deck.slideCount}}` is fixed text. There are no `organization`, `speaker`, `section` or `slideNumber` flags.

Theme defaults sit below explicit deck and slide design. A colour- or font-scheme object's `id` resolves the base record before its other fields override it; `design.theme` is a reference string. Header/footer/watermark `false` differs from omission; set `"design": {"header": false, "footer": false}` on a title slide to hide inherited furniture there. Header/footer zones write slide numbers as `text` (`"{{slide.number}} / {{deck.slideCount}}"`, `"A-{{slide.number}}"`) and accept `dateFormat` (`"MMM d, yyyy"`, `"yyyy-MM-dd"`). Use a fixed ISO date (`"date": "2026-04-23"` plus `dateFormat`) for packets and archives; `"date": true` is the live current date and needs the host's `date` option. A date and a slide number in one zone sit side by side; a row wider than its zone wraps its text. Dimensions accept presets or explicit inches; don't encode pixels as inches. Backgrounds can be theme slots, hex strings, image sources, or typed theme/solid/gradient/image/pattern objects. A picture background is `{"type":"image","src":"asset:hero","alt":"...","fit":"cover","focus":{"x":0.5,"y":0.7},"recolor":"grayscale","overlay":{"color":"dark1","opacity":0.4,"edge":"bottom"}}`, or the shorthand `"asset:hero"` (a source starting with `asset:`, `https://`, `data:`, `./` or `../` is a cover image; any other string that is not a slot or hex colour is invalid). It fills the slide behind everything and never moves content; a picture that should push the content aside is an image block with `placement`.

That background flexibility applies to deck/slide design overrides. Catalog theme records use a theme-controlled object such as `{"type":"theme","slot":"light2"}`; the slot must be `light1`, `light2`, `dark1`, or `dark2`. Keep a fixed hex background in an explicit `design.background` override. `validate` checks each embedded record against its companion schema; check a published record file with `validateCatalogRecord`.

`design.dimensions` takes a preset (`16:9`, `4:3`, `16:10`, the social-feed ratios `1:1`, `4:5` and `9:16`, `letter`, `a4`, and the aliases `widescreen` and `standard`) or custom inches. `design.watermark` is an image (`{"src":"asset:mark","opacity":0.08}`) or a text stamp (`{"text":"DRAFT","opacity":0.1}`): exactly one of `src` and `text`; the stamp is drawn centered and rotated 30 degrees counterclockwise in the heading font and the theme text color.

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

`registryUrl`, `signal`, and `desiredId` are host-provided. Custom registries can contain `items` with inline `opf` documents or `opfUrl` links. The helper supports PPTX.gallery descriptors, enforces size/origin boundaries, and requires browser CORS for remote requests. It does not scrape arbitrary HTML or fetch fonts or catalogs. Generic galleries should supply self-contained OPF, with every record embedded.

A local workspace snapshot and the public registry can differ. Preserve the selected source and its included records. Validate copied data against the installed OPF version before merging. Use transfer APIs (core `copySlides` carries the records, matching catalog groups by source) or a deliberate ID-remapping merge so imported assets, records and slide IDs cannot alter existing slide references.
