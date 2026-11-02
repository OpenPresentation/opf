// The advance a browser host draws for a pinned run at its natural length (the textLength pin removed), as the browser fixtures
// compare it with the renderer's accepted advance.
//
// Linux Chromium (Skia over FreeType, the pinned Playwright image of CI) sets a face's size in 26.6 fixed point, so it draws a
// size off the 1/64 px grid at that size truncated to 1/64 px, and the run's natural advance scales with it. Composed sizes sit
// on the 0.01 pt grid (1/75 px, RR-16), which meets the 1/64 px grid only at whole pixels: a fractional size such as a stepped
// content title (LH-51: 54 x 11/12 = 49.5 px, snapped to 49.4933 px) draws at 49.484375 px there, 0.19 px short over an 1130 px
// title line (opf#967: Noto Sans KR kore-sentence drew 1129.84375 against 1130.032, the model gives 1129.835). Edge and Windows
// and macOS Chromium draw the size as given (the same run measured 1129.969 in Edge). The pin draws the accepted advance on
// every host; this model only keeps the natural-advance gate exact where the host quantizes the size.

/** The size `size` (px) a host draws at: on Linux, truncated to the 1/64 px grid. */
export function hostFontSize(size, platform = process.platform) {
  return platform === 'linux' ? Math.floor(size * 64 + 1e-6) / 64 : size;
}

/** The natural advance a host draws for a run the renderer accepted at `accepted` px for `size` px. */
export function hostAdvance(accepted, size, platform = process.platform) {
  return size > 0 ? accepted * hostFontSize(size, platform) / size : accepted;
}
