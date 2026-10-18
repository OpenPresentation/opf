// Registry identity for the maintained Keynote pack. No consumer entrypoint is imported here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync, execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {lstat, mkdir, readFile, readdir, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const integrity = bytes => 'sha512-' + createHash('sha512').update(bytes).digest('base64');
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const scope = '@openpresentation/';
const names = ['opf', 'opf-render', 'opf-pptx', 'gallery'].map(name => scope + name);
const pins = {[scope + 'opf']: '0.20.3', [scope + 'opf-render']: '0.20.2', [scope + 'gallery']: '3.0.0'};
const inside = (root, file) => {const value = path.relative(root, file); return value !== '..' && !value.startsWith('..' + path.sep) && !path.isAbsolute(value);};
const safe = value => typeof value === 'string' && !value.includes('\\') && !path.posix.isAbsolute(value) && value.split('/').every(part => part && part !== '.' && part !== '..' && !part.includes(':') && !/[\x00-\x1f\x7f]/.test(part));
const version = value => /^\d+\.\d+\.\d+$/.test(value ?? '');
export const reviewedVerifier = Object.freeze({revision: '041404a0d579c7183461962022e204f7ce8a6012', files: {
  'scripts/release-train.mjs': '058961e132340ad39d48cdfdb99cbd6c9a127e27d27b1bc33d57f7c5b4a9a786',
  'scripts/ecosystem-lock.mjs': '19f67a5923cceae90634df2347b5a8bb0ff2110c51819b9aa0b811c9555b9583',
  'scripts/candidate-gallery.mjs': '13d7caacd28b5de9e9b04d86a4e4f03a486d1f6b508d3b1b76f6b410b2d327c4',
  'scripts/release-plan-cli.mjs': '9d19b653a7d69a2108efca7b8fbcc604f5c02113822d1b339149e04837280830',
  'scripts/measurement-policy.mjs': '1228022e8e8345d0c175f24ef5dd96dc043be8fa93f61abfd27e3b40027dbc5f',
}});

