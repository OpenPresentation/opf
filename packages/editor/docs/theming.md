# Theming the editor chrome (CE-06)

The editor's chrome (the source pane, the slide row, the export menu, the presenter's button, the review and design panels, Layout Studio and the default arrangement of `createOpfEditor`) reads only `--opf-ui-*` CSS custom properties. That list is the token contract: a host that sets these values matches its design system, in light and in dark, without touching a component. The slide itself is not chrome: the document's theme, colors and fonts draw it.

`src/styles/tokens.css` defines the values below (and `test/styles.mjs` keeps it equal to this page). `@openpresentation/opf-editor/styles.css` ships them; import it once.

## The contract

| Role | Short name | Token | Light | Dark |
| --- | --- | --- | --- | --- |
| Surface | `background` | `--opf-ui-bg` | `hsl(210 30% 98%)` | `hsl(220 24% 9%)` |
| Surface | `surface` | `--opf-ui-surface` | `hsl(0 0% 100%)` | `hsl(220 22% 11%)` |
| Surface | `muted` | `--opf-ui-muted` | `hsl(214 28% 93%)` | `hsl(220 18% 16%)` |
| Surface | `mutedAlt` | `--opf-ui-muted-2` | `hsl(214 28% 96%)` | `hsl(220 18% 13%)` |
| Text | `text` | `--opf-ui-fg` | `hsl(220 28% 11%)` | `hsl(210 28% 92%)` |
| Text | `textMuted` | `--opf-ui-muted-fg` | `hsl(218 14% 38%)` | `hsl(215 13% 68%)` |
| Accent | `accent` | `--opf-ui-accent` | `hsl(214 57% 28%)` | `hsl(214 57% 52%)` |
| Accent | `accentText` | `--opf-ui-accent-fg` | `hsl(0 0% 100%)` | `hsl(220 24% 9%)` |
| Accent | `accentStrong` | `--opf-ui-accent-strong` | `hsl(214 57% 28%)` | `hsl(214 74% 72%)` |
| Accent | `focus` | `--opf-ui-ring` | `hsl(214 57% 28%)` | `hsl(214 57% 62%)` |
| Border | `border` | `--opf-ui-border` | `hsl(214 22% 83%)` | `hsl(220 17% 24%)` |
| Border | `borderStrong` | `--opf-ui-border-strong` | `hsl(214 22% 72%)` | `hsl(220 17% 34%)` |
| Status | `danger` | `--opf-ui-danger` | `hsl(0 72% 45%)` | `hsl(0 65% 56%)` |
| Status | `warning` | `--opf-ui-warn` | `hsl(28 75% 30%)` | `hsl(32 80% 70%)` |
| Status | `success` | `--opf-ui-success` | `hsl(152 76% 26%)` | `hsl(152 60% 70%)` |
| Code | `codeBackground` | `--opf-ui-code-bg` | `hsl(220 30% 96%)` | `hsl(222 22% 13%)` |
| Code | `codeBorder` | `--opf-ui-code-border` | `hsl(214 18% 84%)` | `hsl(220 16% 24%)` |
| Font | `font` | `--opf-ui-font` | `Inter, system-ui, sans-serif` | same |
| Font | `mono` | `--opf-ui-mono` | `"Geist Mono", ui-monospace, Menlo, monospace` | same |
| Radius | `radiusSmall` | `--opf-ui-radius-sm` | `4px` | same |
| Radius | `radius` | `--opf-ui-radius` | `6px` | same |
| Radius | `radiusMedium` | `--opf-ui-radius-md` | `8px` | same |
| Radius | `radiusLarge` | `--opf-ui-radius-lg` | `12px` | same |
| Size | `controlHeight` | `--opf-ui-control-h` | `32px` (40px with `data-density="touch"`, 44px on a coarse pointer) | same |
| Depth | `shadow` | `--opf-ui-shadow-pop` | `0 8px 24px rgba(0, 0, 0, 0.1)` | `0 8px 24px rgba(0, 0, 0, 0.4)` |
| Motion | `motion` | `--opf-ui-ease` | `120ms ease` (off under `prefers-reduced-motion`) | same |

Rules every component follows, and a host can rely on:

