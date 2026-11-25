# FR-08 design note: embed (CR 11)

A builder's brief for item FR-08 of the format-requests program (`docs/programs/format-requests/burndown.md` on `main`). It settles what
the review card leaves open. It depends on nothing in the data track (FR-04 to FR-07).

Who decided what:

- **Owner, 2026-11-24**: the names `embed`, `src`, `title` and `aspectRatio` ("I like embed and src and title and aspectRatio I don't get
  poster"); a separate kind from `video` (`cr11-video`).
- **Supervisor, 2026-11-25, on the owner's delegation**: the static picture is an optional `preview` (round 2, `e-preview`); built in
  0.37.0 without waiting for the request text (`e-release`). Third in the cut order, after the gauge and the bullet chart.
- **Analysis, for the supervisor to confirm**: everything else, marked *(analysis)*.

## The need

Decks show live things: a dashboard, a prototype, a map, a form. Today the only ways to point at one are a link in a text run, or a video
placeholder standing in for something that is not a video. An `embed` says what it is: a page that a web presenter may show live, and that
every other output (PDF, PNG, PowerPoint, print, thumbnails) shows as a picture linked to it. Engines never load it; the host decides
whether a page is shown live and from which sites.

## Schema

### `EmbedPayload`

```json
"EmbedPayload": {
  "description": "A live web page shown in a web presenter when its host allows, and as a linked picture everywhere else. A string is shorthand for { \"src\": value }. Engines never load 'src'.",
  "oneOf": [
    { "$ref": "#/$defs/EmbedUrl" },
    {
      "type": "object",
      "additionalProperties": false,
      "required": ["src"],
      "properties": {
        "src": { "$ref": "#/$defs/EmbedUrl" },
        "title": { "type": "string", "minLength": 1, "description": "What the page is, used as the accessible name and on the card. Absent: the site name (the host of 'src' without 'www.')." },
        "aspectRatio": { "type": "number", "exclusiveMinimum": 0, "maximum": 10, "description": "Width to height of the frame, as an image block's aspectRatio (1.6 is 16:10). Absent: 16:9 (1.7777777777777777)." },
        "preview": { "$ref": "#/$defs/ImageSource", "description": "A picture of the page, drawn wherever the page is not shown live: PDF, PNG, PowerPoint, print and thumbnails. Absent: a card with the title, the site name and a link icon." }
      }
    }
  ],
  "examples": [
    "https://app.example.com/dashboards/revenue",
    { "src": "https://app.example.com/dashboards/revenue", "title": "Revenue dashboard", "aspectRatio": 1.6, "preview": "asset:revenue-dashboard" }
  ]
},
"EmbedUrl": {
  "type": "string",
  "pattern": "^https://[^\\s/?#]+[^\\s]*$",
  "maxLength": 2048,
  "description": "An https URL. Any other scheme (http, data, javascript, a relative path) is a schema error."
}
```

- `preview` takes an `ImageSource` (`asset:<id>`, an https URL, a data URI, a relative path), the same as an image's shorthand.
  *(analysis: the burndown says `asset:<id>`; the image forms cost nothing extra and let a host point at a CDN screenshot. If the
  supervisor prefers the narrower form, the pattern is `^asset:`.)*
- No `alt`: `title` is the accessible name. No `allow`, `sandbox` or size keys: what a frame may do is the host's decision, not the deck's.
  No `autoplay` or `interactive` flag. *(analysis: each would be a host policy written into every deck.)*
- `aspectRatio` is a number, as the block option `aspectRatio` of image blocks is today. The block option stays "image payloads only"; on
  an embed block it is a schema error, so there is one place to set the frame. *(analysis)*

### Where it goes

| Place | Change |
| --- | --- |
| `Slide` | A new property `embed` (`EmbedPayload`): a full-slide embed. Its presence infers type `embed`, as `video` does. |
| `ContentPayload` | A new property `embed` (`EmbedPayload`), a leaf payload like `video`; it takes `caption`, as video does, and none of the image-only options (`fit`, `focus`, `aspectRatio`, `recolor`, ...). The `dependentSchemas` that keep one payload per leaf include it. |
| `Slide.type`, `ContentPayload.type` | `embed` joins the enums. |
| `layout.schema.json`, `Region.accepts` | `embed` joins the enum. |
| `narrative.schema.json`, `Beat.type` | `embed` joins the enum. |

Gallery layout records list what a region `accepts` and none lists `embed`. Composition treats a region that accepts `video` as accepting
`embed` too, so no gallery record changes and no layout draws differently. *(analysis: an embed sits where a video would; changing every
record's `accepts` would move the layout goldens for nothing.)* A new record may list `embed` itself.

Generated types: `EmbedPayload`, `EmbedUrl`, and `Slide.embed`, `ContentPayload.embed`.

## Rules

| Id | Severity | When | Message | Path |
| --- | --- | --- | --- | --- |
| schema | error | `src` is not an https URL, or is missing | the schema message | `/.../embed` or `/.../embed/src` |
| `embed-credentials` *(analysis: name)* | warning | `src` holds a user and password (`https://user:pass@...`), or a query parameter named like a secret (`key`, `token`, `secret`, `password`, `sig`, `signature`, `auth`, case-insensitive, with any prefix or suffix such as `api_key`) | `This embed's address carries what looks like a credential ({part}). Anyone with the deck can read it.` | `/.../embed/src` |
| `embed-preview-missing` *(analysis: name)* | warning | `preview` names an asset that is not in `assets`, or a relative path that does not resolve | the existing missing-asset message for images | `/.../embed/preview` |

- The credentials rule is the same test as FR-04's `datasource-credentials`; share the function. *(analysis)*
- An unknown `preview` asset reuses the existing missing-asset finding for images if there is one; the name above is only for the case
  where there is none.
- Errors get conformance cases (the burndown's: an `http:` URL, no `src`); warnings do not.
- No rule against sites: which sites may be shown live is the host's list.

## What each output draws

| Output | Draws |
| --- | --- |
| Web presenter, host allows the site | A sandboxed frame of `src` in the block's frame (see below). |
| Web presenter, host does not allow it, and every other web surface (editor canvas, thumbnails, the MCP viewer, the web player by default) | The static form: `preview`, or the card. Linked to `src` (a click opens it in a new tab). |
| PDF | The static form with a link annotation on the frame to `src`. |
| PNG, print | The static form. |
| PowerPoint | The static form as native parts with a hyperlink to `src` (see below). |

**The frame.** The block's region, shrunk to the largest centered box of `aspectRatio` (as an image block's `aspectRatio` frame is
computed today). The caption sits below it, as for video.

**The static form with `preview`**: the picture, drawn with `contain` inside the frame on the scheme's surface color, so a dashboard
screenshot is never cropped. *(analysis: cover would cut the edges of a data screenshot.)*

**The card without `preview`** *(analysis: the drawing; colors from the color scheme, fonts from the font scheme)*:

- A rounded rectangle filling the frame: the scheme's card surface, a 1 px border in the scheme's border neutral.
- A link icon (the icon set's external-link glyph) in the accent color, top left.
- The title (or the site name) in the heading font, left-aligned, up to three lines, then clipped with an ellipsis.
- The site name in the body font, muted, below the title. Never the full URL: it is long and can carry query strings.
- All text at the readability floor or larger; the card draws at any frame size down to the floor and keeps only the icon below it.

**Live in a web presenter.** The presenter takes a host option, `embeds?: (src: string) => boolean` (default: none is live). When it returns
true for an embed's `src`, the presenter draws an `iframe` in the frame instead of the static form:

- `sandbox="allow-scripts allow-same-origin allow-popups allow-forms"`, `referrerpolicy="no-referrer"`, `loading="lazy"`, no `allow`
  features (camera, microphone, geolocation stay off), `title` set to the embed's title for screen readers.
- The static form is drawn under the frame until the frame loads, and stays if it fails.
- Keyboard: Tab enters the frame only after a click on it; the presenter's slide keys keep working while the frame does not have focus.
  A click on a live frame never changes the slide (the defect fixed for links in opf#1449 must not return here).
- Which presenters take the option: the editor's presenter and the web player. The MCP viewer never shows an embed live: its host page
  forbids frames of other sites. *(analysis)*

## PowerPoint export and import

**Export**:

- With `preview`: a native picture (`p:pic`) in the frame, `descr` set to the title, with `a:hlinkClick` to `src`. The picture's bytes are
  the preview's (decoded and normalized as image export does today).
- Without it: the card as native shapes in a group (rounded rectangle, the icon, two text boxes), each with `a:hlinkClick` to `src`, the
  same treatment the video placeholder gets today.
- A tag `OPF_EMBED_V1` on the picture or the group: `{ "v": 1, "embed": <the authored payload>, "evidence": { "href": "<src>", "media":
  "<hash of the picture part, preview only>" } }`.
- The slide record's content topology records the block as the kind a 0.36.0 importer reads back from those native parts: `image` for the
  picture, a group for the card. The authored `embed` is restored from the tag (or from a top-level key of the slide record, `embeds`,
  keyed by the block path, if the topology cannot carry the reference; a 0.36.0 importer ignores unknown top-level keys of the slide
  record, verified for `entryIds`). *(analysis: an `embed` kind inside the topology would make a 0.36.0 importer drop the whole slide
  record.)*

**Import (0.37)**: the embed is restored while its evidence holds: the hyperlink target still equals `src`, and with a preview, the picture
part's hash still equals `media`. A replaced picture or a changed link imports as what is there (a linked picture, or shapes), with a
`embed-provenance-changed` diagnostic. A file from elsewhere (no tag) imports a linked picture as an image, as today.

**Import (0.36.0, released)**: ignores the unknown `OPF_EMBED_V1` tag and imports a linked picture (image) or a group of shapes. The deck
is valid. The builder proves this with the released importer on the item's test file.

**Native check**: one file with a full-slide embed with a preview, a block embed without one (the card) and a captioned embed beside text.
In PowerPoint: the picture and the card draw, each click opens `src` in a slide show, and after PowerPoint's own save each comes back as
`embed`.

## Editor

- An **Embed** entry in the insert menu: it asks for the address, validates https, and inserts `{ "embed": "<url>" }`.
- The inspector: address, title, aspect ratio (presets 16:9, 16:10, 4:3, 1:1 and a number field), and preview (pick or upload a picture,
  which becomes an asset; remove). It cannot capture a preview: the editor never loads the page.
- The canvas draws the static form. "Open page" opens `src` in a new tab.
- Present mode passes the host's `embeds` option through.
- Conversions: video to embed and back keep `src` and `title` only when `src` is https; image to embed is not offered.

## Markdown and YAML

- The Markdown form of a block with an embed follows the image's: the shorthand string as a property, the object as nested properties.
  *(analysis: the builder reads how `video` is written in Markdown today and does the same.)*
- The round-trip test covers the shorthand, the full form, and a slide embed with a caption.

## Docs, skills, examples

- `docs/content-payloads.md`: an "Embed" section (what it is, what each output draws, the host option, why the deck holds no sandbox
  policy).
- The author skill: when to use `embed` against `video` and against a link in a text run.
- The compatibility matrix: one row.
- One example deck with both forms.

## Examples

Valid:

```json
{
  "name": "Embed",
  "assets": { "revenue-dashboard": "./media/revenue-dashboard.png" },
  "slides": [
    { "title": "Revenue, live", "embed": {
      "src": "https://app.example.com/dashboards/revenue",
      "title": "Revenue dashboard", "aspectRatio": 1.6, "preview": "asset:revenue-dashboard" } },
    { "title": "Try the prototype", "blocks": [
      { "text": "The checkout flow we tested with twelve customers." },
      { "embed": "https://prototype.example.com/checkout", "caption": "Prototype, version 3" } ] }
  ]
}
```

Invalid (schema error at `/slides/0/embed`: `http:`):

```json
{ "slides": [ { "title": "Dashboard", "embed": "http://app.example.com/dashboards/revenue" } ] }
```

Invalid (schema error at `/slides/0/embed`: no `src`):

```json
{ "slides": [ { "title": "Dashboard", "embed": { "title": "Revenue dashboard" } } ] }
```

Warns (`embed-credentials` at `/slides/0/embed/src`):

```json
{ "slides": [ { "title": "Dashboard", "embed": "https://app.example.com/d/revenue?api_key=abc123" } ] }
```

## Edge cases

| Case | Answer |
| --- | --- |
| The same URL as a video and as an embed | Both valid; they are different kinds. The author picks. |
| `src` on a site the host blocks | The static form, linked. No finding: blocking is the host's. |
| A very wide or tall `aspectRatio` (0.2, 10) | Allowed within the schema's range; the frame is the largest box of that ratio in the region. |
| A preview whose ratio differs from `aspectRatio` | `contain` in the frame; the surface color fills the rest. |
| An embed in a region too small for the card's text | The card keeps the icon and the title down to the readability floor, then only the icon. No overflow finding. |
| An embed in a layout region that accepts `video` | Accepted (see Where it goes). |
| An embed in a region that accepts neither `video` nor `embed` | The existing "kind not accepted" behavior for any kind. |
| Variables in `src` (`{{dashboardUrl}}`) | Not supported in 0.37.0: `src` is a literal URL. A `url` variable can be added later. *(analysis)* |
| A deck converted to a single PNG with an embed | The static form. |
| A PowerPoint user changes the link target | Imports as a linked picture or shapes, not as an embed (the evidence rule). |

## Decisions the card leaves open, with the option taken

| Question | Option taken | Why |
| --- | --- | --- |
| What `preview` accepts *(analysis)* | `ImageSource` (asset, https, data URI, relative path) | Same forms as an image; a narrower pattern is a one-line change if preferred. |
| Sandbox and allowed sites in the deck? *(analysis)* | No: host options only | Policy belongs to whoever runs the presenter. |
| Preview fit *(analysis)* | `contain` on the surface color | Screenshots of data must not be cropped. |
| The card's drawing *(analysis)* | Surface card, link icon, title, site name; no URL | Readable at small sizes; no query strings printed. |
| Gallery records' `accepts` *(analysis)* | Unchanged; a region that accepts `video` accepts `embed` | No layout or golden moves. |
| The block option `aspectRatio` on an embed *(analysis)* | A schema error; the frame is set inside `embed` | One place for one setting. |
| Which presenters go live *(analysis)* | The editor's presenter and the web player, with the host's `embeds` option; never the MCP viewer | Only surfaces whose host can decide. |
| How the 0.36.0 importer stays able to read it *(analysis, confirm in the build)* | The topology records `image` or a group; the embed rides in `OPF_EMBED_V1` or a top-level slide-record key | An unknown kind in the topology would drop the slide record. |
| Credentials in `src` *(analysis)* | A warning, sharing FR-04's test | The same risk as a data source address. |
