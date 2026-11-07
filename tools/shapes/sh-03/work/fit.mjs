import { createRequire } from "node:module"; const sharp = createRequire("C:/opf-work/sh-03-effects/packages/pptx/package.json")("sharp");
const erfc = x => { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; };
const img = async f => { const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true }); return (x, y, c) => data[(y * info.width + x) * info.channels + c]; };
// series: {file, y, edgeX (first px outside for outward, first px inside for inward), dir: +1 outward to right, r (dev px), ch, alphaOf(v)}
async function fit(name, series, inward = false) {
  const data = [];
  for (const s of series) {
    const px = await img(s.file);
    for (let k = s.outsideOnly ? 0 : -3 * s.r; k <= 3 * s.r; k++) {
      const x = s.edgeX + k; const v = px(x, s.y, s.ch); const a = s.alphaOf(v);
      // d: distance of pixel center from the edge, outward positive
      const d = k + 0.5;
      data.push({ r: s.r, d: inward ? -d : d, a });
    }
  }
  let best = { e: Infinity };
  for (let al = -1.2; al <= 1.2; al += 0.01) for (let be = 0.05; be <= 0.6; be += 0.005) {
    let e = 0; for (const p of data) { const m = al * p.r, sg = be * p.r; const pred = inward ? 0.5 * erfc((p.d - m) / (sg * Math.SQRT2)) : 0.5 * erfc((p.d - m) / (sg * Math.SQRT2)); e += (pred - p.a) ** 2; }
    if (e < best.e) best = { e, al: +al.toFixed(3), be: +be.toFixed(3) };
  }
  console.log(name, best, "rms", Math.sqrt(best.e / data.length).toFixed(4));
}
const S1 = "ppt-calib/slide1.png", S2 = "ppt-calib/slide2.png";
const blk = v => (255 - v) / 255, blu = v => (255 - v) / (255 - 68), red = v => (255 - v) / 255;
// outer shadow dist0: right edges at 560,1160,1760,2360 (first outside px), y=240
await fit("outer", [4, 10, 20, 40].map((r, i) => ({ file: S1, y: 240, edgeX: 560 + i * 600, r: r * 2, ch: 0, alphaOf: blk, outsideOnly: true })).map(s => ({ ...s })), false);
await fit("glow", [4, 10, 20, 40].map((r, i) => ({ file: S2, y: 240, edgeX: 560 + i * 600, r: r * 2, ch: 1, alphaOf: red, outsideOnly: true })));
// blur: shape alpha across the right edge (inside blue -> outside white): alpha of blue
await fit("blur", [4, 10, 20].map((r, i) => ({ file: S2, y: 1160, edgeX: 560 + i * 600, r: r * 2, ch: 0, alphaOf: blu })));
// soft edge: left edge at 160+600i; inward positive; measure blue alpha; model a = 0.5erfc((d - m)/..) with d outward from edge -> use x mirrored: take right edge instead
await fit("soft", [4, 10, 20].map((r, i) => ({ file: S2, y: 700, edgeX: 560 + i * 600, r: r * 2, ch: 0, alphaOf: blu })));
