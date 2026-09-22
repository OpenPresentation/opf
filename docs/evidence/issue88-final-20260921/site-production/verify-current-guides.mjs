// Read-only local/canonical acceptance verifier. Run with Node 24 from the site.
// --write-baseline FILE captures runtime/catalog/example hashes before a docs pin change.
// --check-content DIR --out-dir DIR checks only explicit current prose entrypoints.
// Full mode: --site-root DIR --source-ref FULL_SHA --origin URL --integrity-baseline FILE --out-dir DIR
// Canonical mode also requires --site-sha FULL_SHA --deployment-receipt FILE (READY Vercel metadata).
// It never changes packages, documents, deployments, or the pull request state.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, readdir, readlink } from 'node:fs/promises';
import path from 'node:path';
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
    assert.ok(process.argv[i].startsWith('--') && process.argv[i + 1], `Expected --key value: ${process.argv[i]}`);
    args.set(process.argv[i].slice(2), process.argv[i + 1]);
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const docs = [
    { file: 'README.md', route: null, required: [/Published CLI 0\.9\.0/, /@openpresentation\/cli@0\.9\.0 skills install/, /current pin set: core 0\.11\.0, renderer 0\.9\.0, editor 0\.8\.0, PPTX 0\.9\.1 and CLI 0\.9\.0/], forbidden: [/current pin set[^\n]*0\.10\.1/] },
    { file: 'docs/agent-skills.md', route: '/docs/agent-skills', required: [/Published CLI 0\.9\.0/, /@openpresentation\/cli@0\.9\.0 skills install/, /Repository skill prose can be newer/, /do not change the CLI 0\.9\.0 tarball/], forbidden: [/CLI 0\.5\.0/, /CLI 0\.9\.0[^\n]*release candidate/] },
    { file: 'docs/live-editor.md', route: '/docs/live-editor', required: [/Published editor 0\.8\.0/, /@openpresentation\/opf@0\.11\.0/, /@openpresentation\/opf-render@0\.9\.0/, /@openpresentation\/opf-editor@0\.8\.0/, /@openpresentation\/opf-pptx@0\.9\.1/, /These helpers are published in editor 0\.8\.0/], forbidden: [/The verified public set is core 0\.7\.0/, /Current APIs are in coordinated local previews/, /Public package release with coordinated versions/, /golden baseline remains skipped/] },
    { file: 'docs/content-payloads.md', route: '/docs/content-payloads', required: [/current coordinated Node 24 train: core 0\.11\.0, renderer 0\.9\.0, editor 0\.8\.0 and PPTX 0\.9\.1/], forbidden: [/Use core 0\.6\.0, renderer 0\.4\.0, editor 0\.3\.0 and PPTX 0\.4\.0 together/] },
    { file: 'docs/ecosystem-development.md', route: '/docs/reference/ecosystem-development', required: [/Use Node 24 for the current source and published packages/, /current published compatible set is core 0\.11\.0, CLI 0\.9\.0, renderer 0\.9\.0, PPTX 0\.9\.1 and editor 0\.8\.0 on Node 24/, /historical September 9 integration/], forbidden: [/The published compatible set is core 0\.7\.0/] },
    { file: 'docs/table-text-colors.md', route: '/docs/reference/table-text-colors', required: [/published core 0\.11\.0, renderer 0\.9\.0 and PPTX 0\.9\.1 train/, /historical native rasters remain distinct/], forbidden: [/The unpublished shared-metric integration branches/] },
    { file: 'docs/quickstart.md', route: '/docs/reference/quickstart', required: [/@openpresentation\/opf@0\.11\.0/, /@openpresentation\/cli@0\.9\.0/, /@openpresentation\/opf-render@0\.9\.0/, /@openpresentation\/opf-editor@0\.8\.0/, /@openpresentation\/opf-pptx@0\.9\.1/], forbidden: [/@openpresentation\/(?:opf-render|opf-pptx)@0\.8\.1/, /@openpresentation\/opf-editor@0\.7\.1/] },
    { file: 'docs/compatibility-matrix.md', route: '/docs/reference/compatibility-matrix', required: [/furniture-flow-v2/, /OPF_FURNITURE_V1/, /p:hf/, /0\.9\.1/, /0\.1px/], forbidden: [/ColorRef paint needs a renderer release/] },
    { file: 'docs/data-import.md', route: '/docs/data-import', required: [/These APIs are published in core 0\.11\.0/, /CLI 0\.9\.0 includes/], forbidden: [/local coordinated preview packages/] },
    { file: 'docs/rich-text.md', route: '/docs/rich-text', required: [/These helpers are published through/, /in editor 0\.8\.0/], forbidden: [/coordinated local preview packages/] },
    { file: 'docs/dynamic-composition.md', route: '/docs/dynamic-composition', required: [/Metric internals \(published coordinated packages\)/, /Published core 0\.11\.0 exposes/, /furniture-flow-v2/, /remain open work/, /explicit human adjustments/], forbidden: [/Unpublished shared headers and footers/, /Metric internals \(unreleased integration\)/, /The candidate SVG renderer/] },
];
const report = { capturedAt: new Date().toISOString(), node: process.version, mode: args.has('check-content') ? 'content-only' : 'acceptance', scope: 'Explicit current entrypoints only; dated evidence is not evaluated as current claims. Completeness includes the configured full guide set without reinterpreting historical prose.', checks: [], pages: [], resources: [] };
function check(ok, label, details) { report.checks.push({ label, passed: Boolean(ok), ...(details ? { details } : {}) }); return ok; }
function checkDoc(text, doc) { for (const regex of doc.required)
    check(regex.test(text), `${doc.file}: requires ${regex}`); for (const regex of doc.forbidden)
    check(!regex.test(text), `${doc.file}: rejects ${regex}`); }
