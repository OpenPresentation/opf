// Read dimensions only; never decode pixels or follow resource references.
// PNG: https://www.w3.org/TR/PNG-Chunks.html
// WebP: https://developers.google.com/speed/webp/docs/riff_container
export function rasterDimensions(bytes) {
  const info = rasterMetadata(bytes);
  return info ? { width: info.width, height: info.height } : null;
}

export function rasterMetadata(bytes) {
  if (!(bytes instanceof Uint8Array)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at, n) => String.fromCharCode(...bytes.subarray(at, at + n));
  const size = (width, height, mediaType) => Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 ? { width, height, mediaType } : null;
  if (bytes.length >= 33 && text(0, 8) === '\x89PNG\r\n\x1a\n' && view.getUint32(8) === 13 && text(12, 4) === 'IHDR') {
    const dimensions = size(view.getUint32(16), view.getUint32(20), "image/png");
    // pHYs precedes IDAT. Only the metre unit defines a physical resolution.
    for (let at = 33; dimensions && at + 12 <= bytes.length;) {
      const length = view.getUint32(at), kind = text(at + 4, 4);
      if (kind === 'IDAT' || kind === 'IEND' || at + 12 + length > bytes.length) break;
      if (kind === 'pHYs' && length === 9 && bytes[at + 16] === 1) return { ...dimensions, ...resolution(view.getUint32(at + 8) * .0254, view.getUint32(at + 12) * .0254) };
      at += 12 + length;
    }
    return dimensions;
  }
  if (bytes.length >= 13 && ['GIF87a', 'GIF89a'].includes(text(0, 6))) {
    return size(view.getUint16(6, true), view.getUint16(8, true), "image/gif");
  }
  if (bytes.length >= 12 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
    const end = view.getUint32(4, true) + 8;
    if (end > bytes.length) return null;
    for (let at = 12; at + 8 <= end;) {
      const kind = text(at, 4), length = view.getUint32(at + 4, true), start = at + 8;
      if (start + length > end) return null;
      if (kind === 'VP8X' && length >= 10) {
        const u24 = offset => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536;
        return size(u24(start + 4) + 1, u24(start + 7) + 1, "image/webp");
      }
      if (kind === 'VP8L' && length >= 5 && bytes[start] === 0x2f) {
        const bits = view.getUint32(start + 1, true);
        return size((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1, "image/webp");
      }
      if (kind === 'VP8 ' && length >= 10 && text(start + 3, 3) === '\x9d\x01\x2a') {
        return size(view.getUint16(start + 6, true) & 0x3fff, view.getUint16(start + 8, true) & 0x3fff, "image/webp");
      }
      at = start + length + (length & 1);
    }
    return null;
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let dimensions = null, orientation = null, jfif = null, exif = null;
    // JFIF density (in inches or centimetres) takes precedence over EXIF
    // X/YResolution; a JFIF aspect-ratio-only density (unit 0) defines no DPI.
    const result = () => dimensions ? { ...dimensions, ...(jfif ?? exif), ...orientation } : null;
    // JPEG segment lengths include their two length bytes. Every iteration
    // advances within the input, including fill bytes and standalone markers.
    for (let at = 2; at < bytes.length;) {
      if (bytes[at++] !== 0xff) return null;
      while (at < bytes.length && bytes[at] === 0xff) at++;
      if (at >= bytes.length) return null;
      const marker = bytes[at++];
      if (marker === 0xda || marker === 0xd9) return result();
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (at + 2 > bytes.length) return null;
      const length = view.getUint16(at);
      if (length < 2 || at + length > bytes.length) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        dimensions = length >= 8 ? size(view.getUint16(at + 5), view.getUint16(at + 3), "image/jpeg") : null;
      }
      if (marker === 0xe1 && text(at + 2, 6) === 'Exif\x00\x00') {
        orientation ??= exifOrientation(bytes, at + 8, at + length);
        exif ??= exifResolution(bytes, at + 8, at + length);
      }
      if (marker === 0xe0 && length >= 14 && text(at + 2, 5) === 'JFIF\x00' && (bytes[at + 9] === 1 || bytes[at + 9] === 2)) {
        const unit = bytes[at + 9] === 1 ? 1 : 2.54;
        jfif ??= resolution(view.getUint16(at + 10) * unit, view.getUint16(at + 12) * unit);
      }
      at += length;
    }
    return result();
  }
  return null;
}

// Physical resolution in dots per inch, when both axes are positive.
function resolution(x, y) {
  return Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0 ? { dpiX: x, dpiY: y } : null;
}

