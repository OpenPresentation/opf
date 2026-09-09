const output = document.querySelector('pre');
try {
  const fixture = await (await fetch('./fixtures.json')).json();
  await Promise.all(fixture.fonts.map(async item => {
    const face = await new FontFace(item.family, `url(${item.url})`, {weight:String(item.weight),style:item.italic?'italic':'normal'}).load();
    document.fonts.add(face);
  }));
  let checks = 0;
  for (const item of fixture.cases) {
    document.querySelector('main').innerHTML = await (await fetch(item.url)).text();
    await document.fonts.ready;
    const body = document.querySelector('g[data-opf-path="slides.0.quote.text"]');
    const footer = [...document.querySelectorAll('g[data-opf-path="slides.0.quote"]')].find(node=>[...node.children].some(child=>child.tagName==='text'));
    if (!body || !footer) throw new Error('Missing quote body or attribution');
    const bodyBounds = body.getBBox(), footerBounds = footer.getBBox();
    if (bodyBounds.y + bodyBounds.height > footerBounds.y) throw new Error('Loaded-font quote glyphs overlap attribution: '+item.id);
    if (!footer.textContent.includes('Recorded interview')) throw new Error('Quote source is missing');
    checks += 2;
  }
  output.textContent = JSON.stringify({passed:true,cases:fixture.cases.length,checks,fonts:fixture.fonts.length,scope:'Actual browser SVG glyph bounds using the same bundled open font bytes as text measurement'},null,2);
  document.title = 'PASS: quote footer';
} catch (error) {
  output.textContent = error.stack;
  document.title = 'FAIL: quote footer';
  console.error(error);
}
