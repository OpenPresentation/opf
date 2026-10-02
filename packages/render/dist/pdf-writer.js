import pako from "pako";
import { sha256Bytes } from "./sha256.js";

// A small PDF object writer for the vector export (RR-12). Everything it emits is a pure function of the objects
// added to it: objects are numbered in the order they are added, written in number order, compressed with pako
// (pure JavaScript, so the bytes do not depend on the platform's zlib build), and the file identifier is a hash
// of the content. There is no clock, no random data and no locale-dependent formatting.

const encoder = new TextEncoder();

/** A coordinate or other real number: at most `digits` decimals, no exponent, no negative zero. */
export function num(value, digits = 3) {
  if (!Number.isFinite(value)) return "0";
  // PDF readers keep reals in single precision and some reject exponents: clamp absurd coordinates to a sane range.
  if (Math.abs(value) > 1e9) value = Math.sign(value) * 1e9;
  const scale = 10 ** digits;
  let rounded = Math.round(value * scale) / scale;
  if (Object.is(rounded, -0)) rounded = 0;
  let text = String(rounded);
  if (/e/i.test(text)) text = rounded.toFixed(digits).replace(/\.?0+$/, "") || "0";
  return text;
}

/** PDF name object (`/Name`), escaping every byte outside the regular printable range. */
export function name(value) {
  let out = "/";
  for (const byte of encoder.encode(String(value))) {
    out += byte < 0x21 || byte > 0x7e || "#()<>[]{}/%".includes(String.fromCharCode(byte))
      ? "#" + byte.toString(16).toUpperCase().padStart(2, "0")
      : String.fromCharCode(byte);
  }
  return out;
}

/** A PDF text string: PDFDocEncoding-safe ASCII as a literal string, everything else as UTF-16BE with a byte order mark. */
export function textString(value) {
  const text = String(value);
  if (/^[\x20-\x7e]*$/.test(text)) return "(" + text.replace(/[\\()]/g, "\\$&") + ")";
  let hex = "FEFF";
  for (let index = 0; index < text.length; index++) hex += text.charCodeAt(index).toString(16).toUpperCase().padStart(4, "0");
  return "<" + hex + ">";
}

/** A 7-bit ASCII literal string (URIs); non-ASCII must already be percent-encoded. */
export function asciiString(value) {
  return "(" + String(value).replace(/[\\()]/g, "\\$&").replace(/[\r\n]/g, " ") + ")";
}

export function hex(bytes) {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).toUpperCase().padStart(2, "0");
  return out;
}

export function utf16Hex(text) {
  let out = "";
  for (let index = 0; index < text.length; index++) out += text.charCodeAt(index).toString(16).toUpperCase().padStart(4, "0");
  return out;
}

export function ref(number) {
  return `${number} 0 R`;
}

export function flate(bytes) {
  return pako.deflate(bytes, { level: 9 });
}

export function sha256(bytes) {
  return sha256Bytes(bytes);
}

export class PdfFile {
  constructor({ compress = true } = {}) {
    this.compress = compress;
    this.objects = [];
  }

  /** Reserve an object number to fill later (forward references). */
  reserve() {
    this.objects.push(null);
    return this.objects.length;
  }

  /** Fill a reserved object. `dict` is the dictionary body without delimiters; `stream` makes it a stream object. */
  set(number, dict, stream) {
    this.objects[number - 1] = { dict, stream };
  }

  add(dict, stream) {
    const number = this.reserve();
    this.set(number, dict, stream);
    return number;
  }

  /** A stream object, Flate-compressed unless the file was created uncompressed or `raw` is set. */
  addStream(dict, bytes, { raw = false } = {}) {
    const data = typeof bytes === "string" ? encoder.encode(bytes) : bytes;
    if (this.compress && !raw && data.length > 32) {
      return this.add(`${dict}/Filter/FlateDecode`, flate(data));
    }
    return this.add(dict, data);
  }

  /** The complete file. `catalog`, `info` are object numbers. */
  serialize({ catalog, info }) {
    const chunks = [];
    let offset = 0;
    const push = (data) => {
      const bytes = typeof data === "string" ? latin1(data) : data;
      chunks.push(bytes);
      offset += bytes.length;
    };
    push("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n");
    const offsets = [];
    for (let index = 0; index < this.objects.length; index++) {
      const object = this.objects[index];
      if (!object) throw new Error(`PDF object ${index + 1} was reserved but never filled.`);
      offsets.push(offset);
      if (object.stream) {
        push(`${index + 1} 0 obj\n<<${object.dict}/Length ${object.stream.length}>>\nstream\n`);
        push(object.stream);
        push("\nendstream\nendobj\n");
      } else {
        push(`${index + 1} 0 obj\n<<${object.dict}>>\nendobj\n`);
      }
    }
    const startxref = offset;
    let table = `xref\n0 ${this.objects.length + 1}\n0000000000 65535 f \n`;
    for (const position of offsets) table += String(position).padStart(10, "0") + " 00000 n \n";
    push(table);
    // The identifier is a hash of everything before the trailer: identical input, identical file.
    const digest = hex(sha256(concat(chunks)).subarray(0, 16));
    push(`trailer\n<</Size ${this.objects.length + 1}/Root ${ref(catalog)}${info ? `/Info ${ref(info)}` : ""}/ID[<${digest}><${digest}>]>>\nstartxref\n${startxref}\n%%EOF\n`);
    return concat(chunks);
  }
}

function latin1(text) {
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index++) bytes[index] = text.charCodeAt(index) & 0xff;
  return bytes;
}

export function concat(chunks) {
  let length = 0;
  for (const chunk of chunks) length += chunk.length;
  const out = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) { out.set(chunk, position); position += chunk.length; }
  return out;
}

export { encoder as utf8Encoder };