// IFD0 XResolution/YResolution (RATIONAL) with ResolutionUnit 2 (inch, the
// default) or 3 (centimetre). Every value read stays within the APP1 segment.
function exifResolution(bytes, start, end) {
  if (start + 8 > end) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const littleEndian = bytes[start] === 0x49 && bytes[start + 1] === 0x49;
  if (!littleEndian && !(bytes[start] === 0x4d && bytes[start + 1] === 0x4d)) return null;
  if (view.getUint16(start + 2, littleEndian) !== 42) return null;
  const directory = start + view.getUint32(start + 4, littleEndian);
  if (directory < start + 8 || directory + 2 > end) return null;
  const count = view.getUint16(directory, littleEndian);
  if (directory + 2 + count * 12 > end) return null;
  const values = {};
  for (let i = 0; i < count; i++) {
    const at = directory + 2 + i * 12, tag = view.getUint16(at, littleEndian), type = view.getUint16(at + 2, littleEndian);
    if (view.getUint32(at + 4, littleEndian) !== 1) continue;
    if ((tag === 0x11a || tag === 0x11b) && type === 5) {
      const value = start + view.getUint32(at + 8, littleEndian);
      if (value < start + 8 || value + 8 > end) continue;
      const denominator = view.getUint32(value + 4, littleEndian);
      if (denominator) values[tag] = view.getUint32(value, littleEndian) / denominator;
    }
    if (tag === 0x128 && type === 3) values.unit = view.getUint16(at + 8, littleEndian);
  }
  const unit = values.unit ?? 2;
  if (unit !== 2 && unit !== 3) return null;
  return resolution(values[0x11a] * (unit === 3 ? 2.54 : 1), values[0x11b] * (unit === 3 ? 2.54 : 1));
}

// Read only IFD0's inline SHORT orientation. All offsets and entry counts
// stay within the APP1 segment; no linked IFDs or external values are followed.
function exifOrientation(bytes, start, end) {
  if (start + 8 > end) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const littleEndian = bytes[start] === 0x49 && bytes[start + 1] === 0x49;
  if (!littleEndian && !(bytes[start] === 0x4d && bytes[start + 1] === 0x4d)) return null;
  if (view.getUint16(start + 2, littleEndian) !== 42) return null;
  const directory = start + view.getUint32(start + 4, littleEndian);
  if (directory < start + 8 || directory + 2 > end) return null;
  const count = view.getUint16(directory, littleEndian);
  if (directory + 2 + count * 12 > end) return null;
  for (let i = 0; i < count; i++) {
    const at = directory + 2 + i * 12;
    if (view.getUint16(at, littleEndian) !== 0x112 || view.getUint16(at + 2, littleEndian) !== 3 || view.getUint32(at + 4, littleEndian) !== 1) continue;
    const orientation = view.getUint16(at + 8, littleEndian);
    if (orientation >= 1 && orientation <= 8) return { orientation, orientationOffset: at + 8, littleEndian };
  }
  return null;
}

export function fitImageBox(image, box, mode) {
  const scale = (mode === 'crop' ? Math.max : Math.min)(box.w / image.width, box.h / image.height);
  const width = image.width * scale, height = image.height * scale;
  if (mode !== 'crop') return { x: box.x + (box.w - width) / 2, y: box.y + (box.h - height) / 2, w: width, h: height, crop: null };
  const horizontal = Math.max(0, Math.round((1 - box.w / width) * 50000));
  const vertical = Math.max(0, Math.round((1 - box.h / height) * 50000));
  return { ...box, crop: { l: horizontal, r: horizontal, t: vertical, b: vertical } };
}

export function pictureTransform(metadata, box, mode) {
  const orientation = metadata.orientation ?? 1;
  const swapsAxes = orientation >= 5;
  const target = swapsAxes
    ? { x: box.x + (box.w - box.h) / 2, y: box.y + (box.h - box.w) / 2, w: box.h, h: box.w }
    : box;
  const fitted = fitImageBox(metadata, target, mode);
  // DrawingML flips the source axes before applying clockwise rotation.
  const rotation = [0, 0, 0, 180, 0, 90, 90, 90, 270][orientation];
  return { ...fitted, rotation, flipH: orientation === 2 || orientation === 7, flipV: orientation === 4 || orientation === 5 };
}

export function normalizeImageOrientation(bytes, metadata) {
  if (!metadata?.orientationOffset || metadata.orientation === 1) return bytes;
  const output = new Uint8Array(bytes);
  new DataView(output.buffer, output.byteOffset, output.byteLength).setUint16(metadata.orientationOffset, 1, metadata.littleEndian);
  return output;
}

// Keep the picture frame at the allocated box and express crop/fit through
// a:srcRect. Crop trims the centered overflow (positive insets); fit pads the
// centered image with negative insets. Frame-based masks, lines and effects
// therefore apply to the same box as the SVG preview's clipped <image>.
export function framePicture(image, box, mode) {
  const scale = (mode === 'crop' ? Math.max : Math.min)(box.w / image.width, box.h / image.height);
  const horizontal = Math.round((1 - box.w / (image.width * scale)) * 50000) || 0;
  const vertical = Math.round((1 - box.h / (image.height * scale)) * 50000) || 0;
  return { ...box, crop: horizontal || vertical ? { l: horizontal, t: vertical, r: horizontal, b: vertical } : null };
}

export function framedPictureTransform(metadata, box, mode) {
  const orientation = metadata.orientation ?? 1;
  const target = orientation >= 5
    ? { x: box.x + (box.w - box.h) / 2, y: box.y + (box.h - box.w) / 2, w: box.h, h: box.w }
    : box;
  const rotation = [0, 0, 0, 180, 0, 90, 90, 90, 270][orientation];
  return { ...framePicture(metadata, target, mode), rotation, flipH: orientation === 2 || orientation === 7, flipV: orientation === 4 || orientation === 5 };
}
