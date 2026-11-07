import fs from 'node:fs';
import path from 'node:path';
// A deck with its relative ./assets/*.png|svg sources inlined as data URIs.
export function loadDeck(file) {
  const base = path.dirname(path.resolve(file));
  const text = fs.readFileSync(file, 'utf8').replace(/"(\.\/assets\/[^"]+\.(png|svg))"/g, (_, rel, ext) => `"data:image/${ext === 'svg' ? 'svg+xml' : 'png'};base64,${fs.readFileSync(path.join(base, rel)).toString('base64')}"`);
  return JSON.parse(text);
}
