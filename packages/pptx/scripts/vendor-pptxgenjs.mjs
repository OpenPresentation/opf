// Explicit maintenance command; ordinary builds never fetch upstream code.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const version = '4.0.1';
const integrity = 'sha512-TeJISr8wouAuXw4C1F/mC33xbZs/FuEG6nH9FG1Zj+nuPcGMP5YRHl6X+j3HSUnS1f3at6k75ZZXPMZlA5Lj9A==';
const metadataUrl = `https://registry.npmjs.org/pptxgenjs/${version}`;
const response = await fetch(metadataUrl);
assert.ok(response.ok, `Registry metadata: ${response.status}`);
const metadata = await response.json();
assert.equal(metadata.version, version);
assert.equal(metadata.license, 'MIT');
assert.equal(metadata.dist.integrity, integrity, 'Pinned upstream archive must not change silently');
assert.equal(new URL(metadata.dist.tarball).origin, 'https://registry.npmjs.org');
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
    const bytes = execFileSync('tar', ['-xOf', tarball, source], { maxBuffer: 2 * 1024 * 1024 });
    await writeFile(new URL(destination, target), bytes);
    files[destination] = { source, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }
  await writeFile(new URL('UPSTREAM.json', target), `${JSON.stringify({ name: 'pptxgenjs', version, license: metadata.license, tarball: metadata.dist.tarball, integrity: metadata.dist.integrity, files }, null, 2)}\n`);
  console.log(`Vendored exact PptxGenJS ${version} distribution and license; integrity verified.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