async function regular(file) {
  const stat = await lstat(file); assert.ok(stat.isFile() && !stat.isSymbolicLink(), `Not a regular file: ${file}`);
  assert.equal(await realpath(file), path.resolve(file), 'Aliased file'); return readFile(file);
}
async function files(root, relative = '', excludeDependencies = false) {
  const result = [];
  for (const entry of await readdir(path.join(root, relative), {withFileTypes: true})) {
    if (excludeDependencies && !relative && entry.name === 'node_modules') continue;
    const name = path.posix.join(relative, entry.name);
    assert.ok(safe(name) && !entry.isSymbolicLink(), 'Unsafe installed or evidence member');
    if (entry.isDirectory()) result.push(...await files(root, name));
    else {assert.ok(entry.isFile(), 'Special installed or evidence member'); const bytes = await regular(path.join(root, name)); result.push({path: name, bytes: bytes.length, sha256: hash(bytes)});}
  }
  return result.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
export const registryTarballUrl = (name, value) => `https://registry.npmjs.org/${name}/-/${name.slice(name.indexOf('/') + 1)}-${value}.tgz`;
export function checkRegistryEntry(name, value, entry) {
  assert.ok(version(value), 'Exact stable registry version required');
  assert.ok(entry && !entry.link && entry.version === value, `${name}: lock version/link mismatch`);
  assert.equal(entry.resolved, registryTarballUrl(name, value), `${name}: official registry tarball required; no aliases/file/Git/workspace`);
  assert.match(entry.integrity ?? '', /^sha512-[A-Za-z0-9+/]{86}==$/, `${name}: SHA-512 integrity required`);
}

/** Resolve paths and read JSON only; never import a consumer module before archive verification. */
export async function inventoryRegistryConsumer(directory) {
  const consumer = path.resolve(directory); assert.equal(await realpath(consumer), consumer, 'Consumer must be canonical');
  const manifestBytes = await regular(path.join(consumer, 'package.json')), lockBytes = await regular(path.join(consumer, 'package-lock.json'));
  const manifest = JSON.parse(manifestBytes), lock = JSON.parse(lockBytes);
  assert.ok(lock.lockfileVersion >= 2 && lock.packages, 'Normal npm package lock required');
  assert.ok(!manifest.overrides, 'Registry consumer cannot override package identities');
  const require = createRequire(path.join(consumer, 'package.json')), packages = [];
  for (const name of names) {
    const declared = manifest.dependencies?.[name]; assert.ok(version(declared), `${name}: exact registry pin required`);
    if (pins[name]) assert.equal(declared, pins[name], `${name}: controlled registry version`);
    const root = path.join(consumer, 'node_modules', name), stat = await lstat(root);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'Registry package must be a normal directory');
    assert.equal(await realpath(root), root, 'Registry package cannot be aliased');
    assert.equal(require.resolve(name + '/package.json'), path.join(root, 'package.json'));
    const pkg = JSON.parse(await regular(path.join(root, 'package.json')));
    assert.equal(pkg.name, name); assert.equal(pkg.version, declared);
    checkRegistryEntry(name, declared, lock.packages['node_modules/' + name]);
    assert.equal(lock.packages[''].dependencies?.[name], declared, 'Consumer root lock pin mismatch');
    const payload = await files(root, '', true);
    packages.push({name, version: declared, directory: root, payload});
  }
  for (const pkg of packages) {
    const local = createRequire(path.join(pkg.directory, 'package.json'));
    for (const name of [scope + 'opf', scope + 'gallery']) {
      assert.equal(local.resolve(name + '/package.json'), path.join(consumer, 'node_modules', name, 'package.json'), 'Another Core/Gallery is resolved');
    }
  }
  for (const name of [scope + 'opf', scope + 'gallery']) assert.deepEqual(Object.keys(lock.packages).filter(key => key.endsWith('node_modules/' + name)), ['node_modules/' + name], 'Nested Core/Gallery in lock');
  const renderer = JSON.parse(await regular(path.join(consumer, 'node_modules', scope + 'opf-render/package.json')));
  const fontPeers = Object.fromEntries(Object.entries(renderer.peerDependencies ?? {}).filter(([name]) => name.startsWith('@expo-google-fonts/')));
  assert.equal(Object.keys(fontPeers).length, 44, 'Controlled renderer must declare all44 font peers');
  const fonts = [];
  for (const [name, value] of Object.entries(fontPeers)) {
    assert.equal(manifest.dependencies?.[name], value, `${name}: exact declared font peer required`);
    assert.equal(lock.packages[''].dependencies?.[name], value, `${name}: root lock font pin mismatch`);
    const root = path.join(consumer, 'node_modules', name), stat = await lstat(root);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink()); assert.equal(await realpath(root), root);
    assert.equal(require.resolve(name + '/package.json'), path.join(root, 'package.json'));
    const pkg = JSON.parse(await regular(path.join(root, 'package.json'))); assert.equal(pkg.name, name); assert.equal(pkg.version, value);
    checkRegistryEntry(name, value, lock.packages['node_modules/' + name]);
    fonts.push({name, version: value, files: await files(root, '', true)});
  }
  return {consumer, manifestSha256: hash(manifestBytes), lockSha256: hash(lockBytes), packages, fonts};
}

