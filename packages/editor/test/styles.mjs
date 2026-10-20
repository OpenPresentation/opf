import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildStyles } from "../scripts/build-styles.mjs";

// RR-98: dist/styles.css is generated from src/styles/*.css (tokens first, then the other files alphabetically), defines the whole
// --opf-ui-* contract for light and dark, uses only those tokens, and is exported as `@openpresentation/opf-editor/styles.css`.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stylesDirectory = path.join(root, "src", "styles");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

// The token contract from the playground brief: light and dark values for every color token.
const COLORS = {
  "--opf-ui-bg": ["hsl(210 30% 98%)", "hsl(220 24% 9%)"],
  "--opf-ui-surface": ["hsl(0 0% 100%)", "hsl(220 22% 11%)"],
  "--opf-ui-muted": ["hsl(214 28% 93%)", "hsl(220 18% 16%)"],
  "--opf-ui-muted-2": ["hsl(214 28% 96%)", "hsl(220 18% 13%)"],
  "--opf-ui-fg": ["hsl(220 28% 11%)", "hsl(210 28% 92%)"],
  "--opf-ui-muted-fg": ["hsl(218 14% 38%)", "hsl(215 13% 68%)"],
  "--opf-ui-accent": ["hsl(214 57% 28%)", "hsl(214 57% 52%)"],
  "--opf-ui-accent-fg": ["hsl(0 0% 100%)", "hsl(220 24% 9%)"],
  "--opf-ui-accent-strong": ["hsl(214 57% 28%)", "hsl(214 74% 72%)"],
  "--opf-ui-border": ["hsl(214 22% 83%)", "hsl(220 17% 24%)"],
  "--opf-ui-border-strong": ["hsl(214 22% 72%)", "hsl(220 17% 34%)"],
  "--opf-ui-ring": ["hsl(214 57% 28%)", "hsl(214 57% 62%)"],
  "--opf-ui-danger": ["hsl(0 72% 45%)", "hsl(0 65% 56%)"],
  "--opf-ui-warn": ["hsl(28 75% 38%)", "hsl(32 80% 70%)"],
  "--opf-ui-success": ["hsl(152 76% 26%)", "hsl(152 60% 70%)"],
  "--opf-ui-code-bg": ["hsl(220 30% 96%)", "hsl(222 22% 13%)"],
  "--opf-ui-code-border": ["hsl(214 18% 84%)", "hsl(220 16% 24%)"],
};
const OTHER = {
  "--opf-ui-font": "Inter, system-ui, sans-serif",
  "--opf-ui-mono": '"Geist Mono", ui-monospace, Menlo, monospace',
  "--opf-ui-radius-sm": "4px",
  "--opf-ui-radius": "6px",
  "--opf-ui-radius-md": "8px",
  "--opf-ui-radius-lg": "12px",
  "--opf-ui-control-h": "32px",
  "--opf-ui-shadow-pop": ["0 8px 24px rgba(0, 0, 0, 0.1)", "0 8px 24px rgba(0, 0, 0, 0.4)"],
  "--opf-ui-ease": "120ms ease",
};

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const squash = (text) => text.replace(/\s+/g, " ").trim();
// Every simple `selector { declarations }` block, as { selectors: [...], body }. Blocks inside @media are matched too.
function blocks(css) {
  const found = [];
  for (const match of strip(css).matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    found.push({ selectors: match[1].split(",").map(squash), body: match[2] });
  }
  return found;
}
const declared = (body, name) => {
  const match = new RegExp(`(?:^|;|\\s)${name}\\s*:\\s*([^;]+);`).exec(body);
  return match ? squash(match[1]) : undefined;
};
const blockFor = (all, selector) => all.find((block) => block.selectors.includes(selector) && /--opf-ui-bg:/.test(block.body));

execFileSync(process.execPath, [path.join(root, "scripts", "build.mjs")], { cwd: root, stdio: "pipe" });

