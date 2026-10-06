// Explicit maintenance command; ordinary builds never fetch upstream code.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
// RR-17 (opf-pptx#162): pptxgenjs-plus, the maintained PptxGenJS fork (MIT, same public API and default export).
const name = 'pptxgenjs-plus';
const version = '4.3.4';
const integrity = 'sha512-E4mu3Guf2O5CIzy6nS7tlAv55RyhPWinpsj2MdOM5QZ3XukkSne4oipE1HONTfaVLeJG4rkr2lOk6KhwbU/4mQ==';
const metadataUrl = `https://registry.npmjs.org/${name}/${version}`;
const response = await fetch(metadataUrl);
assert.ok(response.ok, `Registry metadata: ${response.status}`);
const metadata = await response.json();
assert.equal(metadata.version, version);
assert.equal(metadata.license, 'MIT');
assert.equal(metadata.dist.integrity, integrity, 'Pinned upstream archive must not change silently');
assert.equal(new URL(metadata.dist.tarball).origin, 'https://registry.npmjs.org');
// npm SLSA provenance: the source commit the registry archive was built from (recorded, not trusted for integrity).
const attestations = await (await fetch(metadata.dist.attestations.url)).json();
const slsa = attestations.attestations.find(entry => entry.predicateType === 'https://slsa.dev/provenance/v1');
const statement = JSON.parse(Buffer.from(slsa.bundle.dsseEnvelope.payload, 'base64').toString('utf8'));
assert.ok(statement.subject.some(subject => subject.name === `pkg:npm/${name}@${version}` && `sha512-${Buffer.from(subject.digest.sha512, 'hex').toString('base64')}` === integrity), 'Provenance subject must be the pinned archive');
const source = statement.predicate.buildDefinition.resolvedDependencies[0];
const provenance = {repository: source.uri.replace(/^git\+/, '').replace(/@refs\/.*$/, ''), ref: source.uri.replace(/^.*@/, ''), commit: source.digest.gitCommit};
const archiveResponse = await fetch(metadata.dist.tarball);
assert.ok(archiveResponse.ok, `Registry archive: ${archiveResponse.status}`);
const archive = Buffer.from(await archiveResponse.arrayBuffer());
assert.equal(`sha512-${createHash('sha512').update(archive).digest('base64')}`, metadata.dist.integrity);
const temporary = await mkdtemp(path.join(tmpdir(), 'opf-pptxgenjs-'));
const target = new URL('../vendor/pptxgenjs/', import.meta.url);
try {
  const tarball = path.join(temporary, 'upstream.tgz');
  await writeFile(tarball, archive);
  await mkdir(target, { recursive: true });
  const files = {};
  for (const [source, destination] of [['package/dist/pptxgen.es.js', 'pptxgen.es.js'], ['package/LICENSE', 'LICENSE']]) {
    // Read two named entries to stdout; never extract arbitrary archive paths.
    const bytes = execFileSync('tar', ['-xOf', tarball, source], { maxBuffer: 4 * 1024 * 1024 });
    await writeFile(new URL(destination, target), bytes);
    files[destination] = { source, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  await writeFile(new URL('UPSTREAM.json', target), `${JSON.stringify({ name, version, license: metadata.license, tarball: metadata.dist.tarball, integrity: metadata.dist.integrity, provenance, files }, null, 2)}\n`);
  console.log(`Vendored exact ${name} ${version} distribution and license; integrity verified.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
