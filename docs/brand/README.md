# OPF brand files

The Open Presentation Format mark is curly braces around a solid rounded slide. It comes in two forms, both drawn on a 64×64 grid with plain hex colors (no CSS variables), so the files render the same everywhere.

| File | Form | Use it for |
| --- | --- | --- |
| `opf-logo.svg` | Logo, `#1F4270` on a transparent ground | Light backgrounds: headers, READMEs, docs, slides, anywhere the mark sits beside text or larger than 32px |
| `opf-logo-dark.svg` | Logo, `#83B0EC` on a transparent ground | Dark backgrounds, the same places |
| `opf-icon.svg` | Icon, white glyphs on a rounded `#1F4270` tile | Favicons and app icons at 32px and larger, apple-touch-icon, PWA and social avatars |
| `opf-icon-16.svg` | Icon with the 16px weights (heavier braces, smaller slide) | Favicons and other icons rendered at 16px |

Notes:

- The logo's brace stroke is 4. At 32px or smaller, raise it to 5.
- The icon's brace stroke depends on size: 5.5 at 64px and above (`opf-icon.svg`), 6.5 around 32px, 7.5 at 16px (`opf-icon-16.svg`).
- Use the logo for the mark beside the "OPF" or "Open Presentation" name, and the icon where the mark stands alone in a square.
- The mark is decorative next to a visible name; give a standalone use an accessible name such as "Open Presentation Format".
- On a page that switches between light and dark, use a `<picture>` element with `prefers-color-scheme` to pick `opf-logo.svg` or `opf-logo-dark.svg`, as the [README](../../README.md) does.
