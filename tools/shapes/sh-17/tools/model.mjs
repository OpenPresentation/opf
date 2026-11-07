// The fitted models (to be ported to core arrangements.ts): rectangles relative to the frame's top left, in points.
export const S = {
  chevron1: [1024, 538, 365.5, 276.5, 222.5, 186, 160, 140.25, 124.875, 112.5].map(v => v / 1024),
  process1: [1024, 426.5, 269, 196.75, 155, 128, 108.875, 94.75, 83.875, 75.25].map(v => v / 1024),
  process2: [1024, 409.5, 256, 186, 146.25, 120.375, 102.375, 89, 78.75, 70.5].map(v => v / 1024),
};
export function model(layout, W, H, n) {
  const out = [];
  if (layout === 'chevron1') {
    const s = n === 1 && .4 * W > H ? 1023 / 1024 : S.chevron1[n - 1], w = s * W, h = Math.min(.4 * w, H), x0 = (W - w * (.9 * n + .1)) / 2, y = (H - h) / 2;
    for (let i = 0; i < n; i++) out.push({kind: 'node', x: x0 + .9 * w * i, y, w, h});
  } else if (layout === 'process1') {
    const s = n === 1 && .6 * W > H ? 1023 / 1024 : S.process1[n - 1], w = s * W, h = Math.min(.6 * w, H), x0 = (W - w * (1.4 * n - .4)) / 2, y = (H - h) / 2;
    for (let i = 0; i < n; i++) { out.push({kind: 'node', x: x0 + 1.4 * w * i, y, w, h}); if (i < n - 1) out.push({kind: 'arrow', x: x0 + 1.4 * w * i + 1.1 * w, y: H / 2 - .124 * w, w: .212 * w, h: .248 * w}); }
  } else {
    const s = n === 1 && 1.8 * H > W ? 1023 / 1024 : S.process2[n - 1], h = s * H, w = Math.min(1.8 * h, W), y0 = (H - h * (1.5 * n - .5)) / 2, x = (W - w) / 2;
    for (let i = 0; i < n; i++) { out.push({kind: 'node', x, y: y0 + 1.5 * h * i, w, h}); if (i < n - 1) out.push({kind: 'arrow', x: W / 2 - .1875 * h, y: y0 + 1.5 * h * i + 1.25 * h - .225 * h, w: .375 * h, h: .45 * h}); }
  }
  return out;
}
