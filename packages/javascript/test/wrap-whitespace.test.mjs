import assert from 'node:assert/strict';
import test from 'node:test';
import {fitRichText,fitText,wrapText} from '../dist/composition.js';

// Every character is 10 px wide at size 20 (0.5 em), so a box of n characters is 10 n px.
const measure=(text,size)=>[...text].length*size/2;
const SIZE=20;
const style={fontFamily:'Fixture',fontWeight:400};
const options={style,textMeasurement:{measure}};

// RR-17: whitespace at a soft break hangs at the end of its line; a wrapped line never starts with a space, and the source stays lossless.
test('prose wraps never start a line with a space, at every width, and keep the source exactly',()=>{
  const text='Typography is the quiet engine of every presentation. When a deck travels from one machine to another, the letterforms stay put.';
  for(let columns=12;columns<=60;columns++){
    const plain=wrapText(text,columns*10,SIZE,measure);
    assert.equal(plain.join(''),text,`${columns}: plain lines rebuild the source`);
    for(const line of plain.slice(1))assert.doesNotMatch(line,/^\s/u,`${columns}: plain line "${line}"`);
    const rich=fitRichText([text],{x:0,y:0,width:columns*10,height:1e6},SIZE,SIZE,options);
    assert.equal(rich.lines.join(''),text,`${columns}: rich lines rebuild the source`);
    for(const line of rich.lines.slice(1))assert.doesNotMatch(line,/^\s/u,`${columns}: rich line "${line}"`);
  }
});

test('a space that does not fit hangs: it is in the line text but not in the line width',()=>{
  // "aaaa bbbb cccc" in a 9 character box: "aaaa bbbb" fills the box exactly, so the space after it does not fit.
  const fit=fitText('aaaa bbbb cccc',{x:0,y:0,width:90,height:1e6},SIZE,SIZE,measure);
  assert.deepEqual(fit.lines,['aaaa bbbb ','cccc']);
  assert.equal(fit.sourceLines[0].width,90,'the hanging space is not counted');
  assert.equal(fit.sourceLines[0].nextStart,10);
  assert.equal(fit.overflow,false);
  const rich=fitRichText(['aaaa bbbb cccc'],{x:0,y:0,width:90,height:1e6},SIZE,SIZE,options);
  assert.deepEqual(rich.lines,['aaaa bbbb ','cccc']);
  assert.equal(rich.richLines[0].width,90);
  assert.equal(rich.overflow,false);
  // A space that fits is retained and counted, as before.
  assert.deepEqual(fitText('aaaa bbbb cccc',{x:0,y:0,width:100,height:1e6},SIZE,SIZE,measure).lines,['aaaa bbbb ','cccc']);
  assert.equal(fitText('aaaa bbbb cccc',{x:0,y:0,width:100,height:1e6},SIZE,SIZE,measure).sourceLines[0].width,100);
});

test('an exact fit does not wrap one word early on a rounding error',()=>{
  // 0.6 em cells at 14.4 px: eight cells are 69.12 px, and the box is a hair under that.
  const cell=(text,size)=>[...text].length*size*0.6;
  const size=14.4;
  const fit=fitRichText(['abc defg'],{x:0,y:0,width:8*size*0.6-1e-9,height:1e6},size,size,{style,textMeasurement:{measure:cell}});
  assert.deepEqual(fit.lines,['abc defg']);
  assert.equal(fit.overflow,false);
});

test('no-break spaces still protect their words and indentation is kept',()=>{
  const nbsp='aaaa bbbb cccc';
  assert.equal(wrapText(nbsp,100,SIZE,measure).join(''),nbsp);
  assert.equal(wrapText('  indented words here',70,SIZE,measure).join(''),'  indented words here');
  assert.ok(wrapText('  indented words here',70,SIZE,measure)[0].startsWith('  '));
});
