// SmartArt import: "inverted" in a layout id means an inverted pyramid only for a pyramid. PowerPoint's Bullet Timeline Inverted
// (2024/layout/BulletTimelineInverted, category process) was read as a downward pyramid because the id contains "Inverted"; it is a
// process layout and imports as a process list, as docs/smartart.md says of the process family.
import assert from 'node:assert/strict';
import {smartArtForm} from '../src/smart-art-import.js';

const OFFICE = 'urn:microsoft.com/office/officeart/';

assert.deepEqual(smartArtForm(`${OFFICE}2024/layout/BulletTimelineInverted`, 'process'), {layout: 'process'});
// The same id under each category takes that category's form, never the pyramid.
for (const category of ['process', 'list', 'cycle', 'relationship', 'hierarchy', 'matrix', 'picture'])
  assert.notEqual(smartArtForm(`${OFFICE}2024/layout/BulletTimelineInverted`, category).arrangement, 'pyramid', category);

// Inverted pyramids keep their widest-first order: PowerPoint's own id, and an id that names an inverted pyramid either way round.
const down = {arrangement: 'pyramid', pyramidDirection: 'down'};
assert.deepEqual(smartArtForm(`${OFFICE}2005/8/layout/pyramid3`, 'pyramid'), down);
assert.deepEqual(smartArtForm('urn:example/layout/InvertedPyramid', 'pyramid'), down);
assert.deepEqual(smartArtForm('urn:example/layout/PyramidInverted', 'pyramid'), down);
// An upright pyramid is unchanged.
assert.deepEqual(smartArtForm(`${OFFICE}2005/8/layout/pyramid2`, 'pyramid'), {arrangement: 'pyramid'});

console.log('ok: only a pyramid is read as an inverted pyramid');
