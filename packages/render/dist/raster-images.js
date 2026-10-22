import {OPFRenderError} from './svg.js';
import {isConverterMissing,loadConverter} from './converters.js';

// Resvg does not decode WebP or apply JPEG EXIF orientation, and draws no text of an SVG used as an image (its nested
// document has no fonts). Replace only affected embedded image hrefs in the private
// rasterization copy; preserve SVG text, attributes, comments and source bytes.
// `nestedSvg(text)` renders an SVG picture that draws text to PNG bytes with the caller's fonts.
export async function prepareRasterImages(svg, {nestedSvg} = {}) {
  if (!/webp|jpeg|svg\+xml|&#/i.test(svg)) return svg;
  const cache = new Map();
  let output = '', end = 0, imageIndex = 0;
  const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<(?:"[^"]*"|'[^']*'|[^'">])*>/g;
  for (const match of svg.matchAll(tokens)) {
    let tag = match[0];
    if (!/^<(?:[A-Za-z_][\w.-]*:)?image(?=[\s/>])/.test(tag)) continue;
    const index = imageIndex++;
    const href = /\shref\s*=\s*(["'])([\s\S]*?)\1/.exec(tag)
      ?? /\sxlink:href\s*=\s*(["'])([\s\S]*?)\1/.exec(tag);
    if (!href) continue;
    const uri = xmlText(href[2]);
    if (!/^data:image\/(?:webp|jpeg|svg\+xml)(?:;|,)/i.test(uri)) continue;
    const trace = /\sdata-opf-path\s*=\s*(["'])([\s\S]*?)\1/.exec(tag);
    const path = trace ? xmlText(trace[2]) : `svg.images.${index}`;
    try {
      if (!cache.has(uri)) cache.set(uri, /^data:image\/svg\+xml/i.test(uri) ? prepareSvgImage(uri, nestedSvg) : prepareRasterImage(uri));
      const png = await cache.get(uri);
      if (png === null) continue;
      const replacement = href[0].slice(0, href[0].indexOf(href[1]) + 1) + png + href[1];
      tag = tag.slice(0, href.index) + replacement + tag.slice(href.index + href[0].length);
    } catch (error) {
      if (isConverterMissing(error)) throw error;
      throw new OPFRenderError('image-conversion-failed', 'Embedded raster image could not be prepared for PNG/PDF output.', {path, cause:error instanceof Error ? error.message : String(error)});
    }
    output += svg.slice(end, match.index) + tag;
    end = match.index + match[0].length;
  }
  return output + svg.slice(end);
}

// An SVG picture that draws text is rendered to PNG here (transparent, up to 4x its size) so its text uses the render's fonts;
// one without text stays vector for resvg.
async function prepareSvgImage(uri, nestedSvg) {
  if (!nestedSvg) return null;
  const comma = uri.indexOf(',');
  const header = uri.slice(0, comma), data = uri.slice(comma + 1);
  const text = /;base64$/i.test(header) ? Buffer.from(decodeURIComponent(data).replace(/\s/g, ''), 'base64').toString('utf8') : decodeURIComponent(data);
  if (!/<(?:[A-Za-z_][\w.-]*:)?text[\s>/]/.test(text)) return null;
  // A document resvg cannot read stays as it is: resvg then draws nothing for it, as for any broken picture.
  try { return 'data:image/png;base64,' + Buffer.from(await nestedSvg(text)).toString('base64'); } catch { return null; }
}

async function prepareRasterImage(uri) {
  const comma = uri.indexOf(',');
  const header = uri.slice(0, comma), data = uri.slice(comma + 1);
  let bytes;
  if (/;base64$/i.test(header)) {
    const encoded = decodeURIComponent(data).replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) throw new Error('Invalid base64 image data.');
    bytes = Buffer.from(encoded, 'base64');
  } else {
    const result = [];
    for (let index=0; index<data.length;) {
      if (data[index]==='%') {
        if (!/^[0-9a-f]{2}$/i.test(data.slice(index+1,index+3))) throw new Error('Invalid percent-encoded image data.');
        result.push(parseInt(data.slice(index+1,index+3),16)); index+=3;
      } else {
        const point=String.fromCodePoint(data.codePointAt(index));
        result.push(...new TextEncoder().encode(point)); index+=point.length;
      }
    }
    bytes=Uint8Array.from(result);
  }
  const webp=/^data:image\/webp(?:;|,)/i.test(uri);
  if (webp) {
    if (bytes.length < 12 || Buffer.from(bytes.subarray(0,4)).toString('ascii') !== 'RIFF' || Buffer.from(bytes.subarray(8,12)).toString('ascii') !== 'WEBP') throw new Error('Embedded data is not a WebP image.');
  } else if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error('Embedded data is not a JPEG image.');
  }
  const {default:sharp}=await loadConverter('sharp');
  const decoder=sharp(bytes,{limitInputPixels:40_000_000,animated:false,failOn:'warning'});
  if (!webp) {
    const {orientation}=await decoder.metadata();
    // Keep unoriented JPEGs on the existing resvg path, including their
    // original compressed bytes and established color/raster behavior.
    if (!(orientation >= 2 && orientation <= 8)) return null;
  }
  const png=await decoder.autoOrient().toColourspace('srgb').ensureAlpha()
    .png({compressionLevel:9,adaptiveFiltering:false}).toBuffer();
  return 'data:image/png;base64,'+png.toString('base64');
}

function xmlText(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (entity, code) => {
    if (code[0]==='#') {
      const point=code[1].toLowerCase()==='x'?parseInt(code.slice(2),16):parseInt(code.slice(1),10);
      return point>0&&point<=0x10ffff?String.fromCodePoint(point):entity;
    }
    return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'}[code] ?? entity;
  });
}
