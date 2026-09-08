import {rasterMetadata} from './image-geometry.js';

// Centered, normalized source coordinates: [a,b,c,d] maps (x,y) to
// (a*x+b*y,c*x+d*y). These are the eight JPEG EXIF orientation transforms.
const orientations = [null, [1,0,0,1], [-1,0,0,1], [-1,0,0,-1], [1,0,0,-1],
  [0,1,1,0], [0,-1,1,0], [0,-1,-1,0], [0,1,-1,0]];
const multiply = ([a,b,c,d], [e,f,g,h]) => [a*e+b*g,a*f+b*h,c*e+d*g,c*f+d*h];
const truth = value => value === '1' || value === 'true';

export function importImageOrientation(bytes, transform, report = () => {}) {
  const rotation = Number(transform?.rot ?? 0) / 60000;
  const flipH = truth(transform?.flipH), flipV = truth(transform?.flipV);
  if (Number.isFinite(rotation) && rotation % 360 === 0 && !flipH && !flipV) return bytes;
  const unsupported = message => {report({code:'unsupported-image-orientation', message});return bytes;};
  if (!Number.isFinite(rotation) || rotation % 90 !== 0) {
    return unsupported('The native picture rotation/mirroring cannot be represented by JPEG EXIF metadata; its original image bytes were retained.');
  }
  const quarter = ((rotation / 90) % 4 + 4) % 4;
  const rotations = [orientations[1],orientations[6],orientations[3],orientations[8]];
  const native = multiply(rotations[quarter], [flipH ? -1 : 1,0,0,flipV ? -1 : 1]);
  if (native.every((value,i) => value === orientations[1][i])) return bytes;
  const metadata = rasterMetadata(bytes);
  if (!metadata || metadata.mediaType !== 'image/jpeg') {
    return unsupported('Native rotation/mirroring of this image format is not preserved by OPF import; its original image bytes were retained.');
  }
  const combined = multiply(native, orientations[metadata.orientation ?? 1]);
  const orientation = orientations.findIndex(matrix => matrix && matrix.every((n,i) => n === combined[i]));
  try { return withJpegOrientation(bytes, metadata, orientation); }
  catch { return unsupported('The JPEG EXIF segment cannot safely accommodate the native picture orientation; its original image bytes were retained.'); }
}

function withJpegOrientation(bytes, metadata, orientation) {
  if (orientation === (metadata.orientation ?? 1)) return bytes;
  if (metadata.orientationOffset !== undefined) {
    const output = new Uint8Array(bytes);
    new DataView(output.buffer, output.byteOffset, output.byteLength).setUint16(metadata.orientationOffset, orientation, metadata.littleEndian);
    return output;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // An existing EXIF block without orientation keeps all relative data/IFD
  // offsets. Append a replacement IFD0, preserving its entries and next-IFD
  // link, then point its TIFF header to the new directory.
  for (let at = 2; at + 4 <= bytes.length;) {
    if (bytes[at++] !== 0xff) throw new Error('Invalid JPEG marker');
    while (bytes[at] === 0xff) at++;
    const marker = bytes[at++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = view.getUint16(at), end = at + length;
    if (length < 2 || end > bytes.length) throw new Error('Invalid JPEG segment');
    if (marker === 0xe1 && length >= 16 && String.fromCharCode(...bytes.subarray(at+2,at+8)) === 'Exif\0\0') {
      const start = at + 8, little = bytes[start] === 0x49 && bytes[start+1] === 0x49;
      if ((!little && !(bytes[start] === 0x4d && bytes[start+1] === 0x4d)) || view.getUint16(start+2,little) !== 42) throw new Error('Invalid TIFF');
      const directory = start + view.getUint32(start+4,little);
      if (directory < start+8 || directory+2 > end) throw new Error('Invalid IFD');
      const count = view.getUint16(directory,little), tail = directory + 2 + count*12;
      if (tail+4 > end || count === 65535) throw new Error('Invalid IFD entries');
      // A malformed orientation entry cannot be duplicated into a valid one.
      for (let i=0;i<count;i++) if (view.getUint16(directory+2+i*12,little) === 0x112) throw new Error('Malformed orientation entry');
      const padding = (end-start) % 2, extra = padding + 2 + (count+1)*12 + 4;
      if (length+extra > 65535) throw new Error('EXIF segment too large');
      const output = new Uint8Array(bytes.length+extra);
      output.set(bytes.subarray(0,end));output.set(bytes.subarray(end),end+extra);
      const out = new DataView(output.buffer), replacement = end+padding;
      out.setUint16(at,length+extra);out.setUint32(start+4,replacement-start,little);
      out.setUint16(replacement,count+1,little);
      let target=replacement+2, inserted=false;
      for (let i=0;i<count;i++) {
        const source=directory+2+i*12;
        if (!inserted && view.getUint16(source,little)>0x112) {writeEntry(out,target,orientation,little);target+=12;inserted=true;}
        output.set(bytes.subarray(source,source+12),target);target+=12;
      }
      if (!inserted) {writeEntry(out,target,orientation,little);target+=12;}
      output.set(bytes.subarray(tail,tail+4),target);
      return output;
    }
    at=end;
  }
  // Plain JPEG: insert a minimal independent APP1/IFD0 after SOI. Every
  // original byte after SOI is retained, including compressed scan data.
  const segment = new Uint8Array(36), out = new DataView(segment.buffer);
  segment.set([0xff,0xe1,0,34,0x45,0x78,0x69,0x66,0,0,0x4d,0x4d,0,42,0,0,0,8,0,1]);
  writeEntry(out,20,orientation,false);
  const output = new Uint8Array(bytes.length+segment.length);
  output.set(bytes.subarray(0,2));output.set(segment,2);output.set(bytes.subarray(2),2+segment.length);
  return output;
}

function writeEntry(view, at, orientation, little) {
  view.setUint16(at,0x112,little);view.setUint16(at+2,3,little);
  view.setUint32(at+4,1,little);view.setUint16(at+8,orientation,little);
}
