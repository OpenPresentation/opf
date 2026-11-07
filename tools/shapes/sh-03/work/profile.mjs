import { createRequire } from "node:module"; const sharp = createRequire("C:/opf-work/sh-03-effects/packages/pptx/package.json")("sharp");
const [file, ...rest] = process.argv.slice(2);
const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
// args: "h|v,x0,y0,len,step"  prints channel samples
for (const spec of rest) {
  const [dir, x0, y0, len, step = 1] = spec.split(",");
  const out = [];
  for (let k = 0; k < +len; k += +step) {
    const x = dir === "h" ? +x0 + k : +x0, y = dir === "v" ? +y0 + k : +y0;
    out.push(px(x, y)[+process.env.CH||0]);
  }
  console.log(spec, "\n ", out.join(" "));
}
