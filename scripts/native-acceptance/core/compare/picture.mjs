// NT-04a: compare an application's picture of a slide with OPF's preview of it. The port of the 0.36.0 Keynote round's
// compare.py (Pillow) to Node: sharp reads the PNG and applies its embedded color profile (Keynote writes Display P3), and the
// rest is plain JavaScript on raw pixel buffers so every step matches Pillow's integer arithmetic (Lanczos resize, the
// grayscale weights, the Gaussian blur as three box passes, the max and min filters, the 8 px box grid). A score ranks slides;
// it is not a verdict: someone looks at both pictures.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(path.join(root, 'packages/render/package.json'));

let sharpModule;
/** sharp from packages/render (no dependency of the root). */
export function sharp() {
  sharpModule ??= require('sharp');
  return sharpModule;
}

/** The round's settings: compare.py's defaults. */
export const DEFAULTS = Object.freeze({ width: 1280, blur: 1.5, tolerance: 24, shift: 2, boxes: 5 });
/** Aspect ratios that differ by more than this are flagged (compare.py: 0.01). */
export const ASPECT_LIMIT = 0.01;

/**
 * A slide picture as it looks: the embedded color profile applied (to sRGB), alpha composited onto white.
 * `input` is a path or a Buffer. Returns { width, height, rgb: Uint8Array (3 bytes a pixel), profile: boolean (a profile was
 * applied), alpha: boolean }.
 * `ignoreProfile` reads the stored numbers as sRGB (only for tests that show the conversion matters).
 */
export async function loadPicture(input, { ignoreProfile = false } = {}) {
  const meta = await sharp()(input).metadata();
  // sharp converts an embedded profile to sRGB as it reads (lcms, perceptual intent, as Pillow's ImageCms does by default);
  // toColourspace('srgb') makes the output 8 bits a channel whatever the PNG's depth.
  const read = (ignoreIcc) => sharp()(input, { ignoreIcc }).ensureAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  let converted = Boolean(meta.icc) && !ignoreProfile;
  let pixels;
  try {
    pixels = await read(ignoreProfile);
  } catch (error) {
    // A broken profile: the pixels are used as they are (compare.py does the same).
    if (!converted) throw error;
    converted = false;
    pixels = await read(true);
  }
  const { data, info } = pixels;
  const { width, height, channels } = info;
  if (channels !== 4) throw new Error(`loadPicture: expected 4 channels, got ${channels}`);
  const rgb = new Uint8Array(width * height * 3);
  for (let p = 0, q = 0; p < data.length; p += 4, q += 3) {
    const a = data[p + 3];
    if (a === 255) {
      rgb[q] = data[p];
      rgb[q + 1] = data[p + 1];
      rgb[q + 2] = data[p + 2];
    } else {
      for (let c = 0; c < 3; c += 1) rgb[q + c] = onWhite(data[p + c], a);
    }
  }
  return { width, height, rgb, profile: converted, alpha: meta.hasAlpha === true };
}

/** An ICC profile's description ("Display P3"), from its 'desc' tag (v2 text or v4 multi-localized); null when unreadable. */
export function iccDescription(icc) {
  try {
    const view = Buffer.from(icc);
    const count = view.readUInt32BE(128);
    for (let i = 0; i < count; i += 1) {
      const entry = 132 + i * 12;
      if (view.toString('latin1', entry, entry + 4) !== 'desc') continue;
      const start = view.readUInt32BE(entry + 4);
      const type = view.toString('latin1', start, start + 4);
      if (type === 'desc') return view.toString('latin1', start + 12, start + 12 + view.readUInt32BE(start + 8)).replace(/\0+$/u, '') || null;
      if (type === 'mluc') {
        const length = view.readUInt32BE(start + 20);
        const offset = view.readUInt32BE(start + 24);
        return view.subarray(start + offset, start + offset + length).swap16().toString('utf16le') || null;
      }
    }
  } catch {
    // A truncated or foreign profile has no readable name.
  }
  return null;
}

/** What a picture file is: { pixelSize: [w, h], colorProfile: description|null, alpha }. */
export async function pictureFacts(input) {
  const meta = await sharp()(input).metadata();
  return { pixelSize: [meta.width, meta.height], colorProfile: meta.icc ? iccDescription(meta.icc) : null, alpha: meta.hasAlpha === true };
}

// Pillow's alpha_composite of one channel onto opaque white (AlphaComposite.c, 7 bits of precision).
const PRECISION = 7;
const shiftForDiv255 = (a) => (((a >>> 8) + a) >>> 8) >>> 0;
function onWhite(value, alpha) {
  if (alpha === 0) return 255;
  const outa255 = alpha * 255 + 255 * (255 - alpha);
  const coef1 = Math.floor((alpha * 255 * 255 * (1 << PRECISION)) / outa255);
  const coef2 = 255 * (1 << PRECISION) - coef1;
  const tmp = value * coef1 + 255 * coef2;
  return shiftForDiv255(tmp + (0x80 << PRECISION)) >>> PRECISION;
}

