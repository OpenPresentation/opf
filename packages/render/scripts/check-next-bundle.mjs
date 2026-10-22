#!/usr/bin/env node
// render#199: build and serve a minimal Next.js app that imports the packed package with no next.config, and check that the server
// bundle renders what plain Node renders: the same SVG bytes (subset faces, whole faces, text drawn as outlines, the office pack's
// vendored Intos faces), both HarfBuzz engines loaded and no diagnostics, from a route handler and from a server component.
// It needs the network (it installs Next.js and React into a temporary directory; neither is a dependency of this repository) and
// takes a few minutes, so it is not part of `pnpm test`: test/bundler-safe-resolve.mjs is the fast source guard CI runs.
//   pnpm run test:next-bundle                       Turbopack (the Next.js default)
//   pnpm run test:next-bundle --webpack             Turbopack, then webpack
//   pnpm run test:next-bundle --keep                keep the temporary app and print its path
//   pnpm run test:next-bundle --tarball <file>      check a tarball (a published version, another branch) instead of packing this checkout
// The checkout is packed with `pnpm pack` together with core and the gallery (the workspace has no registry copy of the version under
// development; scripts/workspace-pack.mjs); a --tarball is installed with the core range its own manifest declares, from the registry.
// OPF_NEXT_VERSION and OPF_REACT_VERSION choose other Next.js and React versions.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { npm, packWithDependencies, packageRoot, packedManifest } from './workspace-pack.mjs';

const NEXT = process.env.OPF_NEXT_VERSION ?? '16.4.0', REACT = process.env.OPF_REACT_VERSION ?? '19.3.0';
const argv = process.argv.slice(2), tarballFlag = argv.indexOf('--tarball'), bundlers = ['turbopack', ...(argv.includes('--webpack') ? ['webpack'] : [])];
const manifest = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

const RENDER = `import { createHash } from "node:crypto";
import { gallery as defaultCatalog } from "@openpresentation/gallery";
import { toSvg } from "@openpresentation/opf-render";
import { loadFonts } from "@openpresentation/opf-render/fonts-node";

const hash = (text) => createHash("sha256").update(text).digest("hex");
const catalogs = [defaultCatalog];
const deck = { name: "Bundle", design: { fontScheme: "roboto" }, slides: [{ title: "Quarterly review", text: [{ text: "Revenue grew 12% — office affine" }] }] };
const officeDeck = { name: "Office", slides: [{ title: "Quarterly review", text: "Intos previews Aptos" }] };

export async function render() {
  const diagnostics = [], onDiagnostic = (diagnostic) => diagnostics.push(diagnostic.code);
  const base = await loadFonts({ onDiagnostic }), office = await loadFonts({ pack: "office", substitutionPolicy: "visual", onDiagnostic });
  const subset = toSvg(deck, 1, { catalogs, fonts: base });
  return {
    subsets: [base, office].map((fonts) => typeof fonts.subsets?.subsetDataUrl === "function"),
    diagnostics,
    fontFaces: (subset.match(/@font-face/g) ?? []).length,
    svg: {
      subset: hash(subset),
      whole: hash(toSvg(deck, 1, { catalogs, fonts: base, subsetFonts: false })),
      paths: hash(toSvg(deck, 1, { catalogs, fonts: base, text: "paths" })),
      office: hash(toSvg(officeDeck, 1, { catalogs, fonts: office })),
    },
  };
}
`;
const FILES = {
  'lib/render.js': RENDER,
  'app/layout.js': 'export default function RootLayout({ children }) {\n  return <html lang="en"><body>{children}</body></html>;\n}\n',
  'app/page.js': 'import { render } from "../lib/render.js";\n\nexport const dynamic = "force-dynamic";\n\nexport default async function Page() {\n  return <pre id="render">{JSON.stringify(await render())}</pre>;\n}\n',
  'app/api/render/route.js': 'import { render } from "../../../lib/render.js";\n\nexport const dynamic = "force-dynamic";\n\nexport async function GET() {\n  return Response.json(await render());\n}\n',
  'plain.mjs': 'import { render } from "./lib/render.js";\nconsole.log(JSON.stringify(await render()));\n',
};

