import assert from 'node:assert/strict';
import test from 'node:test';
import {fitText,wrapText,composeSlide} from '../dist/composition.js';

const source='  A  B\tC\u00a0D\r\n\r\ntrail  \r';
const box={x:0,y:0,width:120,height:600};
const measure=(text,size)=>{assert.ok(!/[\r\n\t]/u.test(text),'Control characters must use explicit layout');return [...text].length*size/2;};
function checkRanges(text,fit) {
  let cursor=0,rebuilt='';
  for(const [index,line] of fit.sourceLines.entries()) {
    assert.equal(line.start,cursor);
    assert.equal(fit.lines[index],text.slice(line.start,line.end));
    const separator=text.slice(line.end,line.nextStart);
    assert.ok(line.boundary==='hard'?/^(\r\n|\r|\n)$/.test(separator):separator==='');
    assert.equal(line.boundary==='end',index===fit.sourceLines.length-1);
    rebuilt+=fit.lines[index]+separator;cursor=line.nextStart;
    for(const segment of line.segments) assert.ok(segment.start>=line.start&&segment.end<=line.end);
  }
  assert.equal(cursor,text.length);assert.equal(rebuilt,text);
}
test('plain source ranges retain whitespace, hard breaks and explicit tabs at every width',()=>{
  for(const text of [source,'',' \t  ','\r\n\r\n','abc\n',' e\u0301 👩‍🔬👨‍👩‍👧‍👦 xyz  ','one two three four']) {
    for(const width of [9,40,120,1000]) {
      const fit=fitText(text,{...box,width},20,20,measure);checkRanges(text,fit);
      assert.deepEqual(wrapText(text,width,20,measure),fit.lines);
      for(const line of fit.sourceLines) for(const segment of line.segments.filter(s=>s.kind==='tab'))
        assert.ok(Math.abs((segment.x+segment.width)/fit.tabWidth-Math.round((segment.x+segment.width)/fit.tabWidth))<1e-9);
    }
  }
  const fit=fitText(source,{...box,width:1000},20,20,measure);
  assert.deepEqual(fit.lines,['  A  B\tC\u00a0D','','trail  ','']);
});
test('nonbreaking prose tokens stay intact and overflow at the readability floor',()=>{
  for(const joiner of ['\u00a0','\u202f','\u2060','\ufeff']) {
    const text=`one${joiner}two`,fit=fitText(text,{...box,width:35},20,16,measure);
    assert.deepEqual(fit.lines,[text]);assert.equal(fit.fontSize,16);assert.equal(fit.overflow,true);checkRanges(text,fit);
  }
  assert.deepEqual(wrapText('abcdefgh',25,20,measure),['ab','cd','ef','gh']);
  assert.deepEqual(wrapText('e\u0301e\u0301',10,20,()=>20),['e\u0301','e\u0301']);
});
test('accepted scalar placement unions text outlines at tab stops without shaping controls',()=>{
  const text=' A\t B  \r\nC',textMeasurement={measure,outlineBounds:(value,size)=>{assert.ok(!/[\r\n\t]/u.test(value));return value.trim()?{x:-1,y:-size,width:measure(value,size)+2,height:size}:null;}};
  const result=composeSlide({title:' Title\tX ',text},{textMeasurement});
  for(const item of result.items) {checkRanges(item.value,item.text);assert.ok(item.text.placement);assert.equal(item.text.overflow,false);}
  const body=result.items.find(item=>item.field==='text');
  const line=body.text.sourceLines[0],placed=body.text.placement.lines[0];
  assert.equal(placed.width,line.width);
  assert.ok(line.segments.some(s=>s.kind==='tab'));
  assert.equal(body.value,text);
});