// ---- Lanczos resize, Pillow's Resample.c (8 bits a channel, 22-bit fixed-point coefficients, horizontal pass first).

const RESAMPLE_BITS = 32 - 8 - 2;
const sinc = (x) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const lanczos = (x) => (x >= -3 && x < 3 ? sinc(x) * sinc(x / 3) : 0);

function coefficients(inSize, outSize) {
  const scale = inSize / outSize;
  const filterScale = Math.max(scale, 1);
  const support = 3 * filterScale;
  const ksize = Math.ceil(support) * 2 + 1;
  const bounds = new Int32Array(outSize * 2);
  const kk = new Int32Array(outSize * ksize);
  const weights = new Float64Array(ksize);
  for (let xx = 0; xx < outSize; xx += 1) {
    const center = (xx + 0.5) * scale;
    const ss = 1 / filterScale;
    // C casts to int: truncation toward zero.
    const xmin = Math.max(Math.trunc(center - support + 0.5), 0);
    const xmax = Math.min(Math.trunc(center + support + 0.5), inSize) - xmin;
    let total = 0;
    for (let x = 0; x < xmax; x += 1) {
      weights[x] = lanczos((x + xmin - center + 0.5) * ss);
      total += weights[x];
    }
    for (let x = 0; x < xmax; x += 1) {
      const w = total !== 0 ? weights[x] / total : weights[x];
      kk[xx * ksize + x] = w < 0 ? Math.trunc(-0.5 + w * 2 ** RESAMPLE_BITS) : Math.trunc(0.5 + w * 2 ** RESAMPLE_BITS);
    }
    bounds[xx * 2] = xmin;
    bounds[xx * 2 + 1] = xmax;
  }
  return { ksize, bounds, kk };
}

const clip8 = (value) => {
  const shifted = Math.floor(value / 2 ** RESAMPLE_BITS);
  return Math.min(Math.max(shifted, 0), 255);
};

function resampleAxis(src, width, height, channels, outSize, horizontal) {
  const inSize = horizontal ? width : height;
  const { ksize, bounds, kk } = coefficients(inSize, outSize);
  const outWidth = horizontal ? outSize : width;
  const outHeight = horizontal ? height : outSize;
  const out = new Uint8Array(outWidth * outHeight * channels);
  const half = 2 ** (RESAMPLE_BITS - 1);
  // Distance between two neighbors along the axis being resampled.
  const stride = horizontal ? channels : width * channels;
  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const o = horizontal ? x : y;
      const min = bounds[o * 2];
      const count = bounds[o * 2 + 1];
      const first = horizontal ? (y * width + min) * channels : (min * width + x) * channels;
      const k = o * ksize;
      for (let c = 0; c < channels; c += 1) {
        let sum = half;
        for (let i = 0, index = first + c; i < count; i += 1, index += stride) sum += src[index] * kk[k + i];
        out[(y * outWidth + x) * channels + c] = clip8(sum);
      }
    }
  }
  return out;
}

/** Pillow's Image.resize(size, LANCZOS) of an 8-bit buffer with `channels` bytes a pixel. */
export function resizeLanczos(data, width, height, channels, outWidth, outHeight) {
  let pixels = data;
  let w = width;
  if (outWidth !== width) {
    pixels = resampleAxis(pixels, w, height, channels, outWidth, true);
    w = outWidth;
  }
  if (outHeight !== height) pixels = resampleAxis(pixels, w, height, channels, outHeight, false);
  return pixels;
}

/** Pillow's convert('L') from RGB: ITU-R 601 weights in 16-bit fixed point. */
export function toGray(rgb, count) {
  const gray = new Uint8Array(count);
  for (let p = 0, q = 0; p < count; p += 1, q += 3) gray[p] = (rgb[q] * 19595 + rgb[q + 1] * 38470 + rgb[q + 2] * 7471 + 0x8000) >>> 16;
  return gray;
}

// ---- Gaussian blur, Pillow's BoxBlur.c: three box passes per axis with a fractional radius (32-bit float arithmetic).

function boxRadius(radius, passes) {
  const f = Math.fround;
  const sigma2 = f(f(radius * radius) / passes);
  const L = f(Math.sqrt(12 * sigma2 + 1));
  const l = Math.floor((L - 1) / 2);
  let a = f((2 * l + 1) * (l * (l + 1) - 3 * sigma2));
  a = f(a / (6 * (sigma2 - (l + 1) * (l + 1))));
  return f(l + a);
}

