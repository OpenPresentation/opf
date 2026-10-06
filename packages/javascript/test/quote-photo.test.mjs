import assert from 'node:assert/strict';
import {test} from 'node:test';
import {composeSlide,layoutQuote,OPFCompositionError} from '../dist/composition.js';
import {auditPresentation} from '../dist/audit.js';
import {validatePresentation} from '../dist/index.js';
import {markdownToOpf,opfToMarkdown} from '../dist/markdown.js';
import {paginateSlide} from '../dist/pagination.js';

// FA-12: Quote.role and Quote.photo. The footer gains a role line; a photo is a circle beside it.
const cell = {x:40,y:60,width:800,height:400};
const quote = {text:'We would rather spend a week on capacity than a month on an outage.',attribution:'Priya Raman',role:'Head of Platform, Acme',source:'Interview, March 2026'};

test('schema accepts role and photo and rejects other keys', () => {
  const ok = validatePresentation({slides:[{quote:{...quote,photo:{src:'./priya.jpg',alt:'Priya Raman'}}}]});
  assert.equal(ok.valid,true,JSON.stringify(ok.errors));
  assert.equal(validatePresentation({assets:{priya:'./p.jpg'},slides:[{quote:{...quote,photo:'asset:priya'}}]}).valid,true);
  assert.equal(validatePresentation({slides:[{quote:{text:'x',headshot:'a.png'}}]}).valid,false);
  assert.equal(validatePresentation({slides:[{quote:{text:'x',role:3}}]}).valid,false);
});

test('role is its own footer line and the source follows the last line', () => {
  const result = layoutQuote(quote,cell,{path:'slides.0.quote'});
  const footer = result.parts[1];
  assert.equal(footer.text,'Priya Raman\nHead of Platform, Acme - Interview, March 2026');
  assert.equal(footer.fit.lines.length,2);
  assert.deepEqual(footer.sources.map(range=>range.path),['slides.0.quote.attribution','slides.0.quote.role','slides.0.quote.source']);
  for (const range of footer.sources) {
    const original = quote[range.path.split('.').at(-1)];
    assert.equal(footer.text.slice(range.outputStart,range.outputEnd),original.slice(range.start,range.end));
  }
  assert.equal(result.photo,undefined);
  assert.equal(layoutQuote({text:'Body',role:'Head of Platform'},cell).parts[1].text,'Head of Platform');
  assert.equal(layoutQuote({text:'Body',role:'Head',source:'Interview'},cell).parts[1].text,'Head - Interview');
});

test('without a role or photo the quote layout is the footer-only layout, unchanged', () => {
  const plain = {text:quote.text,attribution:quote.attribution,source:quote.source};
  const result = layoutQuote(plain,cell,{path:'slides.0.quote'});
  assert.equal('photo' in result,false);
  assert.equal(result.parts[1].text,'Priya Raman - Interview, March 2026');
  assert.deepEqual(result.parts.map(part=>part.box),[{x:58,y:78,width:764,height:306},{x:58,y:402,width:764,height:40}]);
  // An undefined role and photo are absent keys, so they change nothing.
  assert.deepEqual(layoutQuote({...plain,role:undefined,photo:undefined},cell,{path:'slides.0.quote'}),result);
});

test('a photo is a circle three footer font sizes wide at the start edge, beside the footer text', () => {
  const result = layoutQuote({...quote,photo:'priya.jpg'},cell,{path:'slides.0.quote'});
  assert.equal(result.overflow,false);
  const {photo,parts:[body,footer]} = result;
  assert.equal(photo.path,'slides.0.quote.photo');
  assert.equal(photo.value,'priya.jpg');
  assert.equal(photo.box.width,photo.box.height);
  assert.equal(photo.box.width,3*footer.fit.fontSize);
  assert.equal(photo.shape.kind,'circle');
  assert.equal(photo.shape.preset,'ellipse');
  assert.match(photo.shape.path,/^M/);
  // Start edge of the inset area; the footer text takes the rest of the width.
  assert.equal(photo.box.x,58);
  assert.ok(footer.box.x>=photo.box.x+photo.box.width);
  assert.equal(footer.box.x+footer.box.width,58+764);
  // Text is centered against the photo, and the body ends above both.
  const textCenter = footer.box.y+footer.box.height/2, photoCenter = photo.box.y+photo.box.height/2;
  assert.ok(Math.abs(textCenter-photoCenter)<1e-6);
  assert.ok(body.box.y+body.box.height<=Math.min(photo.box.y,footer.box.y)+1e-6);
  assert.ok(photo.box.y+photo.box.height<=cell.y+cell.height);
});

