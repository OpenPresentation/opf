import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {imagePlaceholderCount} from './helpers/image-placeholders.mjs';
const shape = name => `<p:cNvPr id="1" name="${name}"/>`;
test('one panel counts once despite grouped label and icon shapes', () => {
 const xml = ['OPF image placeholder 1 group','OPF image placeholder 1','OPF image placeholder 1 text line 0','OPF image placeholder 1 icon 0'].map(shape).join('');
 assert.equal(imagePlaceholderCount(xml),1);
 assert.equal(imagePlaceholderCount(shape('OPF image placeholder 1')),1,'older ungrouped exports remain supported');
 assert.equal(imagePlaceholderCount(shape('OPF image placeholder 1 group')),0,'a missing panel must fail the installed count assertion');
});
test('multiple real panels remain distinct and similarly named ordinary shapes do not count', () => {
 const xml = ['OPF image placeholder 1','OPF image placeholder 2','OPF image placeholder 2 text line 0','OPF image placeholder text','OPF image placeholder 3 altered'].map(shape).join('');
 assert.equal(imagePlaceholderCount(xml),2);
});

test('actual grouped and published 0.18.0 exports retain one semantic image placeholder', () => {
 for(const file of ['slide1.xml','published-0180-slide1.xml']){
  const xml=readFileSync(new URL('../../../docs/evidence/rr59-image-placeholder-oracle/'+file,import.meta.url),'utf8');
  assert.equal(imagePlaceholderCount(xml),1);
  assert.equal((xml.match(/<p:pic>/g)??[]).length,0);
  assert.match(xml,/Image unavailable/);
 }
});
