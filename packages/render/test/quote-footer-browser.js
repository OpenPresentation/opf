const output = document.querySelector('pre');
try {
  const fixture = await (await fetch('./fixtures.json')).json();
  await Promise.all(fixture.fonts.map(async item => {
    const face = await new FontFace(item.family, `url(${item.url})`, {weight:String(item.weight),style:item.italic?'italic':'normal'}).load();
    document.fonts.add(face);
  }));
  let checks = 0;
  const lineBoxOverhangs=[];
  for (const item of fixture.cases) {
    document.querySelector('main').innerHTML = await (await fetch(item.url)).text();
    await document.fonts.ready;
    const bounds = document.querySelector('main svg').viewBox.baseVal;
    if (bounds.width !== item.width || bounds.height !== item.height) throw new Error('Unexpected actual SVG dimensions: '+item.id);
    const body = document.querySelector('g[data-opf-path="slides.0.quote.text"]');
    const footer = [...document.querySelectorAll('g[data-opf-path="slides.0.quote"]')].find(node=>[...node.children].some(child=>child.tagName==='text'));
    if (!body || !footer) throw new Error('Missing quote body or attribution');
    const bodyBounds = body.getBBox(), footerBounds = footer.getBBox();
    for (const [bounds,box,label] of [[bodyBounds,item.bodyBox,'body'],[footerBounds,item.footerBox,'footer']]) {
      // Layout parts describe advances/line boxes, not shaped glyph outlines. Record
      // ink overhang into the inset; require actual glyphs to stay inside their cell.
      const overhang={left:Math.max(0,box.x-bounds.x),right:Math.max(0,bounds.x+bounds.width-box.x-box.width),top:Math.max(0,box.y-bounds.y),bottom:Math.max(0,bounds.y+bounds.height-box.y-box.height)};
      if (Object.values(overhang).some(value=>value>.1)) lineBoxOverhangs.push({id:item.id,part:label,...overhang});
      const cell=item.cellBox;
      if (bounds.x<cell.x-.1 || bounds.x+bounds.width>cell.x+cell.width+.1) throw new Error('Loaded-font quote '+label+' crosses its cell horizontally: '+item.id);
      checks++;
      if (bounds.y<cell.y-.1 || bounds.y+bounds.height>cell.y+cell.height+.1) throw new Error('Loaded-font quote '+label+' crosses its cell vertically: '+item.id);
      checks++;
    }
    if (bodyBounds.y + bodyBounds.height > footerBounds.y) throw new Error('Loaded-font quote glyphs overlap attribution: '+item.id);
    const normalize=text=>text.replace(/\s+/g,' ').trim();
    for (const [group,expected,label] of [[body,item.body,'body'],[footer,item.footer,'footer']]) {
      const rendered=[...group.querySelectorAll('text')].map(node=>node.textContent).join(' ');
      if (normalize(rendered)!==normalize(expected)) throw new Error('Quote '+label+' source differs after line wrapping: '+item.id);
    }
    checks += 4;
  }
  output.textContent = JSON.stringify({passed:true,cases:fixture.cases.length,checks,fonts:fixture.fonts.length,lineBoxOverhangs,scope:'Actual browser SVG glyph containment in quote cells and body/footer separation with matching bundled font bytes. Part line boxes are not glyph outlines; overhangs into the inset are reported.'},null,2);
  document.title = 'PASS: quote footer';
} catch (error) {
  output.textContent = error.stack;
  document.title = 'FAIL: quote footer';
  console.error(error);
}
