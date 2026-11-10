import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
const root = new URL('../../../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const count = (directory, suffix) => fs.readdirSync(new URL(directory, root), { withFileTypes: true }).reduce((n, x) => n + (x.isDirectory() ? count(`${directory}/${x.name}`, suffix) : x.name.endsWith(suffix) ? 1 : 0), 0);

test('current source documentation matches the actual Gallery, example folders and exhaustive sampler', () => {
  const layouts = JSON.parse(read('packages/gallery/catalog/layouts/index.json')).records;
  const gallery = count('examples/gallery', '.opf.json');
  const technical = count('examples/technical', '.opf.json');
  const sampler = JSON.parse(read('examples/technical/layout-sampler.opf.json'));
  const inventory = read('docs/compatibility-matrix.md').split('## Current source inventory\n')[1].split('\n## ')[0];
  assert.ok(inventory.includes(`**${gallery + technical} JSON**`));
  assert.ok(inventory.includes(`${gallery} gallery,\n${technical} technical`));
  assert.ok(inventory.includes(`**${layouts.length} default layouts**`));
  assert.ok(inventory.includes(`**${sampler.slides.length}-slide sampler**`));
  assert.ok(read('llms.txt').includes(`map of the ${gallery + technical} JSON example decks in this source`));
  assert.ok(read('packages/render/README.md').includes(`Gallery templates (${layouts.length} in this source)`));
  assert.ok(read('skills/opf-layout/SKILL.md').includes(`The ${layouts.length} built-ins in this source`));
  for (const name of ['opf-inspect', 'opf-presets']) assert.ok(read(`skills/${name}/SKILL.md`).includes(`v2 intent layouts (${layouts.length} in this source)`));
  assert.equal(count('examples/markdown', '.opf.md'), 2);
  assert.equal(sampler.slides.length, layouts.length + 13);
  const used = new Set(sampler.slides.map(s => s.layout).filter(Boolean));
  for (const { id } of layouts) assert.ok(used.has(id), `sampler covers ${id}`);
});

test('Pele version and source syntax are described without external-renderer or hosted rollout claims', () => {
  const version = JSON.parse(read('packages/javascript/package.json')).dependencies.pele;
  assert.ok(read('docs/diagrams.md').includes(`pele@${version}`));
  assert.ok(read('docs/mcp.md').includes('separately from the npm package'));
  assert.ok(read('docs/mcp.md').includes('When the matching'));
  assert.ok(read('docs/quickstart.md').includes('npm install --save-exact @openpresentation/opf'));
});