// 1. The file exists and starts with the token layer.
const built = path.join(root, "dist", "styles.css");
assert.ok(existsSync(built), "npm run build writes dist/styles.css");
const css = readFileSync(built, "utf8");
assert.ok(css.length > 0);
const tokensSource = readFileSync(path.join(stylesDirectory, "tokens.css"), "utf8").replace(/\r\n/g, "\n").trimEnd();
assert.ok(css.startsWith(tokensSource), "dist/styles.css starts with src/styles/tokens.css, byte for byte");
assert.ok(!/@import\b|url\(/.test(css), "the stylesheet fetches nothing: no @import and no url()");

// 2. Every file of src/styles is in it, tokens first, the rest alphabetical.
const files = readdirSync(stylesDirectory).filter((name) => name.endsWith(".css")).sort();
assert.ok(files.includes("tokens.css") && files.includes("panels.css"));
let cursor = 0;
for (const name of ["tokens.css", ...files.filter((name) => name !== "tokens.css")]) {
  const body = readFileSync(path.join(stylesDirectory, name), "utf8").replace(/\r\n/g, "\n").trimEnd();
  const at = css.indexOf(body, cursor);
  assert.ok(at >= cursor, `${name} is in dist/styles.css, after the files before it`);
  cursor = at + body.length;
}

// 3. The build picks up whatever files exist, in that order (other components add src/styles/<name>.css in their own pull requests).
const scratch = mkdtempSync(path.join(tmpdir(), "opf-styles-"));
try {
  for (const [name, text] of [["tokens.css", ":root{--opf-ui-bg:red}"], ["navigator.css", ".opf-nav{}"], ["handoff.css", ".opf-handoff{}"], ["source-pane.css", ".opf-source{}"], ["notes.txt", "ignored"]]) writeFileSync(path.join(scratch, name), text);
  const sample = await buildStyles(pathToFileURL(scratch + path.sep));
  assert.deepEqual(sample.files, ["tokens.css", "handoff.css", "navigator.css", "source-pane.css"]);
  assert.ok(sample.css.startsWith(":root{--opf-ui-bg:red}"));
  writeFileSync(path.join(scratch, "bad.css"), '@import "https://example.com/x.css";');
  await assert.rejects(buildStyles(pathToFileURL(scratch + path.sep)), /must not import or fetch/);
  rmSync(path.join(scratch, "tokens.css"));
  await assert.rejects(buildStyles(pathToFileURL(scratch + path.sep)), /tokens\.css is missing/);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

// 4. The token contract: every token, light and dark, with the brief's values.
const all = blocks(css);
const light = blockFor(all, ":root");
assert.ok(light && light.selectors.includes(".opf-ui"), "the light tokens apply on :root and .opf-ui");
const dark = blockFor(all, ".dark .opf-ui");
assert.ok(dark, "the dark tokens apply under .dark .opf-ui");
for (const selector of [".dark .opf-ui", ".opf-ui.dark", '[data-theme="dark"]']) assert.ok(dark.selectors.includes(selector), `dark mode applies under ${selector}`);
for (const [name, [lightValue, darkValue]] of Object.entries(COLORS)) {
  assert.equal(declared(light.body, name), lightValue, `${name} light`);
  assert.equal(declared(dark.body, name), darkValue, `${name} dark`);
}
for (const [name, value] of Object.entries(OTHER)) {
  const [lightValue, darkValue = lightValue] = Array.isArray(value) ? value : [value];
  assert.equal(declared(light.body, name), lightValue, `${name} light`);
  if (Array.isArray(value)) assert.equal(declared(dark.body, name), darkValue, `${name} dark`);
}
const touch = all.find((block) => block.selectors.includes('.opf-ui[data-density="touch"]'));
assert.equal(declared(touch?.body ?? "", "--opf-ui-control-h"), "40px", 'data-density="touch" makes controls 40px');

// The base rules: font, color, box-sizing, the focus ring and the reduced-motion guard.
const base = all.find((block) => block.selectors.length === 1 && block.selectors[0] === ".opf-ui" && /font-family/.test(block.body));
assert.match(base?.body ?? "", /font-family:\s*var\(--opf-ui-font\)/);
assert.match(base?.body ?? "", /color:\s*var\(--opf-ui-fg\)/);
assert.ok(all.some((block) => block.selectors.includes(".opf-ui *") && /box-sizing:\s*border-box/.test(block.body)));
assert.ok(all.some((block) => block.selectors.includes(".opf-ui :focus-visible") && /outline:\s*2px solid var\(--opf-ui-ring\)/.test(block.body) && /outline-offset:\s*2px/.test(block.body)));
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);

// 5. The other files use only the tokens: no color literals, and every --opf-ui-* variable they read exists.
const defined = new Set(Object.keys({ ...COLORS, ...OTHER }));
for (const name of files.filter((name) => name !== "tokens.css")) {
  const text = strip(readFileSync(path.join(stylesDirectory, name), "utf8"));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(text), `${name} has no color literal: use a --opf-ui-* token`);
  for (const [, token] of text.matchAll(/var\((--opf-ui-[a-z0-9-]+)/g)) assert.ok(defined.has(token), `${name} reads ${token}, which is not in the token contract`);
}

// 5b. The source pane's editor has no border or radius of its own: panels.css draws both on every `.cm-editor`, and the pane frame draws the edge.
const paneEditor = blocks(readFileSync(path.join(stylesDirectory, "source-pane.css"), "utf8")).find((block) => block.selectors.includes(".opf-source-code > .cm-editor"));
assert.ok(paneEditor, "source-pane.css styles the pane's editor");
assert.match(declared(paneEditor.body, "border") ?? "", /^(0|none)\b/, "the pane's editor resets the border panels.css draws");
assert.match(declared(paneEditor.body, "border-radius") ?? "", /^0\b/, "the pane's editor resets the radius panels.css draws");

// 6. The package exports resolve.
assert.deepEqual(pkg.exports["./styles.css"], { style: "./dist/styles.css", default: "./dist/styles.css" });
assert.ok(pkg.files.includes("dist"), "dist (with dist/styles.css) is published");
assert.ok(existsSync(path.join(root, pkg.exports["./styles.css"].default)));
assert.equal(fileURLToPath(import.meta.resolve("@openpresentation/opf-editor/styles.css")), built, "the package resolves its own ./styles.css export");
const listed = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: root, encoding: "utf8", shell: process.platform === "win32" }));
assert.ok(listed[0].files.some((file) => file.path === "dist/styles.css"), "npm pack includes dist/styles.css");

console.log("editor stylesheet checks passed");
