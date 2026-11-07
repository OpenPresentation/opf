test('OPF\'s own designs: PowerPoint\'s proportions, lines that span the region, rows that snake with a connector', () => {
  const area = { x: 0, y: 0, width: 1200, height: 500 }, span = node => [node.box.x, node.box.x + node.box.width];
  const row = linearDesign('chevrons', area, 4, 24);
  near(span(row.nodes[0])[0], 0, 'start'); near(span(row.nodes[3])[1], 1200, 'end');
  const mirrored = linearDesign('chevrons', area, 4, 24, true);
  assert.equal(mirrored.nodes[0].flip, true);
  near(span(mirrored.nodes[0])[1], 1200, 'the first chevron at the right in a right-to-left deck');
  // A flow's arrows are PowerPoint's: 0.212 x 0.248 of a box's width, in a room of 0.4 of it.
  const flow = linearDesign('flow', area, 3, 24), w = flow.nodes[0].box.width;
  near(flow.nodes[1].box.x - (flow.nodes[0].box.x + w), .4 * w, 'room');
  near(flow.arrows[0].box.width, .212 * w, 'arrow length'); near(flow.arrows[0].box.height, .248 * w, 'arrow thickness');
  near(span(flow.nodes[2])[1], 1200, 'the boxes fill the width');
  // Each node takes the height its text needs, PowerPoint's proportion at least, centered.
  const short = linearDesign('flow', area, 3, 24, false, 1, 40);
  near(short.nodes[0].box.height, .6 * w, 'at least 0.6 of a width tall');
  near(short.nodes[0].box.y + short.nodes[0].box.height / 2, 250, 'centered');
  // Five boxes in two rows: 3 and 2, the second row widened to span the region, running back, joined by a down arrow at the right.
  const two = linearDesign('flow', area, 5, 24, false, 2);
  near(span(two.nodes[3])[1], 1200, 'the second row starts at the right'); near(span(two.nodes[4])[0], 0, 'and spans the region');
  assert.ok(two.nodes[3].box.width > two.nodes[0].box.width, 'a row of fewer boxes widens them');
  assert.deepEqual(two.arrows.map(arrow => [arrow.index, arrow.rotation]), [[0, 0], [1, 0], [2, 90], [3, 180]]);
  assert.ok(two.arrows[2].box.x > two.nodes[2].box.x, 'the connector under the end of the first row');
  // Chevrons wrap with each row full width, starting again at the left (a row breaks after a point).
  const chevrons = linearDesign('chevrons', area, 5, 24, false, 2);
  near(span(chevrons.nodes[3])[0], 0, 'the second row starts at the left'); near(span(chevrons.nodes[4])[1], 1200, 'and spans the region');
  // A vertical flow's columns snake too: the second runs bottom to top, joined by a right arrow at the bottom.
  const column = linearDesign('vertical-flow', { x: 0, y: 0, width: 600, height: 600 }, 5, 24, false, 2);
  assert.deepEqual(column.arrows.map(arrow => arrow.rotation), [90, 90, 0, 270]);
  assert.ok(column.nodes[3].box.y > column.nodes[4].box.y, 'the second column runs up');
  near(column.nodes[3].box.y + column.nodes[3].box.height, column.nodes[2].box.y + column.nodes[2].box.height, 'both columns end at the same bottom');
});