function boxLine(lineIn, lineOut, length, floatRadius) {
  const radius = Math.trunc(floatRadius);
  const ww = Math.trunc(Math.fround(2 ** 24 / Math.fround(floatRadius * 2 + 1))) >>> 0;
  const fw = Math.trunc((2 ** 24 - (radius * 2 + 1) * ww) / 2);
  const last = length - 1;
  const at = (i) => lineIn[Math.min(Math.max(i, 0), last)];
  let acc = 0;
  for (let i = -radius; i <= radius; i += 1) acc += at(i);
  for (let x = 0; x < length; x += 1) {
    const bulk = acc * ww + (at(x - radius - 1) + at(x + radius + 1)) * fw;
    lineOut[x] = Math.floor((bulk + 2 ** 23) / 2 ** 24);
    acc += at(x + radius + 1) - at(x - radius);
  }
}

/** Pillow's ImageFilter.GaussianBlur(radius) of a grayscale buffer. */
export function gaussianBlur(gray, width, height, radius, passes = 3) {
  if (radius <= 0) return gray.slice();
  const r = boxRadius(radius, passes);
  if (r === 0) return gray.slice();
  const out = gray.slice();
  const line = new Uint8Array(Math.max(width, height));
  const result = new Uint8Array(Math.max(width, height));
  for (let pass = 0; pass < passes; pass += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) line[x] = out[y * width + x];
      boxLine(line, result, width, r);
      for (let x = 0; x < width; x += 1) out[y * width + x] = result[x];
    }
  }
  for (let pass = 0; pass < passes; pass += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let y = 0; y < height; y += 1) line[y] = out[y * width + x];
      boxLine(line, result, height, r);
      for (let y = 0; y < height; y += 1) out[y * width + x] = result[y];
    }
  }
  return out;
}

/** Max (or min) over a (2*shift+1) square window, edges repeated (Pillow's MaxFilter / MinFilter after expand). */
export function rankFilter(gray, width, height, shift, max) {
  if (shift <= 0) return gray.slice();
  // A square window's max is the max over rows of the max over columns, so two 1-D passes give the same result.
  // `step` is 1 along a row and `width` down a column; `lines` and `lineStep` walk the other axis.
  const pass = (source, length, step, lines, lineStep) => {
    const out = new Uint8Array(source.length);
    for (let line = 0; line < lines; line += 1) {
      const base = line * lineStep;
      for (let i = 0; i < length; i += 1) {
        const from = Math.max(i - shift, 0);
        const to = Math.min(i + shift, length - 1);
        let value = source[base + from * step];
        for (let j = from + 1; j <= to; j += 1) {
          const other = source[base + j * step];
          if (max ? other > value : other < value) value = other;
        }
        out[base + i * step] = value;
      }
    }
    return out;
  };
  return pass(pass(gray, width, 1, height, width), height, width, width, 1);
}

/**
 * Symmetric shift-tolerant difference: a pixel of x differs when it lies more than `tolerance` above the max or below the min
 * of y within `shift` px, or the same from y to x. Returns a mask of 0 and 1.
 */
export function differenceMask(a, b, width, height, tolerance, shift) {
  const mask = new Uint8Array(a.length);
  const oneWay = (x, y) => {
    const high = rankFilter(y, width, height, shift, true);
    const low = rankFilter(y, width, height, shift, false);
    for (let p = 0; p < x.length; p += 1) {
      if (x[p] - high[p] > tolerance || low[p] - x[p] > tolerance) mask[p] = 1;
    }
  };
  oneWay(a, b);
  oneWay(b, a);
  return mask;
}

// Pillow's resize(..., BOX) of the 0/255 mask to the grid: the area-weighted mean of each cell, rounded.
function boxGrid(mask, width, height, gridWidth, gridHeight) {
  const axis = (inSize, outSize) => {
    const scale = inSize / outSize;
    return Array.from({ length: outSize }, (_, o) => {
      const start = o * scale;
      const end = start + scale;
      const weights = [];
      for (let i = Math.floor(start); i < Math.min(Math.ceil(end), inSize); i += 1) {
        const w = Math.min(end, i + 1) - Math.max(start, i);
        if (w > 0) weights.push([i, w]);
      }
      const total = weights.reduce((sum, [, w]) => sum + w, 0);
      return weights.map(([i, w]) => [i, w / total]);
    });
  };
  const xs = axis(width, gridWidth);
  const ys = axis(height, gridHeight);
  const grid = new Float64Array(gridWidth * gridHeight);
  for (let gy = 0; gy < gridHeight; gy += 1) {
    for (let gx = 0; gx < gridWidth; gx += 1) {
      let sum = 0;
      for (const [y, wy] of ys[gy]) for (const [x, wx] of xs[gx]) sum += mask[y * width + x] * 255 * wx * wy;
      grid[gy * gridWidth + gx] = Math.round(sum);
    }
  }
  return grid;
}