- Every color, radius, font, shadow and transition in `src/styles/*.css` comes from one of these tokens. `test/styles.mjs` fails on a color literal there.
- `surface` is the card, popover and pane background, `background` the page behind them, `muted` and `mutedAlt` the quiet fills (hover, selected row, code-free toolbars), `border` and `borderStrong` the rules and the input outlines.
- `accent` fills the one primary action and marks the current item; `accentText` is the text on it; `accentStrong` is the accent as text or a link on a surface; `focus` is the 2px focus ring.
- `danger`, `warning` and `success` are text and icon colors on a surface, never fills.
- The package's own values are chosen for WCAG AA contrast in these pairs; when you change one, check the pair in both schemes: `text` on `surface`, `textMuted` on `surface`, `accentStrong` on `surface` and `accentText` on `accent`.
- A selection in a code surface is `accent` at 16% over what is behind it; the text keeps its own colors, so `text`, `textMuted`, `accentStrong` and `warning` must keep 4.5:1 against that tint as well (`test/selection-contrast-browser.mjs` measures it in both schemes). The other occurrences of a selected word are `warning` at 16% with a `warning` underline, and the code colors keep 4.5:1 on that tint too (a key in the dark scheme is the closest, 5.3:1). The code views are flagged dark for CodeMirror when the tokens resolve to a dark `color-scheme` and follow a later change of the page, so a host never sets that itself.

## `theme` on `createOpfEditor` (and `<OpfEditor>`)

```js
import { createOpfEditor } from "@openpresentation/opf-editor/workspace";

const editor = createOpfEditor(element, {
  theme: {
    colorScheme: "auto", // "light" | "dark" | "auto" | "inherit" (default)
    tokens: { accent: "hsl(262 60% 38%)", accentStrong: "hsl(262 60% 38%)", focus: "hsl(262 60% 38%)", radius: "4px", font: "var(--font-sans)" },
    dark: { accent: "hsl(262 70% 70%)", background: "#0b0b10", surface: "#14141b" },
  },
});
editor.setTheme({ tokens: { accent: "teal" } }); // later, for example from a theme switcher
```

- `tokens` apply in both schemes. `dark` replaces them (and the package's dark values) while the editor is dark. Names are the short names above or the full `--opf-ui-*` names; any other name throws, so a typo is not silently ignored. Values are any CSS value (`var(--your-token)`, `hsl(...)`, a font stack).
- `colorScheme`: `"light"` and `"dark"` force the scheme for this editor, also inside a page of the other one. `"auto"` follows `prefers-color-scheme` and its changes. `"inherit"` (the default) leaves it to the page: the editor is dark when `<html>` (or any ancestor) has `class="dark"` or `data-theme="dark"`. The editor writes `data-theme` on the element you mounted it in for the first three, and puts back what was there on `destroy()`.
- Applying a theme writes one rule, scoped to the mount element and with more specificity than the package's own light, dark and touch rules, through the CSSOM (no `<style>` text, so a Content-Security-Policy that blocks inline styles does not block it, and a value cannot close the rule). `destroy()` removes it.
- With `slots`, the element you pass is your page: the theme covers it and everything inside it, so your own chrome can read the same tokens.

## Theming without the option

Every component root carries the class `opf-ui` and declares the light defaults on itself, and the dark values under `.dark .opf-ui`, `.opf-ui.dark`, `[data-theme="dark"]` and `:root.dark`. A value set on a wrapper therefore never reaches a component: set the tokens **on the `.opf-ui` elements**, with a selector that outranks those rules. openpresentation.org does it like this:

```css
html .opf-ui,
html.dark .opf-ui {
  --opf-ui-bg: hsl(var(--background));
  --opf-ui-surface: hsl(var(--card));
  --opf-ui-accent: hsl(var(--accent));
  /* ...the rest of the contract... */
}
```

A page that forces light inside a dark page marks `data-theme="light"` on the editor (or an ancestor); the stylesheet then restores the light values for everything inside.

## Fonts

`font` and `mono` are font stacks. The package bundles no font and requests none: load Inter and Geist Mono yourself, or give `font` your own family. The document's slide fonts are separate (the fonts handle you pass to the editor draws them).

## What a host should check

1. Both schemes: open the editor with `colorScheme: "light"` and `"dark"` and look at the source pane, the export menu, the review panel and Layout Studio.
2. Focus: tab through the bar; every control shows the `focus` ring on `surface` and on `background`.
3. A touch device: `controlHeight` grows with `data-density="touch"` (the editor sets it from the `density` option); a custom value is raised to 44px on a coarse pointer by the package.