test('a right-to-left deck mirrors the photo to the right edge', () => {
  const ltr = layoutQuote({...quote,photo:'priya.jpg'},cell);
  const rtl = layoutQuote({...quote,photo:'priya.jpg'},cell,{direction:'rtl'});
  assert.equal(rtl.photo.box.x+rtl.photo.box.width,58+764);
  assert.equal(rtl.parts[1].box.x,58);
  assert.equal(rtl.photo.box.width,ltr.photo.box.width);
  assert.ok(rtl.parts[1].box.x+rtl.parts[1].box.width<=rtl.photo.box.x);
});

test('the photo shrinks with the footer toward the readability floor and overflow is reported', () => {
  const tight = {x:0,y:0,width:300,height:270};
  const compact = layoutQuote({text:'Keep the complete body. '.repeat(10),attribution:'Author',role:'Title',photo:'a.png'},tight,{minFontSize:16});
  assert.equal(compact.overflow,false);
  assert.equal(compact.photo.box.width,3*compact.parts[1].fit.fontSize);
  const floor = layoutQuote({text:'Keep the complete body. '.repeat(10),attribution:'Author',role:'Title',photo:'a.png'},{x:0,y:0,width:300,height:260},{minFontSize:16});
  assert.equal(floor.overflow,false);
  assert.equal(floor.parts[1].fit.fontSize,16);
  assert.equal(floor.photo.box.width,48);
  const impossible = layoutQuote({text:'Keep the complete body. '.repeat(30),attribution:'Author',photo:'a.png'},{x:0,y:0,width:300,height:120});
  assert.equal(impossible.overflow,true);
  assert.ok(impossible.diagnostics.length>0);
  assert.throws(()=>layoutQuote({text:'Keep the complete body. '.repeat(30),attribution:'Author',photo:'a.png'},{x:0,y:0,width:300,height:120},{overflow:'error'}),OPFCompositionError);
  const narrow = layoutQuote({text:'Hi',attribution:'Author',photo:'a.png'},{x:0,y:0,width:100,height:300});
  assert.equal(narrow.overflow,true);
});

test('a photo alone still draws a circle and invalid photo values are rejected', () => {
  const alone = layoutQuote({text:'Body',photo:{src:'a.png',alt:'A'}},cell);
  assert.equal(alone.parts.length,1);
  assert.equal(alone.photo.box.width,3*17);
  assert.equal(alone.overflow,false);
  assert.throws(()=>layoutQuote({text:'Body',photo:3},cell),TypeError);
  assert.throws(()=>layoutQuote({text:'Body',role:3},cell),TypeError);
  assert.throws(()=>layoutQuote({text:'Body',photo:{alt:'x'}},cell),TypeError);
});

test('composeSlide carries the photo on the quote item and measures it with the same layout', () => {
  const slide = {composition:{mode:'column'},blocks:[{quote:{...quote,photo:{src:'asset:priya',alt:'Priya Raman'}}}]};
  const result = composeSlide(slide,{width:1280,height:720});
  const item = result.items[0];
  assert.equal(item.quoteLayout.photo.path,`${item.path}.photo`);
  assert.deepEqual(item.quoteLayout.photo.value,{src:'asset:priya',alt:'Priya Raman'});
  assert.deepEqual(result.diagnostics,[]);
  const rtl = composeSlide(slide,{width:1280,height:720,direction:'rtl'});
  assert.ok(rtl.items.find(item=>item.field==='quote').quoteLayout.photo.box.x>item.quoteLayout.photo.box.x);
});

test('pagination repeats the role and the photo with each page of a split quote', () => {
  const long = {text:'A long quote that must continue over several pages. '.repeat(120),attribution:'Priya Raman',role:'Head of Platform',photo:{src:'p.png',alt:'Priya Raman'}};
  const {slides} = paginateSlide({quote:long},{minFontSize:24});
  assert.ok(slides.length>1);
  for (const slide of slides) {
    assert.equal(slide.quote.role,'Head of Platform');
    assert.deepEqual(slide.quote.photo,{src:'p.png',alt:'Priya Raman'});
  }
});

