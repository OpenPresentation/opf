// Internal, read-only tracker evidence; never a runtime catalog or ownership source.
import {readFileSync, readdirSync, mkdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {createRequire} from 'node:module';
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const installed = JSON.parse(readFileSync(require.resolve('@openpresentation/gallery/package.json'), 'utf8'));
if (installed.version !== '2.0.0') throw new Error('Tracker snapshot requires verified gallery 2.0.0');
const receipt = JSON.parse(readFileSync(path.join(root, 'docs/evidence/rr20-gallery2-published/registry-verification.json'), 'utf8'));
if (!receipt.ok || receipt.checks.some(c => !c.ok)) throw new Error('Published verification failed');
const comparisonPath = 'docs/evidence/rr20-gallery2-published/package-content-comparison.json';
const comparisonBytes = readFileSync(path.join(root, comparisonPath));
const comparison = JSON.parse(comparisonBytes);
const expectedFiles = ['LICENSE','dist/index.js','dist/previews.js','package.json','README.md','dist/index.d.ts','dist/previews.d.ts','CHANGELOG.md'];
if (comparison.registry !== '@openpresentation/gallery@2.0.0' || comparison.source !== '48169a9bb38559b8385e6791e7b5e76c0f5a8792' || comparison.integrity !== 'sha512-RiCR0SUHQ8cDPefXZiK1WsSxVMyCwTeWZ5e8lXMnKm1x2sJ9fqnIauOjEShMSZCcoYiCK/PhU+Lkd1D3llZTYw==' || JSON.stringify(comparison.files.map(f=>f.path).sort()) !== JSON.stringify(expectedFiles.sort())) throw new Error('Published package identity or complete file set mismatch');
const packageRoot = path.dirname(require.resolve('@openpresentation/gallery/package.json'));
for (const file of comparison.files) {
  const bytes = readFileSync(path.join(packageRoot, file.path));
  if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Published package bytes differ: ${file.path}`);
}
const files = {};
function collect(dir, relative = '') {
  for (const entry of readdirSync(dir, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const file = path.join(dir, entry.name), key = relative + entry.name;
    if (entry.isDirectory()) collect(file, `${key}/`);
    else if (entry.isFile() && entry.name.endsWith('.json')) files[key] = JSON.parse(readFileSync(file, 'utf8'));
    else throw new Error(`Unexpected catalog input ${key}`);
  }
}
collect(path.join(root, 'packages/gallery/catalog'));
const dir = path.join(root, 'docs/programs/release-readiness/tracker-catalog');
mkdirSync(dir, {recursive:true});
const bytes = JSON.stringify({schema:1, files}, null, 2)+'\n';
writeFileSync(path.join(dir, 'snapshot.json'), bytes);
writeFileSync(path.join(dir, 'proof.json'), JSON.stringify({schema:1, package:'@openpresentation/gallery', version:installed.version, gitHead:'48169a9bb38559b8385e6791e7b5e76c0f5a8792', integrity:'sha512-RiCR0SUHQ8cDPefXZiK1WsSxVMyCwTeWZ5e8lXMnKm1x2sJ9fqnIauOjEShMSZCcoYiCK/PhU+Lkd1D3llZTYw==', publishedContent:comparisonPath, publishedContentSha256:createHash('sha256').update(comparisonBytes).digest('hex'), verification:'docs/evidence/rr20-gallery2-published/registry-verification.json', verificationSha256:createHash('sha256').update(readFileSync(path.join(root,'docs/evidence/rr20-gallery2-published/registry-verification.json'))).digest('hex'), snapshotSha256:createHash('sha256').update(bytes).digest('hex'), files:Object.keys(files).length}, null,2)+'\n');