async function serve(app, port) {
  const server = spawn(process.execPath, [path.join(app, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port)], { cwd: app, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  server.stdout.on('data', (chunk) => { log += chunk; });
  server.stderr.on('data', (chunk) => { log += chunk; });
  try {
    const deadline = Date.now() + 60_000;
    for (;;) {
      try { const response = await fetch(`http://localhost:${port}/api/render`); if (response.status !== 200) throw new Error(`/api/render ${response.status}:\n${log}`); break; }
      catch (error) { if (error.message.startsWith('/api/render') || Date.now() > deadline) throw error; await new Promise((resolve) => setTimeout(resolve, 500)); }
    }
    const route = await (await fetch(`http://localhost:${port}/api/render`)).json();
    const html = await (await fetch(`http://localhost:${port}/`)).text();
    const page = JSON.parse(html.match(/<pre id="render">(.*?)<\/pre>/s)?.[1].replaceAll('&quot;', '"') ?? 'null');
    return { route, page, log };
  } finally {
    server.kill();
  }
}

const temporary = mkdtempSync(path.join(tmpdir(), 'opf-render-next-'));
try {
  // This checkout: render, core and the gallery as tarballs. A --tarball: that file alone, with core from the registry at the range its manifest declares.
  const packed = tarballFlag === -1 ? packWithDependencies(temporary) : undefined;
  const tarball = packed ? packed.self.tarball : path.resolve(argv[tarballFlag + 1]);
  const declared = packedManifest(tarball);
  assert.ok(!JSON.stringify(declared).includes('workspace:'), `${tarball} is not a packed manifest (it carries a workspace: specifier)`);
  const app = path.join(temporary, 'app'), core = '@openpresentation/opf';
  const fontPeers = Object.keys(manifest.peerDependencies).filter((name) => /^@expo-google-fonts\/(roboto|roboto-mono|arimo|caladea|cousine|gelasio|tinos|noto-sans)$/.test(name));
  mkdirSync(app);
  writeFileSync(path.join(app, 'package.json'), JSON.stringify({
    private: true, type: 'module',
    dependencies: { next: NEXT, react: REACT, 'react-dom': REACT, [manifest.name]: `file:${tarball}`, ...(packed ? { [core]: `file:${packed.core.tarball}`, '@openpresentation/gallery': `file:${packed.gallery.tarball}` } : { [core]: declared.dependencies[core] }), ...Object.fromEntries(fontPeers.map((name) => [name, manifest.devDependencies[name]])) },
    overrides: { [manifest.name]: `$${manifest.name}` },
  }, null, 2));
  for (const [file, text] of Object.entries(FILES)) { mkdirSync(path.dirname(path.join(app, file)), { recursive: true }); writeFileSync(path.join(app, file), text); }
  npm(['install', '--no-audit', '--no-fund'], app);
  const plain = JSON.parse(execFileSync(process.execPath, ['plain.mjs'], { cwd: app, encoding: 'utf8' }));
  assert.deepEqual(plain.subsets, [true, true], 'plain Node subsets with both packs');
  assert.deepEqual(plain.diagnostics, [], 'plain Node loads both HarfBuzz engines');
  for (const [index, bundler] of bundlers.entries()) {
    rmSync(path.join(app, '.next'), { recursive: true, force: true });
    execFileSync(process.execPath, [path.join(app, 'node_modules/next/dist/bin/next'), 'build', ...(bundler === 'webpack' ? ['--webpack'] : [])], { cwd: app, encoding: 'utf8', stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
    const { route, page } = await serve(app, 3290 + index);
    assert.deepEqual(route, plain, `${bundler}: the route handler renders what plain Node renders`);
    assert.deepEqual(page, plain, `${bundler}: the server component renders what plain Node renders`);
    console.log(`Next.js ${NEXT} (${bundler}): next build passed with no config; the server renders plain Node's bytes (${plain.fontFaces} subset faces, HarfBuzz loaded).`);
  }
} finally {
  if (argv.includes('--keep')) console.log(`Kept ${temporary}`);
  else rmSync(temporary, { recursive: true, force: true });
}