test('audit: a quote photo without alt text is reported, with alt text it is not', () => {
  const deck = (photo, extra = {}) => ({name:'Deck',language:'en-US',...extra,slides:[{title:'Customers',quote:{...quote,photo}}]});
  const alt = document => auditPresentation(document,{only:['missing-alt-text']}).diagnostics.filter(item=>item.path.endsWith('/quote/photo'));
  const missing = alt(deck('./priya.jpg'));
  assert.equal(missing.length,1);
  assert.equal(missing[0].path,'/slides/0/quote/photo');
  assert.match(missing[0].message,/^Quote photo has no alt text/);
  assert.equal(alt(deck({src:'./priya.jpg',alt:'Priya Raman at her desk'})).length,0);
  assert.equal(alt(deck({src:'./priya.jpg',alt:''})).length,0);
  assert.equal(alt(deck('asset:priya',{assets:{priya:{src:'./p.jpg',alt:'Priya Raman'}}})).length,0);
  assert.equal(alt(deck('asset:priya',{assets:{priya:'./p.jpg'}})).length,1);
});

test('markdown keeps role and photo losslessly in an opf block', () => {
  const document = {name:'Deck',slides:[{title:'Customers',quote:{...quote,photo:{src:'./priya.jpg',alt:'Priya Raman'}}}]};
  const {markdown} = opfToMarkdown(document);
  const back = markdownToOpf(markdown);
  assert.deepEqual(back.diagnostics.filter(item=>item.severity==='error'),[]);
  assert.deepEqual(back.document.slides[0].quote,document.slides[0].quote);
});

test('quote to text keeps the role on the attribution line and reports the lost photo', async () => {
  const {convertContent} = await import('../dist/convert.js');
  const result = convertContent({quote:{text:'Be brave.',attribution:'Jane Doe',role:'CTO',photo:'jane.png',source:'Interview'}},'text');
  assert.equal(result.payload.text,'Be brave.\n— Jane Doe, CTO\n— Interview');
  assert.deepEqual(result.loss,['quote photo']);
  const plain = convertContent({quote:{text:'Be brave.',attribution:'Jane Doe',source:'Interview'}},'text');
  assert.equal(plain.payload.text,'Be brave.\n— Jane Doe\n— Interview');
  assert.equal(plain.lossless,true);
  assert.equal(convertContent({quote:{text:'Be brave.',role:'CTO'}},'text').payload.text,'Be brave.\n— CTO');
});

test('the testimonial reference deck validates, audits clean of alt findings and composes without overflow', async () => {
  const {readFile} = await import('node:fs/promises');
  const deck = JSON.parse(await readFile(new URL('../../../docs/fixtures/testimonial-quotes.opf.json',import.meta.url),'utf8'));
  assert.equal(validatePresentation(deck).valid,true);
  assert.equal(auditPresentation(deck,{only:['missing-alt-text','poor-alt-text']}).diagnostics.length,0);
  const options = {width:1280,height:720,presentation:deck,fonts:{heading:'Georgia',body:'Arial'}};
  const [testimonial,roleOnly,long,plain] = deck.slides.map((slide,index)=>composeSlide(slide,{...options,slideIndex:index}));
  for (const composed of [testimonial,roleOnly,long,plain]) assert.deepEqual(composed.diagnostics,[]);
  assert.equal(testimonial.items.find(item=>item.field==='quote').quoteLayout.parts[1].fit.lines.length,2);
  assert.ok(testimonial.items.find(item=>item.field==='quote').quoteLayout.photo);
  assert.ok(long.items.find(item=>item.field==='quote').quoteLayout.photo);
  assert.equal(roleOnly.items.find(item=>item.field==='quote').quoteLayout.photo,undefined);
  assert.equal(plain.items.find(item=>item.field==='quote').quoteLayout.photo,undefined);
  assert.equal(plain.items.find(item=>item.field==='quote').quoteLayout.parts[1].text,'VP Operations, Acme Corp - Customer interview');
});
