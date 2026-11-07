const adapted = (result) => result.diagnostics.filter(entry => entry.code === 'arrangement-adapted').map(entry => entry.message);

test('a matrix of four entries draws its quadrants; another count draws a grid of cards and says so', () => {
  const result = compose({ layout: 'matrix', title: 'Four markets', items: ['Enterprise', 'Mid-market', 'Consumer', 'Public sector'] });
  const [arrangement] = result.arrangements;
  assert.deepEqual([arrangement.kind, arrangement.design, arrangement.align, arrangement.paint], ['matrix', 'smartart', 'center', 'primary']);
  assert.equal(arrangement.nodes.length, 4);
  assert.ok(arrangement.nodes.every(node => node.path), 'no empty quadrant');
  assert.deepEqual(arrangement.background, matrixSquare(arrangement.frame));
  near(arrangement.textMargin, .3 * arrangement.fontSize, 'margin');
  assert.deepEqual(adapted(result), []);
  for (const items of [['North', 'South'], ['North', 'South', 'East'], ['North', 'South', 'East', 'West', 'Central', 'Online']]) {
    const other = compose({ layout: 'matrix', title: 'T', items });
    const [cards] = other.arrangements;
    assert.deepEqual([cards.design, cards.paint, cards.align, cards.text, cards.nodes.length], ['cards', 'card', 'start', 'slide', items.length], items.join());
    assert.equal(cards.background, undefined);
    assert.ok(cards.fontSize >= LIST_NOMINAL_SIZE - 1e-6);
    assert.match(adapted(other)[0], new RegExp(`its ${items.length} entries are drawn as a grid of cards`));
  }
});

test('OPF\'s own design where PowerPoint\'s does not hold the entries: a stepped pyramid with the entries beside it, quadrants that fill', () => {
  const pyramid = compose({ layout: 'pyramid', title: 'Eight levels', items: ['Purpose', 'Vision', 'Strategy', 'Goals', 'Programs', 'Projects', 'Teams', 'Daily work'] });
  const [steps] = pyramid.arrangements;
  assert.deepEqual([steps.design, steps.align, steps.text, steps.nodes.length], ['opf', 'start', 'slide', 8]);
  assert.ok(steps.fontSize >= LIST_NOMINAL_SIZE - 1e-6, 'never below the floor');
  for (const [index, node] of steps.nodes.entries()) {
    assert.equal(node.beside, true);
    assert.ok(node.textBox.x >= node.box.x + node.box.width, 'the text beside its level');
    if (index) assert.ok(node.box.width > steps.nodes[index - 1].box.width, 'each level wider than the one above');
  }
  const long = ['Why we exist and who we serve', 'The few goals that matter this year', 'How teams plan, decide and ship', 'Feedback loops measured in days'];
  const matrix = compose({ layout: 'matrix', title: 'Four long', items: long });
  const [quadrants] = matrix.arrangements;
  assert.equal(quadrants.design, 'opf');
  assert.equal(quadrants.background, undefined);
  const area = matrix.regions.find(region => region.name === 'quadrants').box;
  near(quadrants.nodes[3].box.x + quadrants.nodes[3].box.width, area.x + area.width, 'the quadrants fill the region', .05);
});

test('nothing an arrangement does not draw, and nothing its designs cannot hold at the floor, is silent: the list stays with a finding', () => {
  for (const items of [['A', { text: 'B', level: 1 }], [{ text: 'A', description: 'more' }, 'B']]) {
    const result = compose({ layout: 'matrix', title: 'T', items });
    assert.equal(result.arrangements, undefined, JSON.stringify(items));
    assert.match(adapted(result)[0], /is drawn as a list/);
  }
  assert.match(adapted(compose({ layout: 'pyramid', title: 'T', items: ['A', 'B'], numbering: 'arabic' }))[0], /a numbered list/);
  const word = 'Supercalifragilisticexpialidocious';
  const tooLong = compose({ layout: 'matrix', title: 'Too long', items: [word, word, word, word] });
  assert.equal(tooLong.arrangements, undefined);
  assert.match(adapted(tooLong)[0], /do not fit its quadrants at the list's size/);
  assert.equal(composeSlide({ layout: 'list', title: 'T', items: ['A', 'B'] }, { layout: gallery.layouts.list }).arrangements, undefined, 'no arrangement region');
});

