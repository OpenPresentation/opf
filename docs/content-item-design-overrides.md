# Possible Content Payload Design

This is a parking-lot note for design controls intentionally removed from slide content payloads while the v1 content model stabilizes.

Current principle: root slide payload fields and promoted region payloads should describe what the slide contains. Layout and rendering decide how it looks. If per-payload styling returns later, it should live in an explicit override surface rather than mixing presentation controls into the base content payload.

**Standing requirement for any styling surface that does return:** every color field must accept the shared `ColorRef` forms — literal hex, a color-scheme slot or role name, and a `var:<id>` variable reference — from its first release, never hex alone. Rich-text runs and styled table cells already follow this (see [`content-payloads.md`](./content-payloads.md) → "Color references"); the 0.10 styled-cell surface initially shipped hex-only and had to be widened, which is the failure mode this requirement exists to prevent. A styling surface that ships hex-only freezes every styled deck's palette outside the design system and breaks re-theming.

## Possible Shape

```jsonc
{
  "title": "Revenue",
  "left": {
    "text": "Revenue grew 28%",
    "design": {
      "text": {
        "alignment": "center"
      }
    }
  }
}
```

Open question: whether overrides belong inline on each content payload, in `slides[].design`, or in a reusable style catalog keyed by region key or payload `type`.

## Deferred Fields

These fields were deliberately kept out of `ContentPayload` for now:

| Area | Candidate fields |
| --- | --- |
| Placement | `position`, `size`, `zIndex`, `rotation` |
| Text | `style`, `fontSize`, `fontFamily`, `color`, `alignment`, `lineHeight`, `textTransform`, `verticalAlignment` |
| Image/media | `fit`, `borderRadius`, `shadow`, `opacity`, `crop`, `focalPoint` |
| Chart | `chartPreset`, `options`, `legend`, `showValues`, `showGrid`, `stacked`, `xAxis`, `yAxis`, palette overrides |
| Table | `tableStyle`, `stripedRows`, `compact`, border colors, header colors |
| Shape | `fill`, `stroke`, `cornerRadius`, `path` |
| Code | `theme`, `showLineNumbers`, syntax-highlighting theme |

## Decision Criteria

Bring these back only when there is a concrete renderer or authoring workflow that needs them. Prefer small, typed override objects over a large flat bag of visual fields on every content payload.
