// RR-98: assemble dist/styles.css from src/styles/*.css, with no preprocessor.
// tokens.css comes first (every other file uses only its --opf-ui-* variables); the rest follow in alphabetical order, so a component
// that adds src/styles/<name>.css needs no edit here. Plain concatenation: no @import (the file must not fetch anything).
import { readdir, readFile } from "node:fs/promises";

const TOKENS = "tokens.css";

// CE-29: the same stylesheet inside `@layer opf { ... }` (dist/styles.layered.css), for hosts that want any unlayered rule of theirs to win
// without raising its specificity. A `@charset` rule must be first in a file and an `@import` rule may not be inside a layer, so those are
// hoisted above the layer (the build rejects an `@import` today, so only `@charset` can occur); `@font-face` and `@media` are valid inside it.
export const LAYER_NAME = "opf";
export function layerStyles(css) {
  const hoisted = [];
  const body = css.replace(/^[ \t]*@(?:charset|import)\b[^;]*;[ \t]*\n?/gm, (rule) => {
    hoisted.push(rule.trim());
    return "";
  });
  return `${hoisted.map((rule) => `${rule}\n`).join("")}@layer ${LAYER_NAME} {\n${body.trimEnd()}\n}\n`;
}

// Returns the stylesheet text, the same text wrapped in the `opf` layer, and the file names it was built from, in order.
export async function buildStyles(stylesDirectory) {
  const names = (await readdir(stylesDirectory)).filter((name) => name.endsWith(".css")).sort();
  if (!names.includes(TOKENS)) throw new Error(`${TOKENS} is missing from ${stylesDirectory}`);
  const ordered = [TOKENS, ...names.filter((name) => name !== TOKENS)];
  const parts = [];
  for (const name of ordered) {
    const text = await readFile(new URL(name, stylesDirectory), "utf8");
    if (/@import\b|url\(\s*["']?https?:/i.test(text)) throw new Error(`${name} must not import or fetch anything (RR-98).`);
    const body = text.replace(/\r\n/g, "\n").trimEnd();
    parts.push(name === TOKENS ? body : `/* ${name} */\n${body}`);
  }
  const css = `${parts.join("\n\n")}\n`;
  return { css, layered: layerStyles(css), files: ordered };
}
