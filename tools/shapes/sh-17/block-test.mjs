
test('list blocks are the entries: each on a card of the design, arrows between, one size, the bullets kept; a card grid where they do not fit', () => {
  const blocks = [{ items: ['Interview users', 'Map the journey'] }, { items: ['Prototype', 'Test with five teams'] }, { items: ['Decide', 'Plan the rollout'] }];
  for (const kind of ['chevrons', 'flow', 'vertical-flow']) {
    const result = compose({ layout: kind, title: 'Three workstreams', blocks });
    const [arrangement] = result.arrangements, lists = result.items.filter(item => item.field === 'items');
    assert.deepEqual([arrangement.kind, arrangement.design, arrangement.paint, arrangement.align], [kind, 'opf', 'card', 'start'], kind);
    assert.equal(arrangement.nodes.length, 3);
    assert.equal(arrangement.arrows?.length ?? 0, kind === 'chevrons' ? 0 : 2, `${kind}: arrows between the cards`);
    assert.match(arrangement.instead, /lists, which a SmartArt node does not hold/);
    assert.equal(new Set(lists.map(list => list.text.fontSize)).size, 1, `${kind}: one size`);
    assert.ok(lists[0].text.fontSize >= LIST_NOMINAL_SIZE - 1e-6, `${kind}: never below the role size`);
    assert.ok(lists.every(list => list.text.listEntries.every(entry => !entry.marker.none)), `${kind}: the bullets kept`);
    for (const [index, list] of lists.entries()) {
      const node = arrangement.nodes[index].box;
      assert.ok(list.box.x >= node.x && list.box.x + list.box.width <= node.x + node.width + 1e-6 && list.box.y >= node.y - 1e-6 && list.box.y + list.box.height <= node.y + node.height + 1e-6, `${kind}: list ${index} on its card`);
    }
  }
  // Lists no design holds at their size keep the region's composition (pagination splits them), with the finding.
  const long = Array.from({ length: 3 }, () => ({ items: Array.from({ length: 7 }, (_, index) => `Item ${index + 1}: customers told us onboarding took too long, so we rebuilt it around them`) }));
  const crowded = compose({ layout: 'flow', title: 'Long', blocks: long });
  assert.equal(crowded.arrangements, undefined);
});
