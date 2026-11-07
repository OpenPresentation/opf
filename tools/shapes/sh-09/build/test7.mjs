// 7. Outside the domain (a frame narrower than the comparison covered): OPF's own quadrants, native shapes, and an info
// smartart-unavailable with the reason; a matrix of other than four entries is a grid of cards (core's arrangement-adapted), never live.
{
  const tall = await exported({design: {dimensions: '9:16'}, slides: [{layout: 'matrix', title: 'Four', items: ['North', 'South', 'East', 'West']}]});
  const unavailable = tall.diagnostics.filter(item => item.code === 'smartart-unavailable');
  assert.equal(unavailable.length, 1);
  assert.equal(unavailable[0].path, 'slides.0.items');
  assert.match(unavailable[0].reason, /proportions[\s\S]*so OPF's own matrix is drawn/);
  assert.equal(Object.keys(tall.entries).some(path => path.startsWith('ppt/diagrams/')), false);
  const slide = tall.text('ppt/slides/slide1.xml');
  assert.equal((slide.match(/name="OPF arrangement slides\.0\.items node \d"/g) ?? []).length, 4);
  assert.doesNotMatch(slide, /name="OPF arrangement slides\.0\.items background"/, 'no diamond in OPF\'s quadrants');

  const three = await exported({slides: [{layout: 'matrix', title: 'Three', items: ['North', 'South', 'East']}]});
  assert.equal(three.diagnostics.filter(item => item.code === 'smartart-unavailable').length, 0);
  assert.equal(three.diagnostics.filter(item => item.code === 'arrangement-adapted').length, 1, 'core reports the card grid');
  assert.equal(Object.keys(three.entries).some(path => path.startsWith('ppt/diagrams/')), false);
  const cards = three.text('ppt/slides/slide1.xml');
  assert.equal((cards.match(/name="OPF arrangement slides\.0\.items node \d"/g) ?? []).length, 3, 'one card per entry, no empty one');
  const back = await fromPptx(three.bytes);
  assert.deepEqual([back.slides[0].layout, back.slides[0].items], ['matrix', ['North', 'South', 'East']]);
}