/** A deliberately narrow USTAR regular-file parser. No extraction, links, PAX/GNU overrides or duplicate names. */
export function regularTarPayload(archive) {
  const bytes = gunzipSync(archive, {maxOutputLength: 256 * 1024 * 1024}), payload = new Map();
  const string = buffer => {const zero = buffer.indexOf(0); const used = zero < 0 ? buffer : buffer.subarray(0, zero); if (zero >= 0) assert.ok(buffer.subarray(zero).every(value => value === 0), 'Invalid tar string padding'); const value = used.toString('utf8'); assert.deepEqual(Buffer.from(value), used, 'Invalid UTF-8 tar name'); return value;};
  const octal = buffer => {const value = buffer.toString('ascii').replace(/\0.*$/, '').trim(); assert.match(value, /^[0-7]+$/, 'Unsupported tar numeric field'); const number = Number.parseInt(value, 8); assert.ok(Number.isSafeInteger(number)); return number;};
  let offset = 0, ended = false;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(value => value === 0)) {assert.ok(bytes.length >= offset + 1024 && bytes.subarray(offset).every(value => value === 0), 'Tar end blocks required'); ended = true; break;}
    let sum = 0; for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : header[i];
    assert.equal(octal(header.subarray(148, 156)), sum, 'Tar checksum mismatch');
    assert.equal(header.subarray(257, 263).toString('ascii'), 'ustar\0', 'Only USTAR archives supported');
    assert.ok(header[156] === 0 || header[156] === 48, 'Only regular tar members supported; links/special/extended records refused');
    assert.equal(string(header.subarray(157, 257)), '', 'Tar link target refused');
    const prefix = string(header.subarray(345, 500)), base = string(header.subarray(0, 100));
    const member = prefix ? prefix + '/' + base : base;
    assert.ok(safe(member) && member.startsWith('package/'), 'Unsafe tar member');
    const name = member.slice(8); assert.ok(safe(name), 'Empty/unsafe package member');
    assert.ok(!payload.has(name), 'Duplicate tar member');
    for (const previous of payload.keys()) assert.ok(!previous.startsWith(name + '/') && !name.startsWith(previous + '/'), 'Tar path/file collision');
    const size = octal(header.subarray(124, 136)); assert.ok(offset + 512 + size <= bytes.length, 'Truncated tar member');
    payload.set(name, bytes.subarray(offset + 512, offset + 512 + size)); offset += 512 + Math.ceil(size / 512) * 512;
  }
  assert.ok(ended && payload.size > 0, 'Empty/incomplete tar archive'); return payload;
}
export function compareRegistryPayload(pkg, archive, entry, registryManifest) {
  assert.equal(registryManifest.name, pkg.name); assert.equal(registryManifest.version, pkg.version);
  assert.equal(registryManifest.dist?.tarball, registryTarballUrl(pkg.name, pkg.version));
  assert.equal(registryManifest.dist?.integrity, entry.integrity); assert.equal(integrity(archive), entry.integrity, 'Registry archive integrity mismatch');
  const payload = regularTarPayload(archive);
  const actual = [...payload].map(([name, bytes]) => ({path: name, bytes: bytes.length, sha256: hash(bytes)})).sort((a, b) => a.path.localeCompare(b.path, 'en'));
  assert.deepEqual(pkg.payload, actual, `${pkg.name}: installed payload differs from registry archive`);
  const manifest = JSON.parse(payload.get('package.json')); assert.equal(manifest.name, pkg.name); assert.equal(manifest.version, pkg.version);
}

export function requireVerifierClosure(actual) {assert.deepEqual(actual, reviewedVerifier.files, 'Verifier closure differs from independently reviewed files');}
export async function checkVerifierSource(source, revision) {
  assert.equal(revision, reviewedVerifier.revision, 'Verifier revision is not the independently reviewed revision');
  assert.ok(!process.env.NODE_OPTIONS && !process.env.NODE_PATH && !process.execArgv.some(arg => /(?:loader|--import|--require|^-r$)/.test(arg)), 'Injected Node loaders/paths refused');
  const root = path.resolve(source); assert.equal(await realpath(root), root, 'Verifier checkout cannot be aliased');
  const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
  assert.equal(git(['rev-parse', 'HEAD']), reviewedVerifier.revision); assert.equal(git(['status', '--porcelain']), '', 'Verifier checkout must be clean');
  const closure = {};
  for (const [file, expected] of Object.entries(reviewedVerifier.files)) {
    const bytes = await regular(path.join(root, file)); closure[file] = hash(bytes); assert.equal(closure[file], expected, `Changed verifier closure: ${file}`);
    const tracked = execFileSync('git', ['show', `${revision}:${file}`], {cwd: root}); assert.deepEqual(bytes, tracked);
  }
  requireVerifierClosure(closure); return root;
}

