// PptxGenJS embeds one media part per picture, so a picture repeated on many
// slides repeats its bytes. Identical media parts collapse into the first one
// (in path order); every relationship that pointed at a removed part is
// re-targeted, so each slide still owns its own relationship and picture.
const hashBytes = bytes => {
  // Bucket key only (cyrb53); equal buckets are confirmed byte for byte.
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let index = 0; index < bytes.byteLength; index += 1) {
    h1 = Math.imul(h1 ^ bytes[index], 2654435761);
    h2 = Math.imul(h2 ^ bytes[index], 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
};
/** The content key of a media part's bytes: its length and hash (a bucket key; equal keys are confirmed byte for byte where it matters). */
export const mediaKey = bytes => `${bytes.byteLength}:${hashBytes(bytes)}`;
const sameBytes = (a, b) => a.byteLength === b.byteLength && a.every((value, index) => value === b[index]);
const decoder = new TextDecoder(), encoder = new TextEncoder();

/**
 * Remove duplicate ppt/media parts from entries (and their metadata), and
 * re-target relationships. resolve(sourcePart, target) gives a package path.
 * Returns the Map of removed path to the part that replaced it.
 */
export function dedupeMedia(entries, metadata, resolve) {
  const canonical = new Map(), buckets = new Map();
  for (const path of Object.keys(entries).filter(path => /^ppt\/media\/[^/]+$/.test(path)).sort()) {
    const bytes = entries[path], key = `${bytes.byteLength}:${hashBytes(bytes)}`;
    const match = (buckets.get(key) ?? []).find(candidate => sameBytes(entries[candidate], bytes));
    if (match) canonical.set(path, match);
    else buckets.set(key, [...(buckets.get(key) ?? []), path]);
  }
  if (!canonical.size) return canonical;
  for (const part of Object.keys(entries).filter(path => path.endsWith('.rels'))) {
    const source = part.replace(/(^|\/)_rels\/([^/]*)\.rels$/, '$1$2');
    const xml = decoder.decode(entries[part]);
    const next = xml.replace(/\bTarget="([^"]+)"/g, (attribute, target) => {
      const replacement = canonical.get(resolve(source, target));
      return replacement ? `Target="${target.slice(0, target.lastIndexOf('/') + 1)}${replacement.slice(replacement.lastIndexOf('/') + 1)}"` : attribute;
    });
    if (next !== xml) entries[part] = encoder.encode(next);
  }
  for (const path of canonical.keys()) { delete entries[path]; metadata?.delete(path); }
  return canonical;
}
