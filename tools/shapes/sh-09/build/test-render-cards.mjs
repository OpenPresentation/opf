{
  // A matrix of three entries: a grid of cards in the card neutral, no diamond, no empty quadrant.
  const svg = toSvg(deck, 3, {catalogs, trace: true});
  assert.match(svg, /data-opf-arrangement="matrix" data-opf-arrangement-design="cards"/);
  const card = resolved.slides[2].design.roles.neutrals.card.hex.toLowerCase();
  const cards = [...svg.matchAll(/<rect [^>]*data-opf-arrangement-path[^>]*>/g)].map(match => match[0]);
  assert.equal(cards.length, 3);
  for (const rect of cards) assert.ok(rect.toLowerCase().includes(`fill="${card}"`), rect);
}
