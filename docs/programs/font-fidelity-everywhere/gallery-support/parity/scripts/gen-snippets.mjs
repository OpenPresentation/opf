// Bundle the gallery's snippet builders (snippet-entry.ts) with esbuild, aliasing @/ to the gallery worktree and
// @openpresentation/opf/* to the core worktree dist, then write out/snippets.json.
// Env: PARITY_PREFIX (default "parity") selects sources/<prefix>-{opf,opf-render,pptx-gallery}; GALLERY_DIR overrides.
import path from 'node:path'; import {fileURLToPath, pathToFileURL} from 'node:url'; import {writeFile, mkdir} from 'node:fs/promises'; import {statSync} from 'node:fs';
const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../../../sources'); const PFX = process.env.PARITY_PREFIX ?? 'parity';
const {build} = await import(pathToFileURL(path.join(SRC, `${PFX}-opf-render/node_modules/esbuild/lib/main.js`)).href);
const GALLERY = process.env.GALLERY_DIR ?? path.join(SRC, `${PFX}-pptx-gallery`);
const CORE = path.join(SRC, `${PFX}-opf/packages/javascript`);
const isFile = p => { try { return statSync(p).isFile(); } catch { return false; } };
const plugin = {name: 'alias', setup(b) {
  b.onResolve({filter: /^@\//}, a => { const base = path.join(GALLERY, a.path.slice(2)); for (const ext of ['', '.ts', '.tsx', '.json']) if (isFile(base + ext)) return {path: base + ext}; return {path: base + '.ts'}; });
  b.onResolve({filter: /^@openpresentation\/opf(\/.*)?$/}, a => { const sub = a.path.slice('@openpresentation/opf'.length).replace(/^\//, '');
    if (!sub) return {path: path.join(CORE, 'dist/index.js')}; if (sub === 'package.json') return {path: path.join(CORE, 'package.json')};
    return {path: path.join(CORE, 'dist', sub.startsWith('spec/') ? sub : sub + '.js')}; });
}};
await mkdir(path.join(here, '../out'), {recursive: true});
const outfile = path.join(here, '../out/snippet-bundle.mjs');
await build({entryPoints: [path.join(here, 'snippet-entry.ts')], bundle: true, format: 'esm', platform: 'node', outfile, plugins: [plugin], logLevel: 'error', loader: {'.json': 'json'}});
const {allSnippets} = await import(pathToFileURL(outfile).href + '?' + Date.now());
const all = allSnippets();
await writeFile(path.join(here, '../out/snippets.json'), JSON.stringify(all));
const counts = {}; for (const s of all) { const k = `${s.dimension}${s.variant === 'published' ? '' : '@' + s.variant}`; counts[k] ??= {n: 0, err: 0}; counts[k].n++; if (s.error) counts[k].err++; }
console.log(JSON.stringify(counts));
