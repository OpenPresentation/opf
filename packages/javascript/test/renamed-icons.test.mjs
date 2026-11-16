import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { galleryIconSets } from '@openpresentation/gallery/icon-sets';
import { ensureIcons, resolveIcon } from '../dist/composition.js';
import { validate } from '../dist/index.js';

// Lucide renamed `triangle-alert` (and before it `alert-triangle`) to `triangle-exclamation-point`. The gallery's set records its former names
// (`renamed`, from the aliases lucide-static ships) in the index file the lazy loader reads, so the finding for an old name names the new one
// without loading any icon body or the tags. An old name is never an icon: OPF has one name for each.
const catalogs = [gallery, galleryIconSets()];
const deck = (icon) => ({ name: 'T', language: 'en-US', slides: [{ title: 'x', items: [{ text: 'a', icon }] }] });

for (const old of ['lucide:triangle-alert', 'lucide:alert-triangle']) {
  test(`${old} is reported as renamed, with the new name first and a replace fix, and does not resolve`, async () => {
    const document = deck(old);
    await ensureIcons(document, { catalogs });
    const resolution = resolveIcon(document, old, { catalogs });
    assert.equal(resolution.ok, false);
    assert.equal(resolution.code, 'icon-unknown');
    assert.deepEqual(resolution.suggestions, ['lucide:triangle-exclamation-point']);
    const found = validate(document, { catalogs }).findings.find((finding) => finding.ruleId === 'opf/icon-unknown');
    assert.match(found.message, /was renamed lucide:triangle-exclamation-point; the old name does not draw/);
    assert.equal(found.suggestions[0].value, 'lucide:triangle-exclamation-point');
    assert.deepEqual(found.fixes[0].patch, [{ op: 'replace', path: '/slides/0/items/0/icon', value: 'lucide:triangle-exclamation-point' }]);
    assert.match(found.help, /^Did you mean 'lucide:triangle-exclamation-point'/);
  });
}

test('the current name resolves, and a name that was never an icon gets the ordinary suggestions', async () => {
  const document = deck('lucide:triangle-exclamation-point');
  await ensureIcons(document, { catalogs });
  assert.equal(resolveIcon(document, 'lucide:triangle-exclamation-point', { catalogs }).ok, true);
  const nothing = resolveIcon(document, 'lucide:warnin', { catalogs });
  assert.equal(nothing.ok, false);
  assert.equal(nothing.renamed, undefined);
});

// Lucide 1.72 removed the diagonal `circle-arrow-out-*` and `square-arrow-out-*` ids (now `*-exit`); a deck written before carries them.
test('a diagonal arrow removed in Lucide 1.72 is reported as renamed to its -exit icon', async () => {
  const document = deck('lucide:circle-arrow-out-up-right');
  await ensureIcons(document, { catalogs });
  const resolution = resolveIcon(document, 'lucide:circle-arrow-out-up-right', { catalogs });
  assert.equal(resolution.ok, false);
  assert.deepEqual(resolution.suggestions, ['lucide:circle-arrow-up-right-exit']);
  assert.equal(validate(document, { catalogs }).findings.find((finding) => finding.ruleId === 'opf/icon-unknown').fixes[0].patch[0].value, 'lucide:circle-arrow-up-right-exit');
});
