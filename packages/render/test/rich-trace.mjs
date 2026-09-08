import assert from 'node:assert/strict';
import {renderSvg} from '../dist/svg.js';
const text='\nFirst line\r\n\nLast line\n\n';
const deck={slides:[{text:[{text:text.slice(0,8),bold:true},text.slice(8)]}]};
const traced=renderSvg(deck,{trace:true});
const match=traced.match(/data-opf-rich-lines="([^"]+)"/);
assert.ok(match,'Rich trace exposes layout lines');
const lines=JSON.parse(match[1].replaceAll('&quot;','"'));
assert.equal(lines.length,6);
assert.deepEqual(lines.map(line=>text.slice(line.start,line.end)),['','First line','','Last line','','']);
assert.equal(lines.at(-1).start,text.length);
for(let i=0;i<lines.length;i++) {
  assert.ok(lines[i].height>0);
  if(i)assert.equal(lines[i].y,lines[i-1].y+lines[i-1].height);
}
assert.ok(!renderSvg(deck).includes('data-opf-rich-lines'),'Caret metadata is opt-in tracing only');
console.log('Rich trace passed: leading/trailing blank lines, CRLF, cross-run offsets and measured heights.');
