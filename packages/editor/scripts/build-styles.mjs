// RR-98: assemble dist/styles.css from src/styles/*.css, with no preprocessor.
// tokens.css comes first (every other file uses only its --opf-ui-* variables); the rest follow in alphabetical order, so a component
// that adds src/styles/<name>.css needs no edit here. Plain concatenation: no @import (the file must not fetch anything).
import { readdir, readFile } from "node:fs/promises";

const TOKENS = "tokens.css";

// CE-29: the same stylesheet inside `@layer opf { ... }` (dist/styles.layered.css), for hosts that want any unlayered rule of theirs to win
// without raising its specificity. A `@charset` rule must be first in a file and an `@import` rule may not be inside a layer, so those are
// hoisted above the layer (the build rejects an `@import` today, so only `@charset` can occur); `@font-face` and `@media` are valid inside it.
export const LAYER_NAME = "opf";
// CE-30: CodeMirror injects its own theme at runtime as unlayered `<style>` rules, and an unlayered rule beats every layered one whatever the
// specificity, so inside the layer the package's rules for CodeMirror's elements (the gutters, the content padding, the hanging indent) would lose
// to CodeMirror's defaults and the code would be cut off on the left. Every rule whose selector names a CodeMirror class (`.cm-…`) therefore stays
// out of the layer: it follows it, unlayered, in its original order and under its original @media, @supports or @container. Those rules then meet
// CodeMirror's theme exactly as they do in styles.css, and a host overrides them as it would there (the same specificity, later).
export const UNLAYERED_SELECTOR = /\.cm-[A-Za-z]/;
export const UNLAYERED_NOTE = "/* Outside the layer: the rules for CodeMirror's elements, which CodeMirror's own unlayered theme would otherwise beat. */";
export function layerStyles(css) {
  const hoisted = [];
  const body = css.replace(/^[ \t]*@(?:charset|import)\b[^;]*;[ \t]*\n?/gm, (rule) => {
    hoisted.push(rule.trim());
    return "";
  });
  const { layered, unlayered } = splitUnlayered(body);
  const after = unlayered ? `\n${UNLAYERED_NOTE}\n${unlayered}\n` : "";
  return `${hoisted.map((rule) => `${rule}\n`).join("")}@layer ${LAYER_NAME} {\n${layered.trimEnd()}\n}\n${after}`;
}

const GROUPING = /^@(?:media|supports|container)\b/i;
const LEADING = /^(?:\s|\/\*[\s\S]*?\*\/)*/;
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "");

/** The top-level rules of `css`: `{ text, prelude, body }`, `text` being `prelude{body}` (or `prelude;` for a statement, without a body). */
function topLevelRules(css) {
  const rules = [];
  let start = 0;
  let depth = 0;
  let open = -1;
  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    if (char === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end < 0 ? css.length : end + 1;
    } else if (char === '"' || char === "'") {
      for (i++; i < css.length && css[i] !== char; i++) if (css[i] === "\\") i++;
    } else if (char === "{") {
      if (depth++ === 0) open = i;
    } else if (char === "}") {
      if (--depth === 0) {
        rules.push({ text: css.slice(start, i + 1), prelude: css.slice(start, open), body: css.slice(open + 1, i) });
        start = i + 1;
      }
    } else if (char === ";" && depth === 0) {
      rules.push({ text: css.slice(start, i + 1), prelude: css.slice(start, i) });
      start = i + 1;
    }
  }
  if (depth !== 0) throw new Error("The stylesheet has unbalanced braces.");
  return { rules, rest: css.slice(start) };
}

/**
 * Split `css` into the text that goes inside the layer (the input with the CodeMirror rules taken out; comments stay where they were) and the
 * CodeMirror rules (`UNLAYERED_SELECTOR`), in order, each inside a copy of the grouping rules it was in.
 */
export function splitUnlayered(css) {
  const { rules, rest } = topLevelRules(css);
  let layered = "";
  const unlayered = [];
  for (const rule of rules) {
    const lead = LEADING.exec(rule.text)[0];
    const prelude = stripComments(rule.prelude).trim();
    if (GROUPING.test(prelude) && rule.body !== undefined) {
      const inner = splitUnlayered(rule.body);
      if (!inner.unlayered) {
        layered += rule.text;
        continue;
      }
      unlayered.push(`${prelude} {\n${inner.unlayered}\n}`);
      layered += stripComments(inner.layered).trim() ? `${rule.prelude}{${inner.layered}}` : lead;
    } else if (rule.body !== undefined && !prelude.startsWith("@") && UNLAYERED_SELECTOR.test(prelude)) {
      // The comments before the rule stay where they are; the rule keeps the indentation of its first line.
      const indent = /[ \t]*$/.exec(lead)[0];
      layered += lead.slice(0, lead.length - indent.length);
      unlayered.push(rule.text.slice(lead.length - indent.length));
    } else {
      // A rule for the package's own elements, a statement, or an at-rule that is not a grouping one (@keyframes, @font-face).
      layered += rule.text;
    }
  }
  return { layered: layered + rest, unlayered: unlayered.join("\n") };
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
