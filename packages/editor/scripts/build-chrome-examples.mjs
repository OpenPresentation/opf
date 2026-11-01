// CE-30: builds the chrome examples (examples/chrome/*.html) into artifacts/chrome-examples/, the way a host's bundler would.
//
// - Each example is one page plus one entry (`embed.js`, `react.jsx`, ...). The entries import the editor by its package name
//   (`@openpresentation/opf-editor/workspace`), exactly as the guide shows; this script resolves those names through the package's own
//   `exports` map to the built `dist/` (run `pnpm run build` first), so the examples exercise what the package publishes.
// - Fonts are the renderer's preview font root (`copyPreviewFonts`, the layout of `npx opf-preview-fonts`), served next to the pages and loaded
//   with `loadPreviewFonts`: Roboto Regular at startup, every other face only when a deck draws it, hash-verified. Never a font CDN.
// - Catalogs come from @openpresentation/gallery. The stylesheets are the package's `styles.css` and `styles.layered.css`.
//
// OPF_CHROME_EXAMPLES_OUT builds somewhere else (the tests build a second copy).
import { build } from 'esbuild';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyPreviewFonts } from '@openpresentation/opf-render/preview-fonts-node';
import { buildStyles } from './build-styles.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'examples', 'chrome');
const out = process.env.OPF_CHROME_EXAMPLES_OUT ? path.resolve(process.env.OPF_CHROME_EXAMPLES_OUT) : path.join(root, 'artifacts', 'chrome-examples');

const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const PACKAGE = manifest.name;

/** Resolves `@openpresentation/opf-editor[/subpath]` through this package's `exports` map, as a consumer's bundler would after `npm install`. */
const selfResolve = {
  name: 'opf-editor-self',
  setup(b) {
    b.onResolve({ filter: /^@openpresentation\/opf-editor(\/.*)?$/ }, (args) => {
      const key = `.${args.path.slice(PACKAGE.length)}`;
      const entry = manifest.exports[key];
      const file = typeof entry === 'string' ? entry : entry?.default;
      if (!file) return { errors: [{ text: `${args.path} is not exported by ${PACKAGE}.` }] };
      const resolved = path.join(root, file);
      if (!existsSync(resolved)) return { errors: [{ text: `${file} is not built. Run \`pnpm run build\` in packages/editor first.` }] };
      return { path: resolved };
    });
  },
};

const entries = (await readdir(source)).filter((name) => /\.(js|jsx)$/.test(name) && name !== 'deck.js');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await build({
  entryPoints: entries.map((name) => path.join(source, name)),
  outdir: out,
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'browser',
  minify: true,
  jsx: 'automatic',
  chunkNames: 'chunks/[name]-[hash]',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [selfResolve],
  logLevel: 'error',
});

for (const name of (await readdir(source)).filter((file) => /\.(html|css)$/.test(file))) await copyFile(path.join(source, name), path.join(out, name));

// The package stylesheets, built from src/styles the way the playground does (tokens first, then the other files), plain and in `@layer opf`.
const styles = await buildStyles(pathToFileURL(path.join(root, 'src', 'styles') + path.sep));
await writeFile(path.join(out, 'styles.css'), styles.css);
await writeFile(path.join(out, 'styles.layered.css'), styles.layered);

// The font root: `loadPreviewFonts('./opf-fonts/')`. Eager and vendored faces; the script faces (Japanese, Arabic, ...) are for decks that need them.
const fonts = copyPreviewFonts({ outDir: path.join(out, 'opf-fonts') });
if (fonts.missing.length) throw new Error(`Preview font packages are not installed: ${fonts.missing.join(', ')}`);

console.log(`Chrome examples built in ${out} (${entries.length} entries, ${fonts.copied + fonts.verified} font files)`);
