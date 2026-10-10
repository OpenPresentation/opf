# RR-59: forced colors on the deck embed, with Chromium's emulation (2026-10-10)

Item: RR-59 follow-up [opf-render#170](https://github.com/OpenPresentation/opf-render/issues/170) (audit scenario WEB-15, "Accessible embed structure"). Renderer change and test: [opf-render#216](https://github.com/OpenPresentation/opf-render/pull/216).

## Owner decision (2026-10-10)

- **No screen-reader pass was run.** The owner decided against it. The issue allows this outcome: if the pass cannot be run, the public accessibility copy says "not tested with assistive technology". No NVDA, JAWS, VoiceOver or TalkBack run exists for `<opf-deck>`, the player, the speaker view or the SVG preview, so nothing here is evidence about announcements, reading order with a screen reader, or what a screen reader says on slide change. The DOM and ARIA structure is still checked as before (axe-core, the browser's accessibility tree, focus order).
- **Forced colors is verified, with emulation only.** Chromium's forced-colors emulation (`page.emulateMedia({ forcedColors: 'active' })`, with `colorScheme` light and dark). No Windows setting was changed and no contrast theme was turned on. This is not the real Windows contrast theme.

## Environment

| Item | Value |
| --- | --- |
| OS | Windows 11 Home 10.0.26200 |
| Browser | Microsoft Edge 154.0.4258.53 (Chromium), launched by Playwright (`channel: 'msedge'`, which the suite uses locally on Windows) |
| Playwright | 1.63.0 (the version CI pins) |
| Node | 24.21.0 |
| `@openpresentation/opf-render` | 0.18.0, with the change in [opf-render#216](https://github.com/OpenPresentation/opf-render/pull/216) (base `435299d`) |
| `@openpresentation/opf` | 0.18.1 (the renderer's dependency; the core checkout is `cf85102c`) |
| Not involved | opf-pptx and opf-editor (no PPTX or editor code is exercised) |

CI runs the same suite (`browser:forced-colors-browser`) in the pinned Playwright 1.63.0 Chromium container on Linux, and it passed there on head `243a1e0f` of [opf-render#216](https://github.com/OpenPresentation/opf-render/pull/216) (4 of 4 checks green). The Linux Chromium is a second emulation with its own palette (see below), so the suite has seen two browsers.

## What was checked

`test/forced-colors-browser.mjs` in opf-render, four cases: the website-starter embed (`<opf-deck src fonts="/opf-fonts/" thumbnails present>` styled with the site's `--opf-deck-*` tokens, which differ between its light and dark themes) and a bare `<opf-deck>`, each in `colorScheme` light and dark, always with forced colors active. A local server, no network. Each case checks computed style and real screenshot pixels:

1. **Slide boundary** (the viewport frame): a solid border, 1 px or more, in a system colour (never an author colour), different from `Canvas`, contrast at least 3:1 against `Canvas`, and the same colour on at least 95% of the top-border pixels of a screenshot. The slide interior is not one flat colour.
2. **Buttons** (Previous, Next, Present) and **thumbnails**: a drawn border in a system colour that differs from `Canvas`; the buttons also have a system-colour background, so none relies on its background colour. The **current thumbnail** carries an outline of 2 px or more.
3. **Focus ring**, reached with the keyboard (`Tab`): the slide group, Previous, Next, Present and a thumbnail each draw a solid outline of at least 2 px in a system colour that is not `Canvas`, and that colour fills at least half of the frame just outside the control in the screenshot. A control without focus draws no outline.
4. **Disabled controls** (Previous on slide 1): drawn in `GrayText` at full opacity, with a visible border.
5. **Slideshow** (Present, then Exit): Previous, Next, Speaker view and Exit keep a system-colour border and a focus ring (computed and pixels); the slide counter has at least 4.5:1 contrast against what is drawn behind it; the slide is drawn; Exit returns focus to the Present button.
6. **Speaker view** (a second window with the same emulation): the slide boxes, notes and buttons keep a system-colour frame, the focused Next button draws a ring, and the disabled Previous is `GrayText`.

## Result

All four cases pass after one fix. The emulated palette (read from the page with `forced-color-adjust: none` probes):

| Scheme | Canvas | CanvasText / ButtonBorder | Highlight (focus ring) | GrayText |
| --- | --- | --- | --- | --- |
| light | rgb(255, 255, 255) | rgb(0, 0, 0) | rgb(55, 0, 110) | rgb(96, 0, 0) |
| dark | rgb(0, 0, 0) | rgb(255, 255, 255) | rgb(26, 235, 255) | rgb(63, 242, 63) |

In every case: the slide boundary, the three buttons and the thumbnails are solid 1 px frames in `CanvasText`/`ButtonBorder` (a system colour), every focus ring is solid 3 px `Highlight`, the current thumbnail is a 3 px `Highlight` outline, the slideshow and speaker-view controls keep 1 px system borders and 3 px rings, and the slideshow counter's contrast is 21:1.

Screenshots (not committed): per case a full-page deck, one image per focused control, the slideshow and the speaker view. What they show: in both schemes the browser recolours the page to Canvas and CanvasText; the slide's own drawing keeps the SVG's colours (navy with white text; forced colors restyle the HTML around an inline SVG, not its fills), framed by a thin system-colour border; the buttons are bordered boxes with system-colour text and arrows; the focus ring is a thick `Highlight` (purple in light, cyan in dark) around the focused control; the disabled Previous is dark red in light and green in dark (`GrayText`).

### What failed and was fixed

The first run failed on disabled controls only. A control with `aria-disabled="true"` (Previous on the first slide, Next on the last) keeps `opacity: 0.45` under forced colors, so its frame and its focus ring were blended 45% into `Canvas` instead of being drawn in a system colour: the ring was no longer the system `Highlight` colour (no exact ring pixels in the screenshot), and a disabled button looked like a faded enabled one rather than `GrayText`. The fix, in opf-render (`src/element.js` for the deck, `src/player.js` for the slideshow and the speaker view): inside `@media (forced-colors: active)`, `button[aria-disabled="true"] { opacity: 1; color: GrayText; border-color: GrayText; }`. Nothing changes outside forced colors. The suite fails on the old CSS and passes on the new.

### Linux CI, and one test bug it exposed

The first CI run failed only the focus-ring pixel check (every other check passed on Linux). Linux Chromium computes the focus outline as the system colour at alpha 0.8 (`rgba(5, 0, 73, 0.8)` in light, where Windows Edge gives the opaque `rgb(55, 0, 110)`), so the ring is drawn as that colour blended over Canvas (`rgb(55, 51, 109)` over white). The test compared the opaque colour; it now composites the ring over Canvas before comparing, and also requires 3:1 contrast between the drawn ring and Canvas. This was a test defect, not a product one: the ring was drawn in a system colour in both browsers. It also shows that the emulated palette differs between Chromium builds, which is why the suite asserts system colours and not values.

## Caveats

- **Emulation, not the Windows contrast themes.** Chromium's emulation uses its own default forced palette for the emulated scheme (above). The real Windows themes (Aquatic, Desert, Dusk, Night sky, and custom ones) use other system colours; macOS Increase Contrast and other browsers (Firefox, Safari) were not run. The test asserts system colours, not values, so it does not depend on this palette, but it has only seen it.
- **The slide drawing is not recoloured.** An inline SVG keeps its own fills, so slide content is not verified for contrast against any contrast theme; only its boundary and the surrounding controls are.
- **No assistive technology.** See the owner decision above. This note says nothing about screen-reader behaviour, and the public copy says "not tested with assistive technology".
- Edge 154 on Windows is the local browser; CI uses the Playwright Chromium of the pinned Linux container. Neither is a Windows contrast theme.
