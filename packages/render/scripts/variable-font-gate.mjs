// Native advance gate for the Source Serif 4 variable-font rows of opf-render#24 (program
// OpenPresentation Release readiness, RR-15).
//
// Owner decision, 2026-10-01: this one metric check is widened from 0.1 px to 0.15 px. Evidence for
// the choice: Chromium on Linux rounds TrueType HVAR advances where Fontkit and Chromium on macOS keep
// the fractional value, so the two native targets differ by up to 0.135 px on these rows. The worst
// retained delta is 0.1346 px (Source Serif 4 Italic "Light Italic"); SmText Bold, the row #24 names,
// measures 334.06213682353496 px with Fontkit against 334.193115234375 px in Linux Chromium (0.131 px).
// No other row of the 356 retained Fontkit rows exceeds 0.0985 px on Linux or 0.0025 px on macOS.
//
// Only the variable-font metric check uses this value. The 0.1 px reference-pixel gates for static
// fonts (font-variants-browser, font-preparation-browser) and the 0.02 pt native PowerPoint gate are
// unchanged. The tolerance is strict (a delta must be below it), as the 0.1 px gates are.
export const VARIABLE_FONT_METRIC_GATE_PX=.15;
// The unchanged gate this one replaces, kept so reports can still show how many rows exceed it.
export const PREVIOUS_GATE_PX=.1;