async function finish() { report.finishedAt = new Date().toISOString(); report.passed = report.checks.every(c => c.passed); if (args.has('out-dir')) {
    await mkdir(args.get('out-dir'), { recursive: true });
    await writeFile(path.join(args.get('out-dir'), 'current-guides-report.json'), JSON.stringify(report, null, 2) + '\n');
} console.log(JSON.stringify({ passed: report.passed, mode: report.mode, checks: report.checks.length, failed: report.checks.filter(c => !c.passed), pages: report.pages.length, resources: report.resources.length, sourceRef: report.sourceRef }, null, 2)); if (!report.passed)
    process.exitCode = 1; }
async function treeHash(root) { const rows = []; async function walk(rel = '') { for (const e of (await readdir(path.join(root, rel), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.posix.join(rel, e.name);
    if (e.isDirectory())
        await walk(p);
    else if (e.isFile()) {
        const bytes = await readFile(path.join(root, p));
        rows.push([p, bytes.length, sha(bytes)]);
    }
    else if (e.isSymbolicLink())
        rows.push([p, 'symlink', await readlink(path.join(root, p))]);
} } await walk(); return { files: rows.length, sha256: sha(JSON.stringify(rows)) }; }
async function integrity(siteRoot, manifest) { const pkg = await readJson(path.join(siteRoot, 'package.json')); const runtimes = {}; for (const name of ['opf', 'opf-render', 'opf-editor'])
    runtimes[`@openpresentation/${name}`] = await treeHash(path.join(siteRoot, 'node_modules/@openpresentation', name)); const catalog = manifest.files.filter(f => f.path.startsWith('spec/') || f.path.startsWith('examples/')).map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })).sort((a, b) => a.path.localeCompare(b.path)); return { dependencies: pkg.dependencies, devDependencies: pkg.devDependencies, engines: pkg.engines, packageManager: pkg.packageManager, lockSha256: sha(await readFile(path.join(siteRoot, 'pnpm-lock.yaml'))), releaseDataSha256: sha(await readFile(path.join(siteRoot, 'data/releases.json'))), installedRuntimes: runtimes, catalogAndExamples: { files: catalog.length, sha256: sha(JSON.stringify(catalog)) } }; }
