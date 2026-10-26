// `documentHash` (CE-04): a stable content hash of an OPF document, the precondition of `applyPatch`'s `expectHash`.
//
// - Canonical form: JSON with the members of every object sorted by UTF-16 code unit (RFC 8785, JSON Canonicalization Scheme)
//   and no whitespace. Two documents hash alike exactly when `jsonEqual` calls them equal, so the hash does not depend on the
//   key order a file, a YAML or Markdown round trip or a host's serializer happened to write. (`format` is not used: it keeps
//   keys the schema does not declare in their written order, which is right for a file and wrong for an identity.)
// - Digest: SHA-256 in pure JavaScript, synchronous, with no Node import and no Web Crypto: the same bytes in Node, browsers
//   and edge runtimes, and a hash that can be checked inside the synchronous `applyPatch`. Web Crypto would make every patch
//   application asynchronous.
// - Form: `sha256:` and 64 lowercase hex digits. The prefix keeps the value apart from the CLI's `--expect-sha256`, which is the
//   digest of a file's bytes.

/**
 * The canonical JSON text of a JSON value: object members sorted by key (UTF-16 code units), no whitespace, numbers and strings as
 * `JSON.stringify` writes them (the ECMAScript forms RFC 8785 requires). Members whose value is `undefined`, a function or a symbol are
 * left out as `JSON.stringify` does; a cycle throws a `TypeError`.
 */
export function canonicalJson(value: unknown): string {
  const stack: object[] = [];
  const write = (item: unknown): string | undefined => {
    if (item === null || typeof item === "boolean" || typeof item === "string") return JSON.stringify(item);
    if (typeof item === "number") return JSON.stringify(item);
    if (typeof item === "bigint") throw new TypeError("A BigInt is not JSON.");
    if (typeof item !== "object") return undefined;
    if (stack.includes(item)) throw new TypeError("A cyclic value has no canonical JSON.");
    stack.push(item);
    let text: string;
    if (Array.isArray(item)) {
      text = `[${item.map((entry) => write(entry) ?? "null").join(",")}]`;
    } else {
      const record = item as Record<string, unknown>;
      const members: string[] = [];
      for (const key of Object.keys(record).sort()) {
        const member = write(record[key]);
        if (member !== undefined) members.push(`${JSON.stringify(key)}:${member}`);
      }
      text = `{${members.join(",")}}`;
    }
    stack.pop();
    return text;
  };
  return write(value) ?? "null";
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 of `bytes` as 64 lowercase hex digits (FIPS 180-4). */
export function sha256Hex(bytes: Uint8Array): string {
  const length = bytes.length;
  // Padding: 0x80, zeros, then the bit length as a 64-bit big-endian integer, to a multiple of 64 bytes.
  const padded = new Uint8Array(((length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(length / 0x20000000), false);
  view.setUint32(padded.length - 4, (length << 3) >>> 0, false);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const a = w[i - 15]!, b = w[i - 2]!;
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) | 0;
    }
    let a = h[0]!, b = h[1]!, c = h[2]!, d = h[3]!, e = h[4]!, f = h[5]!, g = h[6]!, hh = h[7]!;
    for (let i = 0; i < 64; i += 1) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const choose = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + choose + K[i]! + w[i]!) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + majority) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0]! + a) | 0; h[1] = (h[1]! + b) | 0; h[2] = (h[2]! + c) | 0; h[3] = (h[3]! + d) | 0;
    h[4] = (h[4]! + e) | 0; h[5] = (h[5]! + f) | 0; h[6] = (h[6]! + g) | 0; h[7] = (h[7]! + hh) | 0;
  }
  let hex = "";
  for (const word of h) hex += word.toString(16).padStart(8, "0");
  return hex;
}

/**
 * The content hash of a document: `sha256:` and the SHA-256 of its canonical JSON (members sorted at every depth), as 64 lowercase
 * hex digits. It is the same in Node, browsers and edge runtimes, does not depend on key order or on the file form the document was
 * read from, and changes with any change of content, including the order of arrays. Pass it as `expectHash` to `applyPatch` or `edit`
 * to apply a patch only to the document it was made for.
 */
export function documentHash(document: unknown): string {
  return `sha256:${sha256Hex(new TextEncoder().encode(canonicalJson(document)))}`;
}

const HASH_PATTERN = /^(?:sha256:)?([0-9a-fA-F]{64})$/;

/** The normal form (`sha256:` and lowercase hex) of a hash, or `undefined` when `value` is not a document hash. A bare 64-digit hex digest is accepted. */
export function normalizeDocumentHash(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = HASH_PATTERN.exec(value);
  return match ? `sha256:${match[1]!.toLowerCase()}` : undefined;
}
