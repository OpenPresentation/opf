# Styling the editor's chrome with plain CSS (CE-29)

The editor's chrome (the toolbar and the parts in it, the slide navigator, the thumbnail strip and the `<opf-editor>` element) is plain DOM with stable class names, state attributes and `--opf-ui-*` tokens. This page is the contract: everything listed here keeps working across releases, and `test/styling-contract.mjs` fails when a listed class, attribute, token or icon name stops existing in the part's source. Anything not listed (a DOM nesting, a class without the part's prefix, an inline style) is internal. The slide itself is not chrome: the document's theme, colors and fonts draw it.

There are four levers, from the lightest to the most specific:

1. **Tokens.** [Theming](theming.md) lists every `--opf-ui-*` token. The component tokens below (`--opf-ui-bar-*`, `--opf-ui-title-*`, `--opf-ui-z-overlay`) restyle the bar, the deck title and the expanded editor's layer in one value. Pass them as `theme.tokens` (`{ barBackground: "#111", titleFont: "Georgia, serif" }`), or set them in CSS on the `.opf-ui` elements with a selector that outranks `.opf-ui`, such as `html .opf-ui { --opf-ui-bar-gap: 12px; }`: every component root declares the tokens on itself, so a value on a wrapper does not reach it.
2. **Classes and state attributes.** Select the root class, or an inner class, and set any property. The attributes below say what state a part is in (`data-state`, `data-density`, `data-severity`, `aria-pressed`, `aria-expanded`, `data-opf-expanded`); style them instead of watching the DOM.
3. **The layered stylesheet.** `@openpresentation/opf-editor/styles.layered.css` is `styles.css` inside `@layer opf { ... }`. A rule of yours outside any layer then beats the package's rule whatever its specificity, so one class is enough and the order of the two stylesheets does not matter. With the plain `styles.css` your rule needs the same specificity and has to come later. The one exception is `!important`: layers invert it, so the expanded editor's `!important` box (below) stays above an unlayered `!important`.
4. **Icons.** Each part that draws an icon takes an `icons` option: an SVG element, a function returning one, or SVG path data (24x24, stroked, `currentColor`). The names are listed per part. The icon is `<svg class="opf-icon" data-opf-icon="<name>" aria-hidden="true" focusable="false">`, so `.opf-icon[data-opf-icon="more"]` styles one icon and the part's own class (`.opf-nav-icon`) sizes all of them.

```js
import { createSlideNavigator } from "@openpresentation/opf-editor/slide-navigator";

createSlideNavigator(container, {
  icons: {
    previous: "M15 6l-6 6 6 6",           // path data
    next: () => myChevronElement.cloneNode(true), // or a function, or an SVG element
  },
});
```

The examples below assume the layered stylesheet (lever 3). Every table below has the columns `Hook`, `Kind` and `What it is`. A kind is `root` (the class the part's element carries), `class` (an inner element), `attribute` (a state or a marker), `token` (a custom property the part's CSS reads) or `icon` (a name for the `icons` option). Sizes follow `--opf-ui-control-h` (32px, 40px with `data-density="touch"`, 44px on a coarse pointer); keep a control at least 44px high there.

## Toolbar

The bar is `.opf-ws-bar` (the header the workspace builds, or the element you give `toolbar`'s container) holding `.opf-tb`, one row that never wraps. Items that do not fit move into the `⋯` menu.

| Hook | Kind | What it is |
| --- | --- | --- |
| `.opf-tb` | root | The row of items. Also `.opf-ui`, so it declares the tokens on itself. |
| `.opf-ws-bar` | class | The header around the row in the workspace's default arrangement: the background, the rule below and the padding. |
| `.opf-tb-item` | class | The slot of one named item. |
| `.opf-tb-spacer` | class | The free space between items (`spacer`). |
| `.opf-tb-divider` | class | A 1px rule between two visible items (`\|`). |
| `.opf-tb-more` | class | The slot of the `⋯` item; hidden while nothing is collapsed. |
| `.opf-tb-more-button` | class | The `⋯` button. |
| `.opf-tb-more-icon` | class | Its glyph. |
| `.opf-tb-menu` | class | The overflow menu (`role="menu"`). |
| `.opf-tb-menu-item` | class | One entry of the menu. |
| `.opf-tb-menu-separator` | class | A rule between groups of entries. |
| `data-opf-toolbar-item` | attribute | On every slot: the item name (`title`, `history`, `export`, ...). Select `[data-opf-toolbar-item="export"]`. |
| `data-density` | attribute | `comfortable` or `touch`. |
| `data-overflowing` | attribute | On the row while at least one item is in the menu. |
| `data-collapsed` | attribute | On a slot whose item moved into the menu (the slot is hidden). |
| `aria-expanded` | attribute | On the `⋯` button: `true` while the menu is open. |
| `aria-checked` | attribute | On a menu entry that is a toggle. |
| `--opf-ui-bar-bg` | token | The bar's background. Default `--opf-ui-surface`. |
| `--opf-ui-bar-fg` | token | The bar's text color. Default `--opf-ui-fg`. |
| `--opf-ui-bar-border` | token | The rule under the bar. Default `--opf-ui-border`. |
| `--opf-ui-bar-gap` | token | The space between items. Default `8px`. |
| `--opf-ui-bar-padding` | token | The padding of `.opf-ws-bar`. Default `6px 12px`, and `4px 8px` in the `embed` layout (set it with `theme.tokens`, or with a selector as specific as `html .opf-workspace[data-opf-layout="embed"]`). |
| `--opf-ui-bar-height` | token | The bar's minimum height. Default `0px`. |
| `--opf-ui-control-h` | token | The height of the `⋯` button and the menu entries. |
| `more` | icon | The `⋯` button (`createToolbar`'s `icons.more`). |

A dark toolbar over a light page: the tokens go on the bar and on every part inside it, because each part root redeclares them.

```css
.opf-ws-bar,
.opf-ws-bar .opf-ui {
  --opf-ui-bar-bg: #111827;
  --opf-ui-bar-fg: #f9fafb;
  --opf-ui-bar-border: #374151;
  --opf-ui-surface: #1f2937;
  --opf-ui-fg: #f9fafb;
  --opf-ui-muted: #374151;
  --opf-ui-muted-fg: #d1d5db;
  --opf-ui-border: #374151;
}
```

## Deck title

The `title` item: an input that looks like text until it is hovered or focused. Enter commits and keeps the focus in the field, blur commits, Escape reverts.

| Hook | Kind | What it is |
| --- | --- | --- |
| `.opf-title` | root | The wrapper. |
| `.opf-title-input` | class | The text field. |
| `data-state` | attribute | On the root: `editable`, `readonly` or `disabled`. |
| `data-density` | attribute | `comfortable` or `touch` (40px). |
| `aria-disabled` | attribute | On the input while the document cannot be edited. |
| `--opf-ui-title-font` | token | The font family. Default `--opf-ui-font`. |
| `--opf-ui-title-size` | token | The font size. Default `15px`. |
| `--opf-ui-title-weight` | token | The font weight. Default `600`. |
| `--opf-ui-title-fg` | token | The text color. Default `--opf-ui-fg`. |

The deck title in a serif heading face:

```css
html .opf-ui {
  --opf-ui-title-font: "Source Serif 4", Georgia, serif;
  --opf-ui-title-size: 18px;
  --opf-ui-title-weight: 700;
}
```

## Expand

The `expand` item: an icon button that makes the editor fill the window in place.

| Hook | Kind | What it is |
| --- | --- | --- |
| `.opf-expand-button` | root | The toggle button. Also `.opf-ui`. |
| `.opf-expand-icon` | class | Its glyph. |
| `data-opf-expanded` | attribute | On the editor's host element while it is expanded: the element becomes a fixed overlay (`position`, `inset`, `width`, `height`, `margin` and `z-index` are `!important`; style its `background` and `color`). |
| `data-expanded` | attribute | On `.opf-workspace` while expanded. |
| `aria-pressed` | attribute | On the button: `true` while expanded. |
| `aria-disabled` | attribute | On the button while expanding is not allowed. |
| `data-density` | attribute | `comfortable` or `touch`. |
| `--opf-ui-z-overlay` | token | The overlay's `z-index`. Default `1000` (the presenter is at 2000). The expanded element is the one you mounted the editor in, which is not a `.opf-ui`: set the token on it or on an ancestor (or in `theme.tokens`). |
| `--opf-expand-z` | token | The older name; it wins over `--opf-ui-z-overlay` when set. |
| `expand` | icon | Shown while the editor is not expanded. |
| `collapse` | icon | Shown while it is expanded. |

An expanded editor above a sticky site header at `z-index: 5000` (the editor is mounted in `<div id="editor">`), with a tinted page behind it:

```css
#editor {
  --opf-ui-z-overlay: 6000;
}
[data-opf-expanded] {
  background: #f3f4f6;
}
```

## Design menu

The `design` item: a button with a popover (a bottom sheet on a phone) that sets the theme, colors, fonts and the slide's layout.

| Hook | Kind | What it is |
| --- | --- | --- |
| `.opf-design-menu` | root | The button and its popover. Also `.opf-ui`. |
| `.opf-design-menu-trigger` | class | The button. |
| `.opf-design-menu-trigger-label` | class | The button's text. |
| `.opf-design-menu-popover` | class | The popover or sheet (`role="dialog"`). |
| `.opf-design-menu-scrim` | class | The backdrop of the sheet. |
| `.opf-design-menu-head` | class | The sheet's header row. |
| `.opf-design-menu-title` | class | The heading. |
| `.opf-design-menu-close` | class | The close button of the sheet. |
| `.opf-design-menu-menu` | class | The list of choices (`role="menu"`). |
| `.opf-design-menu-group` | class | One section (Theme, Colors, Fonts, Layout). |
| `.opf-design-menu-group-label` | class | The section's heading. |
| `.opf-design-menu-item` | class | One choice (`role="menuitemradio"`). |
| `.opf-design-menu-label` | class | The choice's name. |
| `.opf-design-menu-swatches` | class | The color dots on a choice. |
| `.opf-design-menu-check` | class | The mark on the chosen row. |
| `.opf-design-menu-more` | class | The "More design options" row. |
| `.opf-design-menu-empty` | class | The text shown when there is nothing to choose. |
| `data-mode` | attribute | On the root: `popover` or `sheet`. |
| `data-density` | attribute | `comfortable` or `touch`. |
| `data-section` | attribute | On a choice: `theme`, `colors`, `fonts` or `layout`. |
| `data-value` | attribute | On a choice: the record or layout id. |
| `aria-checked` | attribute | On a choice: `true` for the one in use. |
| `aria-expanded` | attribute | On the button: `true` while open. |
| `--opf-ui-shadow-pop` | token | The popover's shadow. |
| `--opf-ui-radius-md` | token | The popover's corners. |
| `trigger` | icon | The palette on the button. |
| `close` | icon | The X in the sheet. |
| `check` | icon | The mark on the chosen row. |

A wider popover with square corners:

```css
.opf-design-menu-popover {
  width: 360px;
  border-radius: 0;
}
```

## Review pill

The `review` item: one status button that opens the Review panel. Not color alone: every state has a glyph and words.

| Hook | Kind | What it is |
| --- | --- | --- |
| `.opf-review-pill` | root | The button. |
| `.opf-review-pill-icon` | class | The glyph. |
| `.opf-review-pill-text` | class | "Valid", "3 issues", "Checking...". |
| `data-state` | attribute | `checking`, `valid`, `issues` or `unavailable`. |
| `data-severity` | attribute | With `issues`: the most severe level present, `error`, `warning` or `info`. |
| `data-density` | attribute | `comfortable` or `touch`. |
| `--opf-ui-success` | token | The glyph of `valid`. |
| `--opf-ui-danger` | token | The glyph of `error`. |
| `--opf-ui-warn` | token | The glyph of `warning`. |
| `--opf-ui-accent-strong` | token | The glyph of `info`. |
| `valid` | icon | No findings. |
| `error` | icon | The most severe finding is an error. |
| `warning` | icon | ... a warning. |
| `info` | icon | ... a note. |
| `checking` | icon | Before the first count. |
| `unavailable` | icon | The review could not run. |

A pill-shaped status, filled for errors:

```css
.opf-review-pill {
  border-radius: 999px;
  padding-inline: 14px;
}
.opf-review-pill[data-severity="error"] {
  background: var(--opf-ui-danger);
  color: var(--opf-ui-surface);
}
.opf-review-pill[data-severity="error"] .opf-review-pill-icon {
  color: inherit;
}
```

## Help

The `help` item: a button, and the `?` key, that open the keyboard shortcuts sheet.

| Hook | Kind | What it is |
| --- | --- | --- |
| `.opf-help-button` | root | The toolbar button. |
| `.opf-help-icon` | class | Its glyph. |
| `.opf-help-sheet` | class | The overlay of the open sheet (also `.opf-shortcuts`). |
| `.opf-shortcuts-dialog` | class | The dialog box (`role="dialog"`). |
| `.opf-shortcuts-head` | class | The header row. |
| `.opf-shortcuts-title` | class | The heading. |
| `.opf-shortcuts-close` | class | The close button. |
| `.opf-help-close-icon` | class | The close button's glyph, when you give a `close` icon (otherwise it reads "×"). |
| `.opf-shortcuts-search` | class | The filter field. |
| `.opf-shortcuts-list` | class | The scrolling list. |
| `.opf-shortcuts-group` | class | One group of shortcuts. |
| `.opf-shortcuts-group-title` | class | The group's heading. |
| `.opf-shortcuts-row` | class | One shortcut. |
| `.opf-shortcuts-name` | class | What it does. |
| `.opf-shortcuts-keys` | class | Its keys. |
| `.opf-shortcuts-key` | class | One key cap. |
| `aria-expanded` | attribute | On the button: `true` while the sheet is open. |
| `data-density` | attribute | `comfortable` or `touch`. |
| `help` | icon | The question mark on the button. |
| `close` | icon | Replaces the "×" of the close button. |

A narrower sheet with a brand-colored heading:

```css
.opf-shortcuts-dialog {
  max-width: 480px;
}
.opf-shortcuts-title {
  color: var(--opf-ui-accent-strong);
}
```

## Toolbar actions

The `actions` item: the host's own buttons, each with a label and an optional icon (per action, `icon` in the action: an SVG element, a function or path data; there are no named icons).

| Hook | Kind | What it is |
| --- | --- | --- |
| `.opf-actions` | root | The group (`role="group"`); hidden while there are no actions. |
| `.opf-actions-button` | class | One button. |
| `.opf-actions-label` | class | Its text. |
| `.opf-actions-icon` | class | Its glyph. |
| `.is-primary` | class | On the button of an action with `primary: true`. |
| `data-action` | attribute | On the button: the action id. |
| `aria-pressed` | attribute | On a toggle action: its state. |
| `data-density` | attribute | `comfortable` or `touch`. |
| `--opf-ui-accent` | token | The fill of a primary button. |

Square, outlined actions with a primary one in the accent color:

```css
.opf-actions-button {
  border-radius: 0;
}
.opf-actions-button.is-primary {
  background: var(--opf-ui-accent);
  color: var(--opf-ui-accent-fg);
}
```

## Slide navigator

The `counter` item: previous and next buttons around a `01 / 03` counter.

| Hook | Kind | What it is |
| --- | --- | --- |
| `.opf-nav` | root | The group. |
| `.opf-nav-button` | class | A previous or next button. |
| `.opf-nav-icon` | class | Its arrow. |
| `.opf-nav-counter` | class | The `01 / 03` text (monospace). |
| `data-action` | attribute | On a button: `previous` or `next`. |
| `data-index` | attribute | On the root: the 0-based slide index. |
| `data-count` | attribute | On the root: the number of slides. |
| `data-density` | attribute | `comfortable` or `touch`. |
| `--opf-ui-mono` | token | The counter's font. |
| `previous` | icon | The previous arrow. |
| `next` | icon | The next arrow. |

A counter in the page's body font:

```css
.opf-nav-counter {
  font-family: inherit;
  font-weight: 600;
}
```

## Thumbnail strip

A `nav` of real slide renders. With `actions: true` it also manages slides: a trailing add button and a context menu on each thumbnail.

| Hook | Kind | What it is |
| --- | --- | --- |
| `.opf-thumbs` | root | The strip. |
| `.opf-thumbs-list` | class | The list that scrolls. |
| `.opf-thumbs-slot` | class | One list item. |
| `.opf-thumbs-item` | class | The button of one slide; `aria-current="true"` marks the current one. |
| `.opf-thumbs-frame` | class | The box that holds the slide's render. |
| `.opf-thumbs-label` | class | The row under the render. |
| `.opf-thumbs-index` | class | The slide number. |
| `.opf-thumbs-title` | class | The slide title. |
| `.opf-thumbs-note` | class | The "Hidden" note. |
| `.opf-thumbs-status` | class | The screen-reader status line. |
| `.opf-thumbs-add-slot` | class | The list item of the add button (`actions`). |
| `.opf-thumbs-add` | class | The add button. |
| `.opf-thumbs-add-icon` | class | Its glyph. |
| `.opf-thumbs-menu` | class | The context menu and the layout menu of the add button (`role="menu"`). |
| `.opf-thumbs-menu-item` | class | One entry. |
| `.opf-thumbs-menu-heading` | class | A heading in the layout menu. |
| `.opf-thumbs-menu-group` | class | A group of entries. |
| `.opf-thumbs-menu-separator` | class | A rule between entries. |
| `aria-current` | attribute | On the current slide's button. |
| `aria-expanded` | attribute | On the add button while its menu is open. |
| `data-state` | attribute | On a frame: `pending`, `ready` or `error`. |
| `data-hidden` | attribute | On a slide's button: `true` for a hidden slide. |
| `data-untitled` | attribute | On the title: `true` when the slide has no title. |
| `data-orientation` | attribute | On the root: `horizontal` or `vertical`. |
| `data-density` | attribute | `comfortable` or `touch`. |
| `data-actions` | attribute | On the root: `true` with `actions`. |
| `data-readonly` | attribute | On the root: `true` while the document cannot be edited. |
| `--opf-ui-accent` | token | The current slide's ring. |
| `add` | icon | The `+` of the add button. |

A strip with a thicker ring and a round add button:

```css
.opf-thumbs-item[aria-current="true"] .opf-thumbs-frame {
  outline-width: 3px;
}
.opf-thumbs-add {
  border-radius: 50%;
}
```

## The element

`<opf-editor>` is a block element that holds the editor; the editor mounts in a `div` inside it. Its default box (`display: block`, `position: relative`, `height: 600px`, `min-height: 240px`) is written with `:where()`, so any rule of yours wins, and you size and frame it like any block.

| Hook | Kind | What it is |
| --- | --- | --- |
| `opf-editor` | root | The custom element. Give it a `width`, `height`, `border`, `border-radius` or `aspect-ratio`. |
| `data-opf-element-host` | attribute | On the inner `div` the editor mounts in (height 100%). |
| `data-opf-state` | attribute | On the element: `loading`, `ready` or `error`. |
| `--opf-ui-z-overlay` | token | The layer of the editor while it is expanded; set it on the `opf-editor` element. |

A framed, rounded embed that fades in once ready:

```css
opf-editor {
  height: 420px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  overflow: hidden;
}
opf-editor[data-opf-state="loading"] {
  opacity: 0.5;
}
```
