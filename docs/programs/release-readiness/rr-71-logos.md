# RR-71: logos live on the organization; zones lay out in a row

Core part of design §3 of `0.18-consistent-api.md` (opf#521). The renderer, PPTX and editor parts are RR-72. Every
decision below is an agent decision, vetoable, except those marked **decided by the owner (2026-10-09)**; each says
what changing it would cost.

## The format

- `Organization.logo` is one path or Asset (every shape, every background), or `{ full, stacked, icon, wordmark }`,
  each a path or Asset or `{ onLight, onDark }` (`$defs` `OrganizationLogo` and `LogoSource`).
- Removed with no alias: `$defs.LogoSet`, `design.logo` as an asset or LogoSet, `HeaderFooterItem.logo`.
- `design.logo` (deck and slide) is a logo reference (`var:organization.beta.logo`, `var:organization.logo.wordmark`)
  or `false`.
- References: `var:organization.logo`, `var:organization.logo.<shape>`, `var:organization.<id>.logo`,
  `var:organization.<id>.logo.<shape>`, whole field only, slide-scoped.

## Decisions

1. **The root key stays `organization`** (object or array). The design's "organizations[]" means its entries. Renaming
   it would break every deck for no gain.
2. **Fallbacks.** The requested shape, then `full`, then the first defined of `wordmark`, `stacked`, `icon`. Within a
   shape, the missing one of `onLight`/`onDark` uses the other. A plain asset serves every shape (`variant: 'default'`).
3. **`onLight` means "for light backgrounds"** (usually dark artwork). The 0.17 LogoSet `dark` ("dark-colored, for
   light backgrounds") maps to `onLight`, and `light` maps to `onDark`. `default` fills both. **Decided by the owner
   (2026-10-09).**
4. **A named shape in `design.logo` wins over the consumer's shape.** `var:organization.logo.wordmark` draws the
   wordmark on covers and as picture bullets. A bare `var:organization.beta.logo` picks only the organization: covers
   take its `full`, bullets its `icon`. The alternative (the consumer always picks the shape) would make a shaped
   override mean nothing on covers.
5. **An override never falls back.** `design.logo` naming an organization without a logo draws nothing, with a
   `variable-builtin-missing` warning; it does not quietly draw the primary logo. `false` hides the logo at the level
   that sets it (a slide's reference re-enables it under a deck `false`). **Decided by the owner (2026-10-09).**
6. **Logo references are whole-field only.** An inline `{{organization.logo}}` is `variable-unknown-builtin`. Inline
   it would give a file path in text, never what an author wants. `organization.logo` is no longer a deck-wide
   built-in.
7. **Where a reference resolves.** `resolveVariables` keeps it where a slide reaches it (`/slides/**`, the deck's
   header and footer, `/design/logo`). Elsewhere (a deck `design.watermark` or `background`) no slide background
   applies: it resolves deck-wide as on a light background, so those fields still get a real asset.
   `resolveSlideVariables(slide, { slideNumber, slideCount, presentation, darkBackground })` resolves it in a slide's
   own fields (not its `design.header`/`footer`/`logo`). A reference to an organization without a logo is omitted
   there, like an unfilled optional variable; an unknown one stays as written (validation reports it).
   `resolveSlideContext` passes its `darkBackground`.
8. **Name collision.** `organization.logo.<x>`: a shape name wins over an organization whose id is `logo`. Any other
   `<x>` addresses that organization's field when one with id `logo` exists. The built-in name grammar grows to three
   segments after the root, so a four-part `speaker.*` name is now `variable-unknown-builtin` instead of literal text.
9. **`resolveLogo` stays on `/composition`**, not the root: the root-exports test keeps layout-engine names off the
   root. `LOGO_SHAPES` and the logo types are on the root. Options: `shape` replaces `slot`, plus `reference`. The
   result carries `shape`, `variant` (`onLight`/`onDark`/`default`), the canonical `reference` (for PPTX round trips)
   and `designPath` when an override chose it.
10. **Zone row geometry.** Order: image, text, socials, date, mirrored in a right-to-left deck. `FURNITURE_GAP` is 12
    reference pixels at a 720-pixel short edge. The row is flush left, centered or flush right like the zone.
    - Each part is vertically centered on the row's tallest part.
    - Rows start at the band's top edge, as 0.17 zones did. Centering rows across zones would move single-part zones,
      so it is left for RR-72 to decide with native evidence. RR-72 left it: aligning row text with single-part text moves
      the band edges and so the body ([rr-72-master-furniture.md](rr-72-master-furniture.md), decision 8).
    - With other parts, a text part is as wide as its longest line. A lone text part keeps the full zone width, so
      single-part zones do not move.
    - When the row is too wide, text parts share what remains: narrow parts keep their width and the rest wrap at an
      equal share. Wrapping, not an error, keeps 0.17 decks that stacked long text exportable.
    - Beside other parts an image is at most `FURNITURE_IMAGE_SHARE` (40%) of the zone's width: the smaller of its
      aspect width at the band height and that share, at the same height (consumers fit the image inside its box). A
      wide logo therefore cannot starve the text. A lone image keeps its own width, so single-part zones do not move.
      Found by the renderer on a 720 px portrait canvas, where a 4:1 logo left a 47 px text box.
    - Text never breaks inside a word silently. Beside other parts, a soft line break between two letters or digits of
      a space-separated script (a word wider than its share at the readability floor) is `text-overflow` at the
      part's text path, like any repeated text that does not fit. Scripts written without spaces (Han, kana, Thai,
      Lao, Khmer, Myanmar, Tibetan) break between characters as before. Single-part zones keep their 0.17 behavior.
    - A row that cannot fit (no room left for text) is `text-overflow` at the zone's path; with the image cap this
      is a guard only.
11. **Zone image parts from a logo reference.** `field: 'image'`, `generated: false`, `image` = the resolved asset,
    `sourcePath` = the organization path (`organization.0.logo.icon.onDark`), `reference` = the reference as written.
    An unresolvable reference is `unresolved-content` at `<zone>.image`.

## Migration (`migrate-rr71.mjs`, kept outside the repository)

- LogoSet → shapes by meaning (decision 3). A deck `design.logo` moves onto the primary organization's `logo`.
  `logo: true` → `image: "var:organization.logo.icon"`.
- The gallery examples come from `scripts/generate-example-suite.mjs`, which now writes the logo on the organization.
  Same assets, so no pixels move.
- Flagged, both **decided by the owner (2026-10-09)**:
  - `technical/asset-source-forms` had no organization. The script created `{ id: 'brand', name: 'Asset Source Forms' }`.
  - `technical/header-footer-logo-set` had an organization logo different from its LogoSet. The LogoSet won, as it
    did on 0.17 covers.
- Pixels move only where a zone has more than one part. Among the bundled examples that is
  `technical/header-footer-logo-set` (footer: the logo icon beside the organization name).