try {
    assert.match(process.versions.node, /^24\./, 'Use Node 24 for acceptance');
    if (args.has('check-content')) {
        for (const doc of docs)
            checkDoc(await readFile(path.join(args.get('check-content'), doc.file), 'utf8'), doc);
        await finish();
    }
    else {
        const siteRoot = path.resolve(args.get('site-root') ?? process.cwd());
        const expected = await readJson(path.join(siteRoot, 'public/skills.json'));
        if (args.has('write-baseline')) {
            await writeFile(args.get('write-baseline'), JSON.stringify(await integrity(siteRoot, expected), null, 2) + '\n');
            console.log(`Saved integrity baseline ${args.get('write-baseline')}`);
        }
        else {
            const origin = new URL(args.get('origin'));
            assert.equal(origin.pathname, '/');
            assert.equal(origin.search, '');
            assert.equal(origin.hash, '');
            const local = ['127.0.0.1', 'localhost'].includes(origin.hostname);
            const sourceRef = args.get('source-ref');
            assert.match(sourceRef ?? '', /^[a-f0-9]{40}$/);
            const pkg = await readJson(path.join(siteRoot, 'package.json'));
            const source = await readJson(path.join(siteRoot, '.opf-source/.openpresentation-source.json'));
            assert.equal(pkg.opfSource.ref, sourceRef, 'Site docs pin');
            assert.equal(source.ref, sourceRef, 'Built snapshot pin');
            report.sourceRef = sourceRef;
            report.origin = origin.origin;
            if (!local) {
                assert.equal(origin.origin, 'https://www.openpresentation.org', 'Only canonical production is accepted outside loopback');
                assert.ok(args.has('deployment-receipt') && args.has('site-sha'), 'Production requires exact deployment receipt/source SHA');
                const d = await readJson(args.get('deployment-receipt'));
                assert.equal(d.meta.githubCommitSha, args.get('site-sha'));
                assert.equal(d.state, 'READY');
                assert.equal(d.target, 'production');
                assert.ok(d.alias.includes(origin.hostname));
                report.deployment = { id: d.id, siteSha: d.meta.githubCommitSha, documentationSource: sourceRef };
            }
            const baseline = await readJson(args.get('integrity-baseline'));
            const current = await integrity(siteRoot, expected);
            check(JSON.stringify(current) === JSON.stringify(baseline), 'Installed runtime/dependency/lock/release/catalog/example hashes unchanged');
            report.integrity = current;
            const require = createRequire(path.join(siteRoot, 'package.json'));
            const { chromium } = require('@playwright/test');
            const browser = await chromium.launch({ headless: true });
            report.browser = browser.version();
            try {
                const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
                const get = async (route) => { const r = await context.request.get(new URL(route, origin).href); const bytes = await r.body(); check(r.status() === 200, `${route}: HTTP 200`, { status: r.status() }); return bytes; };
                const manifestBytes = await get('/skills.json');
                const manifest = JSON.parse(manifestBytes.toString());
                check(JSON.stringify(manifest) === JSON.stringify(expected), 'Complete raw manifest matches accepted local snapshot');
                check(manifest.sourcePackageVersion === '0.11.0', 'Manifest source package is 0.11.0');
                report.manifest = { files: manifest.files.length, sourceDigest: manifest.sourceDigest, sha256: sha(manifestBytes) };
                const byPath = new Map(expected.files.map(f => [f.path, f]));
                const raw = async (file) => { const f = byPath.get(file); assert.ok(f, `Manifest entry missing: ${file}`); const bytes = await get(f.url); check(bytes.length === f.bytes && sha(bytes) === f.sha256, `${file}: raw bytes match manifest`); report.resources.push({ path: file, url: f.url, bytes: bytes.length, sha256: sha(bytes), expectedSha256: f.sha256 }); return bytes; };
                for (const doc of docs) {
                    const bytes = await raw(doc.file);
                    checkDoc(bytes.toString(), doc);
                }
                const fullBytes = await get('/llms-full.txt'), indexBytes = await get('/llms.txt');
                const full = fullBytes.toString(), index = indexBytes.toString();
                check(sha(fullBytes) === sha(await readFile(path.join(siteRoot, 'public/llms-full.txt'))), 'Complete guide output matches accepted build hash');
                check(sha(indexBytes) === sha(await readFile(path.join(siteRoot, 'public/llms.txt'))), 'Guide discovery output matches accepted build hash');
                check(!full.includes('\0') && !full.includes('\ufffd'), 'Guide prose has no binary NUL/replacement characters');
                const guides = expected.files.filter(f => f.path.startsWith('docs/') && f.path.endsWith('.md') && !f.path.startsWith('docs/evidence/'));
                const skills = expected.files.filter(f => /^skills\/[^/]+\/SKILL\.md$/.test(f.path));
                const inline = [...guides, ...skills, ...['examples/technical/full-feature-tour.opf.json', 'spec/schemas/opf.schema.json'].map(p => byPath.get(p))];
                for (const f of inline) {
                    assert.ok(f);
                    const bytes = await readFile(path.join(siteRoot, 'public/agent-docs', f.path));
                    const prefix = `Source: https://www.openpresentation.org/agent-docs/${f.path}\n\n` + (f.path.endsWith('.json') ? '```json\n' : '');
                    check(sha(bytes) === f.sha256 && full.includes(prefix + bytes.toString()), `${f.path}: complete accepted content with its source mapping inline`);
                }
                const allowed = new Set(inline.map(f => f.path));
                const markers = [...full.matchAll(/^Source: https:\/\/www\.openpresentation\.org\/agent-docs\/([^\n]+)$/gm)].map(m => m[1]);
                check(markers.every(p => allowed.has(p)), 'Only selected guides/skills/schema/example are inline source sections');
                const evidence = expected.files.filter(f => f.path.startsWith('docs/evidence/') && f.path.endsWith('.md'));
                for (const f of evidence)
                    check(index.includes(`](https://www.openpresentation.org${f.url})`), `${f.path}: evidence report stays linked`);
                for (const ext of ['.png', '.pptx', '.json', '.md']) {
                    const f = expected.files.find(f => f.path.startsWith('docs/evidence/') && f.path.endsWith(ext));
                    assert.ok(f);
                    await raw(f.path);
                }
                for (const f of ['spec/schemas/opf.schema.json', 'examples/technical/full-feature-tour.opf.json', 'docs/quickstart/developer-quickstart.opf.json'])
                    await raw(f);
                report.guides = { inlineMarkdown: guides.length, inlineSkills: skills.length, evidenceLinks: evidence.length, indexBytes: indexBytes.length, indexSha256: sha(indexBytes), fullBytes: fullBytes.length, fullSha256: sha(fullBytes) };
                for (const route of ['/agents', ...docs.filter(d => d.route).map(d => d.route)]) {
                    const page = await context.newPage();
                    const errors = [];
                    page.on('pageerror', e => errors.push(e.message));
                    const r = await page.goto(new URL(route, origin).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
                    await page.locator('main').waitFor();
                    const body = await page.locator('body').innerText();
                    check(r.status() === 200, `${route}: browser HTTP 200`);
                    check(errors.length === 0, `${route}: no page errors`, errors.length ? { errors } : undefined);
                    const doc = docs.find(d => d.route === route);
                    if (doc)
                        checkDoc(body.replace(/\s+/g, ' '), { ...doc, file: `rendered ${route}` });
                    else
                        check(body.includes('@openpresentation/cli@0.9.0'), '/agents: current repeatable CLI pin');
                    report.pages.push({ route, status: r.status(), finalUrl: page.url(), title: await page.title(), bodySha256: sha(body), pageErrors: errors });
                    if (args.has('out-dir') && ['/docs/reference/quickstart', '/docs/agent-skills', '/docs/live-editor'].includes(route)) {
                        await mkdir(args.get('out-dir'), { recursive: true });
                        if (doc) await page.getByText(doc.required[0]).first().scrollIntoViewIfNeeded();
                        await page.screenshot({ path: path.join(args.get('out-dir'), `${route.split('/').filter(Boolean).join('-')}.png`) });
                    }
                    await page.close();
                }
            }
            finally {
                await browser.close();
            }
            await finish();
        }
    }
}
catch (error) {
    check(false, 'Fatal verifier error', { message: error.message });
    await finish();
}