export function requireVerification(result) {
  const required = ['npm version', 'tag', 'gitHead', 'tag on main', 'version at tag', 'dist.attestations', 'SLSA provenance', 'npm audit signatures', 'GitHub release'];
  assert.ok(result?.ok && required.every(name => result.checks?.filter(check => check.name === name && check.ok === true).length === 1), 'Maintained registry verification failed/incomplete');
  assert.ok(result.checks.every(check => check.ok === true), 'Failed maintained check');
}

/** Production entrypoint has no supplied-result, transport or executable-module override. */
export async function sealRegistryRuntime({consumer, 'verifier-source': source, 'verifier-revision': revision, publisher, output}) {
  assert.equal(process.versions.node.split('.')[0], '24', 'Qualification requires Node24');
  assert.match(publisher ?? '', /^[0-9a-f]{40}$/, 'Expected PPTX publisher commit required');
  const verifierRoot = await checkVerifierSource(source, revision), initial = await inventoryRegistryConsumer(consumer);
  const target = path.resolve(output); assert.equal(await realpath(path.dirname(target)), path.dirname(target));
  for (const root of [initial.consumer, verifierRoot, fileURLToPath(new URL('../../', import.meta.url))]) assert.ok(!inside(root, target), 'Receipt must be outside source/consumer/verifier');
  await mkdir(target); await mkdir(path.join(target, 'evidence')); await mkdir(path.join(target, 'archives')); await mkdir(path.join(target, 'scratch'));
  const evidenceFiles = [], record = async (name, bytes) => {assert.ok(safe(name)); await writeFile(path.join(target, name), bytes, {flag: 'wx'}); evidenceFiles.push({path: name, bytes: bytes.length, sha256: hash(bytes)});};
  const {verify, packageOf, npmRegistry, defaultDeps} = await import(pathToFileURL(path.join(verifierRoot, 'scripts/release-train.mjs')).href);
  let ghReads = 0, registryReads = 0, calls = 0, installs = 0, audits = 0; const commands = [];
  const captureFetch = origin => async (url, options = {}) => {
    const address = new URL(url); assert.equal(address.origin, origin); assert.ok(!address.username && !address.password && !address.hash);
    assert.equal(options.method ?? 'GET', 'GET', 'Read-only verifier transport');
    assert.ok(++registryReads <= 16, 'Direct registry read budget exhausted');
    const response = await fetch(address, {...options, redirect: 'error', signal: AbortSignal.timeout(60000)}), bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length <= 128 * 1024 * 1024, 'Oversized registry response');
    const name = `evidence/http-${String(++calls).padStart(2, '0')}`;
    await record(name + '.body', bytes); await record(name + '.json', json({url: address.href, status: response.status, bytes: bytes.length, sha256: hash(bytes)}));
    return new Response(bytes, {status: response.status, headers: {'content-type': response.headers.get('content-type') ?? 'application/octet-stream'}});
  };
  const registryFetch = captureFetch('https://registry.npmjs.org');
  const redact = value => {let text = value ?? ''; for (const [key, secret] of Object.entries(process.env)) if (/(?:TOKEN|SECRET|PASSWORD|AUTH)/i.test(key) && secret && secret.length >= 6) text = text.split(secret).join('[redacted]'); return text;};
  const exec = (command, args, options = {}) => {
    assert.equal(command, 'npm'); assert.ok(options.cwd && inside(path.join(target, 'scratch'), path.resolve(options.cwd)), 'Audit must use its own scratch');
    if (args[0] === 'install') {assert.ok(++installs <= 4); assert.deepEqual(args, ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--omit=peer', '--registry', 'https://registry.npmjs.org']);}
    else {assert.ok(++audits <= 4); assert.deepEqual(args, ['audit', 'signatures', '--json', '--include-attestations', '--registry', 'https://registry.npmjs.org']);}
    const result = spawnSync(command, args, {...options, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024, shell: process.platform === 'win32'});
    commands.push({command, args, cwd: path.relative(target, options.cwd), status: result.status, signal: result.signal, stdout: redact(result.stdout), stderr: redact(result.stderr), error: result.error?.message}); return {status: result.status ?? 127, stdout: result.stdout ?? '', stderr: result.stderr ?? result.error?.message ?? ''};
  };
  const npm = npmRegistry({registry: 'https://registry.npmjs.org', fetchImpl: registryFetch, exec}), manifests = new Map();
  const realManifest = npm.manifest; npm.manifest = async (name, value) => {const manifest = await realManifest(name, value); manifests.set(name, manifest); return manifest;};
  assert.ok(!process.env.GITHUB_API_URL || process.env.GITHUB_API_URL === 'https://api.github.com', 'Only the official GitHub API is supported');
  // Preserve the verifier's normal GH_TOKEN/GITHUB_TOKEN/gh-auth fallback; never record credentials or headers.
  const deps = defaultDeps({npm, exec, scratch: path.join(target, 'scratch')}), realApi = deps.api;
  deps.api = async (route, options = {}) => {
    assert.equal(options.method ?? 'GET', 'GET'); assert.ok(/^\/repos\/OpenPresentation\/(?:opf|opf-render|opf-pptx|gallery)\//.test(route));
    assert.ok(++ghReads <= 20, 'GitHub read budget exhausted');
    const file = `evidence/github-${String(ghReads).padStart(2, '0')}.json`;
    try {const value = await realApi(route, options); await record(file, json({representation: 'Parsed JSON returned by unchanged authenticated maintained API, not raw response bytes', route, value})); return value;}
    catch (error) {await record(file, json({route, error: {status: error.status, message: redact(error.message)}})); throw error;}
  };
  const verified = [];
  try {
    for (const pkg of initial.packages) {
      const descriptor = packageOf(pkg.name, {independent: true}), result = await verify(deps, descriptor, pkg.version, {auditSignatures: true, waitMinutes: 0});
      requireVerification(result); const manifest = manifests.get(pkg.name); assert.match(manifest.gitHead ?? '', /^[0-9a-f]{40}$/);
      if (pkg.name === scope + 'opf-pptx') assert.equal(manifest.gitHead, publisher, 'Unexpected PPTX publisher');
      const entry = JSON.parse(await regular(path.join(initial.consumer, 'package-lock.json'))).packages['node_modules/' + pkg.name];
      assert.equal(manifest.dist?.tarball, entry.resolved);
      const response = await registryFetch(entry.resolved); assert.ok(response.ok, 'Registry archive unavailable'); const archive = Buffer.from(await response.arrayBuffer());
      compareRegistryPayload(pkg, archive, entry, manifest);
      const archiveFile = `archives/${pkg.name.slice(scope.length)}.tgz`; await record(archiveFile, archive);
      verified.push({name: pkg.name, version: pkg.version, publisher: manifest.gitHead, registryManifest: manifest, checks: result.checks, archive: archiveFile, sha256: hash(archive), integrity: integrity(archive)});
    }
    assert.equal(installs, 4); assert.equal(audits, 4);
    assert.deepEqual(await inventoryRegistryConsumer(consumer), initial, 'Registry consumer changed during verification');
    await checkVerifierSource(source, revision);
    await record('evidence/commands.json', json(commands));
    // Scratch installs are retained outside the accepted evidence seal; only their package/lock/command evidence is accepted.
    for (const entry of await readdir(path.join(target, 'scratch'))) for (const file of ['package.json', 'package-lock.json']) await record(`evidence/${entry}-${file}`, await regular(path.join(target, 'scratch', entry, file)));
    const receipt = {schemaVersion: 1, kind: 'registry-pptx-runtime', observedAt: new Date().toISOString(), registryArtifactVerified: true, nativeAcceptance: false, scope: 'Four named registry artifacts; no native or global supply-chain acceptance.', verifier: reviewedVerifier, publisher, inventory: initial, verified, budget: {githubReads: ghReads, githubMax: 20, directRegistryReads: registryReads, directRegistryMax: 16, scratchInstalls: installs, signatureAudits: audits, npmInternalRequests: 'not counted as direct HTTP reads'}, evidence: evidenceFiles.sort((a, b) => a.path.localeCompare(b.path, 'en'))};
    const bytes = json(receipt); await writeFile(path.join(target, 'receipt.json'), bytes, {flag: 'wx'}); return {receipt, sha256: hash(bytes)};
  } catch (error) {await writeFile(path.join(target, 'failure.json'), json({message: error.message, commands, githubReads: ghReads, directRegistryReads: registryReads}), {flag: 'wx'}); throw error;}
}

/** Offline equality to an independently accepted receipt digest; not fresh registry authentication. */
export async function verifyRegistryRuntime({registry, 'registry-sha256': expected, consumer}) {
  assert.match(expected ?? '', /^[0-9a-f]{64}$/, 'Independently accepted registry receipt SHA-256 required');
  const root = path.resolve(registry); assert.equal(await realpath(root), root);
  const bytes = await regular(path.join(root, 'receipt.json')); assert.equal(hash(bytes), expected, 'Registry receipt differs from accepted digest');
  const receipt = JSON.parse(bytes); assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, 'registry-pptx-runtime');
  assert.equal(receipt.registryArtifactVerified, true); assert.equal(receipt.nativeAcceptance, false); assert.deepEqual(receipt.verifier, reviewedVerifier);
  assert.match(receipt.publisher ?? '', /^[0-9a-f]{40}$/); assert.equal(receipt.verified?.length, 4);
  assert.ok(receipt.evidence?.length > 0 && new Set(receipt.evidence.map(file => file.path)).size === receipt.evidence.length);
  for (const file of receipt.evidence) {
    assert.ok(safe(file.path) && /^(?:archives|evidence)\//.test(file.path)); const data = await regular(path.join(root, file.path)); assert.equal(data.length, file.bytes); assert.equal(hash(data), file.sha256, 'Registry evidence changed');
  }
  assert.deepEqual((await files(path.join(root, 'archives'))).map(file => ({...file, path: 'archives/' + file.path})).concat((await files(path.join(root, 'evidence'))).map(file => ({...file, path: 'evidence/' + file.path}))).sort((a, b) => a.path.localeCompare(b.path, 'en')), receipt.evidence, 'Missing/extra registry evidence');
  const current = await inventoryRegistryConsumer(consumer); assert.deepEqual(current, receipt.inventory, 'Registry runtime or consumer changed');
  assert.deepEqual(receipt.verified.map(pkg => pkg.name), names);
  for (const pkg of current.packages) {
    const proof = receipt.verified.find(item => item.name === pkg.name); requireVerification({ok: true, checks: proof.checks});
    assert.equal(proof.archive, `archives/${pkg.name.slice(scope.length)}.tgz`);
    assert.equal(proof.version, pkg.version); assert.equal(proof.publisher, proof.registryManifest.gitHead); assert.match(proof.publisher, /^[0-9a-f]{40}$/);
    const archive = await regular(path.join(root, proof.archive)); assert.equal(hash(archive), proof.sha256); assert.equal(integrity(archive), proof.integrity);
    const entry = JSON.parse(await regular(path.join(current.consumer, 'package-lock.json'))).packages['node_modules/' + pkg.name]; compareRegistryPayload(pkg, archive, entry, proof.registryManifest);
    if (pkg.name === scope + 'opf-pptx') assert.equal(proof.publisher, receipt.publisher);
  }
  return {receiptSha256: expected, receipt, claim: 'Unchanged bytes relative to independently accepted registry verification evidence; no fresh authentication or native acceptance.'};
}
