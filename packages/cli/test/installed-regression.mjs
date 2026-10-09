// RR-59 (opf#476, audit findings AUTO-25 and AUTO-26): the installed-package contract of the CLI, checked end to end through the
// installed `opf` binary, its published opf-render and opf-pptx peers and the Noto script packages. Nothing else locks it: the
// font-policy test uses a stub renderer, and files.mjs does not render a script deck or export an unresolved remote image.
//
//   AUTO-25  `opf render --format svg` is standalone: a ja-JP (zh-CN) deck embeds Noto Sans JP (SC) 400 and 700, `--text system`
//            embeds no font bytes, and a Latin-only deck embeds no CJK face.
//   AUTO-26  `opf export --format pptx` never fetches an image URL: the placeholder is written with an `unresolved-asset` warning
//            finding at the slide path (image blocks, and the quote photo of opf-pptx#210), `--fail-on warning` exits 1 and writes
//            no file, and an embedded or local PNG exports a native picture even under `--fail-on warning`.
//   No fetches  every command runs with a preload that records and refuses any network connection or fetch, and a local HTTP server
//            that every image URL points at counts zero requests and zero connections.
//
// OPF_TEST_BIN is required: the installed binary (a global prefix, an `npm install` consumer or an npx install) whose node_modules
// holds opf-render, opf-pptx, sharp, @resvg/resvg-js, pdf-lib, the render font packages and @expo-google-fonts/noto-sans-jp and
// noto-sans-sc beside it. It is run by packed-files.mjs (candidate CLI and core tarballs; `pnpm test:cli:packed:peers`, which the CLI
// publish workflow runs) and by scripts/test-packed-ecosystem.mjs --registry (the published set). It is not part of `pnpm test:cli`
// (test/suites.json): the workspace has no Noto script package.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync, readFileSync, realpathSync} from 'node:fs';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import http from 'node:http';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {inflateRawSync} from 'node:zlib';
import {cliPeerGate, report as gateReport} from '../../../scripts/unreleased-gate.mjs';