const round = (value, places) => Number(value.toFixed(places));

/** The largest 8-connected areas of differing cells on a `cell` px grid, as slide fractions [x0, y0, x1, y1]. */
export function regionsOf(mask, width, height, boxes, cell = 8) {
  const gw = Math.ceil(width / cell);
  const gh = Math.ceil(height / cell);
  const grid = boxGrid(mask, width, height, gw, gh);
  const on = (x, y) => grid[y * gw + x] > 8;
  const seen = new Uint8Array(gw * gh);
  const components = [];
  for (let y = 0; y < gh; y += 1) {
    for (let x = 0; x < gw; x += 1) {
      if (!on(x, y) || seen[y * gw + x]) continue;
      seen[y * gw + x] = 1;
      const stack = [[x, y]];
      let [x0, x1, y0, y1, cells] = [x, x, y, y, 0];
      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        cells += 1;
        x0 = Math.min(x0, cx);
        x1 = Math.max(x1, cx);
        y0 = Math.min(y0, cy);
        y1 = Math.max(y1, cy);
        for (let dx = -1; dx <= 1; dx += 1) {
          for (let dy = -1; dy <= 1; dy += 1) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < gw && ny >= 0 && ny < gh && on(nx, ny) && !seen[ny * gw + nx]) {
              seen[ny * gw + nx] = 1;
              stack.push([nx, ny]);
            }
          }
        }
      }
      components.push({ cells, box: [round(x0 / gw, 4), round(y0 / gh, 4), round((x1 + 1) / gw, 4), round((y1 + 1) / gh, 4)] });
    }
  }
  // Stable sort: equal areas keep scan order, as Python's sort does.
  components.sort((a, b) => b.cells - a.cells);
  return components.slice(0, boxes).map(({ box, cells }) => ({ box, cells, share: round(cells / (gw * gh), 5) }));
}

function prepare(picture, width, height, blur) {
  const resized = picture.width === width && picture.height === height ? picture.rgb : resizeLanczos(picture.rgb, picture.width, picture.height, 3, width, height);
  return gaussianBlur(toGray(resized, width * height), width, height, blur);
}

/**
 * Compares OPF's preview with the application's picture of the same slide. Each is a path, a Buffer or a loaded picture.
 * Both are resized to the preview's aspect at `width`, made gray and blurred; score = share of differing pixels (5 places),
 * regions = the `boxes` largest differing areas. Returns { score, regions, size, previewSize, appSize, aspectDiffers }.
 */
export async function comparePictures(preview, app, options = {}) {
  const { width, blur, tolerance, shift, boxes } = { ...DEFAULTS, ...options };
  const a = preview?.rgb ? preview : await loadPicture(preview);
  const b = app?.rgb ? app : await loadPicture(app);
  // Python's round() rounds half to even; the heights met in practice are whole numbers either way.
  const height = Math.round((width * a.height) / a.width);
  const ga = prepare(a, width, height, blur);
  const gb = prepare(b, width, height, blur);
  const mask = differenceMask(ga, gb, width, height, tolerance, shift);
  let differing = 0;
  for (const bit of mask) differing += bit;
  return {
    score: round(differing / (width * height), 5),
    regions: regionsOf(mask, width, height, boxes),
    size: [width, height],
    previewSize: [a.width, a.height],
    appSize: [b.width, b.height],
    aspectDiffers: Math.abs(a.width / a.height - b.width / b.height) > ASPECT_LIMIT,
  };
}

/**
 * Pairs OPF's preview pictures with the application's slides. OPF's previews leave hidden slides out and number the rest
 * 1..n; the application's pictures go by slide index. Preview k pairs with the k-th slide that is not hidden. When the
 * preview count equals the slide count instead (a preview that kept hidden slides), pairing is by index.
 *   pairSlides(slides: [{ index, hidden, picture }], previewCount) -> [{ index, preview: k | null, picture, note? }]
 */
export function pairSlides(slides, previewCount) {
  const visible = slides.filter((slide) => !slide.hidden).length;
  const byIndex = previewCount !== visible && previewCount === slides.length;
  let k = 0;
  return slides.map((slide) => {
    let preview = null;
    if (byIndex) preview = slide.index;
    else if (!slide.hidden) {
      k += 1;
      preview = k <= previewCount ? k : null;
    }
    const pair = { index: slide.index, preview, picture: slide.picture ?? null };
    if (slide.hidden && !slide.picture) pair.note = 'hidden slide: the application exported no picture';
    else if (preview === null) pair.note = 'no preview picture';
    else if (!slide.picture) pair.note = 'no application picture';
    return pair;
  });
}