const executable = process.env.OPF_TEST_BIN;
if (!executable) {
  console.error('installed-regression.mjs needs OPF_TEST_BIN, the installed opf binary (it runs from packed-files.mjs and the registry consumer).');
  process.exit(1);
}
const bin = realpathSync(executable);
// Same rule as files.mjs: while the published peers do not satisfy the installed CLI's ranges (a coordinated release not on npm yet), a pull
// request, merge-queue or roller-candidate run skips with a notice; every other run fails.
if (!gateReport(cliPeerGate({cliRoot: path.dirname(path.dirname(bin)), executable: bin, names: ['@openpresentation/opf-render', '@openpresentation/opf-pptx']}))) process.exit(0);
const require = createRequire(bin);
for (const name of ['@expo-google-fonts/noto-sans-jp', '@expo-google-fonts/noto-sans-sc', '@openpresentation/opf-render', '@openpresentation/opf-pptx']) {
  try { require.resolve(`${name}/package.json`); } catch { assert.fail(`${name} must be installed beside the CLI (${bin}) for this test`); }
}
// The script packages are pinned at the versions opf-render declares for them (exact peer ranges), so a renderer that moves them moves this test.
const renderManifest = JSON.parse(readFileSync(require.resolve('@openpresentation/opf-render/package.json'), 'utf8'));
for (const name of ['@expo-google-fonts/noto-sans-jp', '@expo-google-fonts/noto-sans-sc']) {
  const wanted = renderManifest.devDependencies?.[name] ?? renderManifest.peerDependencies?.[name];
  assert.ok(wanted, `opf-render ${renderManifest.version} declares ${name}`);
  assert.equal(JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8')).version, wanted.replace(/^[\^~]/, ''), `${name} is installed at the version opf-render declares`);
}

const temp = await mkdtemp(path.join(tmpdir(), 'opf-installed-regression-'));
const networkLog = path.join(temp, 'network.log');
let checks = 0;
const check = (fn) => { checks++; return fn(); };

// A server every image URL points at. A request, or only a connection attempt (an https URL reaches a plain-HTTP port as a TLS
// handshake), is a fetch.
const seen = {requests: 0, connections: 0};
const server = http.createServer((request, response) => { seen.requests++; response.statusCode = 404; response.end(); });
server.on('connection', () => { seen.connections++; });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const {port} = server.address();
const httpsPhoto = `https://127.0.0.1:${port}/photo.png`, httpPhoto = `http://127.0.0.1:${port}/photo.png`;

// Preloaded into every CLI process: any socket connection or fetch is recorded and refused, so a fetch to anywhere (not only the
// local server) fails the test even when the CLI swallowed the error.
const guard = path.join(temp, 'no-network.mjs');
await writeFile(guard, `import net from 'node:net';
import {appendFileSync} from 'node:fs';
const record = (kind, target) => appendFileSync(process.env.OPF_NETWORK_LOG, JSON.stringify({kind, target}) + '\\n');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const target = args[0];
  if ((target && typeof target === 'object' && target.path === undefined) || typeof target === 'number') { record('connect', JSON.stringify(target)); throw new Error('The test refuses network access: connect'); }
  return connect.apply(this, args);
};
globalThis.fetch = async input => { record('fetch', String(input?.url ?? input)); throw new Error('The test refuses network access: fetch'); };
`);
const readNetworkLog = async () => existsSync(networkLog) ? (await readFile(networkLog, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];

function run(args, {status = 0, cwd = temp, env = {}} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd,
      env: {...process.env, ...env, OPF_NETWORK_LOG: networkLog, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import ${pathToFileURL(guard).href}`.trim()},
    });
    const out = [], err = [];
    child.stdout.on('data', chunk => out.push(chunk));
    child.stderr.on('data', chunk => err.push(chunk));
    child.on('error', reject);
    const timer = setTimeout(() => { child.kill(); reject(new Error(`opf ${args.join(' ')} timed out`)); }, 240000);
    child.on('close', code => {
      clearTimeout(timer);
      const stdout = Buffer.concat(out).toString('utf8'), stderr = Buffer.concat(err).toString('utf8');
      try {
        assert.equal(code, status, JSON.stringify({args, stdout: stdout.slice(0, 3000), stderr: stderr.slice(0, 3000)}));
        let parsed;
        try { parsed = JSON.parse(stdout.trim() ? stdout : stderr); } catch { assert.fail(`opf ${args.join(' ')} printed no JSON report: ${stdout.slice(0, 500)}${stderr.slice(0, 500)}`); }
        checks++;
        resolve(parsed);
      } catch (error) { reject(error); }
    });
  });
}

// The faces a standalone SVG carries: `@font-face` rules with a base64 font payload.
function embeddedFaces(svg) {
  return [...svg.matchAll(/@font-face\{font-family:"([^"]+)";font-weight:(\d+);font-style:(\w+);src:url\("data:font\/([a-z0-9]+);base64,([A-Za-z0-9+/=]+)"\)/g)]
    .map(match => ({family: match[1], weight: Number(match[2]), style: match[3], format: match[4], bytes: Buffer.from(match[5], 'base64')}));
}
const facesOf = (faces, family) => faces.filter(face => face.family === family);

// Entries of a ZIP file by name (central directory), for the slide XML of a PPTX.
function zipEntry(bytes, wanted) {
  let end = bytes.length - 22;
  while (end >= 0 && bytes.readUInt32LE(end) !== 0x06054b50) end--;
  assert.ok(end >= 0, 'end of central directory');
  let offset = bytes.readUInt32LE(end + 16);
  for (let index = bytes.readUInt16LE(end + 10); index > 0; index--) {
    const method = bytes.readUInt16LE(offset + 10), size = bytes.readUInt32LE(offset + 20), length = bytes.readUInt16LE(offset + 28), extra = bytes.readUInt16LE(offset + 30), comment = bytes.readUInt16LE(offset + 32), local = bytes.readUInt32LE(offset + 42);
    if (bytes.toString('utf8', offset + 46, offset + 46 + length) === wanted) {
      const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
      const data = bytes.subarray(start, start + size);
      return (method === 0 ? data : inflateRawSync(data)).toString('utf8');
    }
    offset += 46 + length + extra + comment;
  }
  assert.fail(`${wanted} is not in the PPTX`);
}
const slideXml = async (file, number) => zipEntry(await readFile(path.join(temp, file)), `ppt/slides/slide${number}.xml`);
const pictures = xml => (xml.match(/<p:pic>/g) ?? []).length;
const placeholders = xml => (xml.match(/name="OPF image placeholder/g) ?? []).length;
const unresolved = report => report.findings.filter(item => item.ruleId === 'pptx/unresolved-asset');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const dataPng = `data:image/png;base64,${png.toString('base64')}`;
const writeDeck = (file, deck) => writeFile(path.join(temp, file), JSON.stringify(deck));

try {
  // The request counter and the guard work: a request is counted, a fetch is refused and recorded.
  await new Promise((resolve, reject) => http.get(`http://127.0.0.1:${port}/control`, response => { response.resume(); response.on('end', resolve); }).on('error', reject));
  assert.deepEqual([seen.requests, seen.connections], [1, 1], 'the request counter counts a request');
  seen.requests = 0; seen.connections = 0;
  await new Promise(resolve => {
    const probe = spawn(process.execPath, ['--import', pathToFileURL(guard).href, '-e', `fetch(${JSON.stringify(httpPhoto)}).then(() => process.exit(0), () => process.exit(7))`], {env: {...process.env, OPF_NETWORK_LOG: networkLog}});
    probe.on('close', code => { assert.equal(code, 7, 'the guard refuses a fetch'); resolve(); });
  });
  assert.deepEqual(await readNetworkLog(), [{kind: 'fetch', target: httpPhoto}]);
  assert.deepEqual([seen.requests, seen.connections], [0, 0]);
  await rm(networkLog, {force: true});

  // ---- AUTO-25: portable script-font SVG ------------------------------------------------------------------------------
  await writeDeck('ja.opf.json', {name: 'Japanese', language: 'ja-JP', slides: [{id: 'ja', title: '四半期レビュー', text: '売上はすべての地域で成長しました。'}]});
  await writeDeck('zh.opf.json', {name: 'Chinese', language: 'zh-CN', slides: [{id: 'zh', title: '季度回顾', text: '所有地区的收入都有增长。'}]});
  await writeDeck('en.opf.json', {name: 'English', slides: [{id: 'en', title: 'Quarterly review', text: 'Revenue grew in every region.'}]});

  const ja = await run(['render', 'ja.opf.json', '--format', 'svg', '--out', 'ja-svg']);
  assert.equal(ja.ok, true); assert.equal(ja.written, true);
  assert.deepEqual(ja.fonts.scripts?.packages, ['@expo-google-fonts/noto-sans-jp'], 'the Japanese deck selects the Noto Sans JP package');
  assert.deepEqual(ja.fonts.scripts?.notInstalled, []);
  assert.ok(!ja.findings.some(item => item.ruleId === 'fonts/script-font-not-installed'));
  assert.deepEqual(await readdir(path.join(temp, 'ja-svg')), ['Japanese-001.svg']);
  const jaSvg = await readFile(path.join(temp, 'ja-svg/Japanese-001.svg'), 'utf8');
  const jaFaces = embeddedFaces(jaSvg);
  const jp = facesOf(jaFaces, 'Noto Sans JP');
  assert.deepEqual(jp.map(face => face.weight).sort(), [400, 700], 'Noto Sans JP weights 400 and 700 are embedded');
  for (const face of jp) {
    assert.equal(face.style, 'normal');
    assert.ok(face.bytes.length > 1_000_000, `Noto Sans JP ${face.weight} carries real font bytes (${face.bytes.length})`);
    assert.equal(face.bytes.readUInt32BE(0), 0x00010000, 'a TrueType font');
  }
  assert.equal(facesOf(jaFaces, 'Noto Sans SC').length, 0, 'a Japanese deck embeds no Simplified Chinese face');
  assert.match(jaSvg, /font-family="Noto Sans JP, sans-serif"/, 'the text draws with the embedded family');
  checks++;

  const none = await run(['render', 'ja.opf.json', '--format', 'svg', '--text', 'system', '--out', 'ja-none']);
  assert.equal(none.ok, true);
  const noneSvg = await readFile(path.join(temp, 'ja-none/Japanese-001.svg'), 'utf8');
  assert.deepEqual(embeddedFaces(noneSvg), []);
  assert.ok(!noneSvg.includes('@font-face') && !/data:(font|application\/(x-)?font)/.test(noneSvg), '--text system embeds no font bytes');
  assert.ok(noneSvg.length < 20_000, `--text system leaves a small SVG (${noneSvg.length} bytes)`);
  checks++;

  const zh = await run(['render', 'zh.opf.json', '--format', 'svg', '--out', 'zh-svg']);
  assert.equal(zh.ok, true);
  const zhFaces = embeddedFaces(await readFile(path.join(temp, 'zh-svg/Chinese-001.svg'), 'utf8'));
  assert.deepEqual(facesOf(zhFaces, 'Noto Sans SC').map(face => face.weight).sort(), [400, 700], 'a zh-CN deck embeds Noto Sans SC 400 and 700');
  assert.equal(facesOf(zhFaces, 'Noto Sans JP').length, 0);
  checks++;

  const en = await run(['render', 'en.opf.json', '--format', 'svg', '--out', 'en-svg']);
  assert.equal(en.ok, true);
  const enSvg = await readFile(path.join(temp, 'en-svg/English-001.svg'), 'utf8');
  const enFaces = embeddedFaces(enSvg);
  assert.ok(enFaces.length > 0, 'a Latin deck still embeds its Latin faces');
  assert.deepEqual(enFaces.filter(face => /^Noto Sans (JP|SC|KR|TC)$/.test(face.family)), [], 'a Latin-only deck embeds no CJK face');
  assert.ok(!/Noto Sans (JP|SC|KR|TC)/.test(enSvg));
  assert.ok(Buffer.byteLength(enSvg) < 6_000_000, 'a Latin-only deck stays small');
  checks++;

  // ---- AUTO-26: the unresolved-image gate -------------------------------------------------------------------------------
  // Three content images no one can read: an https and an http image block, and the quote photo (opf-pptx#210, fixed in 0.16.0).
  await writeDeck('remote.opf.json', {name: 'Remote', slides: [
    {id: 'a', title: 'Remote https image', image: httpsPhoto},
    {id: 'b', title: 'Remote http image', image: httpPhoto},
    {id: 'c', quote: {text: 'A quote with a headshot', attribution: 'Someone', photo: {src: httpsPhoto, alt: 'Headshot'}}},
  ]});
  const warned = await run(['export', 'remote.opf.json', '--format', 'pptx', '--out', 'remote.pptx']);
  assert.equal(warned.ok, true, 'a warning does not fail the default gate');
  assert.equal(warned.written, true);
  assert.equal(warned.counts.error, 0);
  assert.equal(unresolved(warned).length, 3, JSON.stringify(warned.findings));
  assert.deepEqual(unresolved(warned).map(item => item.path).sort(), ['/slides/0/image', '/slides/1/image', '/slides/2/quote/photo']);
  for (const item of unresolved(warned)) {
    assert.equal(item.severity, 'warning'); assert.equal(item.category, 'pptx'); assert.equal(item.scope, 'document');
    assert.match(item.message, /never fetched/i);
  }
  assert.equal(warned.counts.warning, 3);
  for (const slide of [1, 2, 3]) {
    const xml = await slideXml('remote.pptx', slide);
    assert.equal(placeholders(xml), 1, `slide ${slide} carries the image placeholder`);
    assert.equal(pictures(xml), 0, `slide ${slide} has no picture`);
    assert.match(xml, /Image unavailable/);
  }
  checks++;

  const refused = await run(['export', 'remote.opf.json', '--format', 'pptx', '--out', 'remote-strict.pptx', '--fail-on', 'warning'], {status: 1});
  assert.equal(refused.ok, false); assert.equal(refused.written, false);
  assert.equal(unresolved(refused).length, 3);
  assert.equal(existsSync(path.join(temp, 'remote-strict.pptx')), false, '--fail-on warning writes no file');
  assert.ok(!(await readdir(temp)).some(name => name.startsWith('remote-strict')), 'and no temporary file either');
  checks++;

  // An embedded PNG, a quote photo and a local file next to the deck all export native pictures, with no finding.
  await mkdir(path.join(temp, 'assets'), {recursive: true});
  await writeFile(path.join(temp, 'assets/pixel.png'), png);
  await writeDeck('embedded.opf.json', {name: 'Embedded', slides: [
    {id: 'a', title: 'Embedded image', image: dataPng},
    {id: 'b', quote: {text: 'A quote with a headshot', attribution: 'Someone', photo: {src: dataPng, alt: 'Headshot'}}},
    {id: 'c', title: 'Local image', image: 'assets/pixel.png'},
  ]});
  const native = await run(['export', 'embedded.opf.json', '--format', 'pptx', '--out', 'embedded.pptx', '--fail-on', 'warning']);
  assert.equal(native.ok, true); assert.equal(native.written, true);
  assert.deepEqual(native.counts, {error: 0, warning: 0, info: 0}, JSON.stringify(native.findings));
  assert.deepEqual(unresolved(native), []);
  for (const slide of [1, 2, 3]) {
    const xml = await slideXml('embedded.pptx', slide);
    assert.equal(pictures(xml), 1, `slide ${slide} exports a native picture`);
    assert.equal(placeholders(xml), 0, `slide ${slide} has no placeholder`);
  }
  checks++;

  // ---- No fetches ---------------------------------------------------------------------------------------------------------
  // The same decks through render: the image URL is a render/unresolved-asset warning, never a request.
  const rendered = await run(['render', 'remote.opf.json', '--format', 'svg', '--out', 'remote-svg']);
  assert.ok(rendered.findings.some(item => item.ruleId === 'render/unresolved-asset' && item.path === '/slides/0/image'));
  assert.deepEqual(await readNetworkLog(), [], 'no process tried to connect or fetch');
  assert.deepEqual(seen, {requests: 0, connections: 0}, 'the request counter saw no request and no connection');
  checks++;
  console.log(`Installed CLI regression passed ${checks} checks (${bin}): script-font SVG (ja-JP, zh-CN, none, Latin-only), unresolved-asset warning and --fail-on warning gate (image blocks and quote photo), native pictures, zero fetches.`);
} finally {
  server.close();
  server.closeAllConnections?.();
  assert.ok(path.basename(temp).startsWith('opf-installed-regression-'));
  await rm(temp, {recursive: true, force: true});
}
