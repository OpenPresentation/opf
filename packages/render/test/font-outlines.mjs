import assert from 'node:assert/strict';
import {loadOfficeFontRegistry} from '../dist/fonts-node.js';
import {measureTextOutline} from '@openpresentation/opf/composition';
const fonts=await loadOfficeFontRegistry({substitutionPolicy:'visual'});
const measure=fonts.textMeasurement;
const bold={fontFamily:'Carlito',fontWeight:700},italic={fontFamily:'Carlito',fontWeight:400,italic:true};
assert.deepEqual(measure.outlineBounds('narrow',40.5,bold),{x:2.4521484375,y:-20.0126953125,width:119.304931640625,height:20.309326171875});
assert.equal(measure.measure('narrow',40.5,bold),121.8955078125);
assert.ok(measure.outlineBounds('j',25,italic).x<0,'Italic ink can start before the advance origin');
for(const text of ['', ' ', '    '])assert.equal(measure.outlineBounds(text,25,bold),null);
let cases=0;
for(const face of fonts.embeddedFonts) {
  const style={fontFamily:face.family,fontWeight:face.weight,italic:face.italic};
  for(const text of ['AVATAR office affine','  Keep spaces  ','Ágj']) {
    const before=measure.measure(text,25,style),bounds=measure.outlineBounds(text,25,style);
    assert.ok(bounds.width>0&&bounds.height>0);assert.equal(measure.measure(text,25,style),before);
    const twice=measure.outlineBounds(text,50,style);for(const key of ['x','y','width','height'])assert.equal(twice[key],bounds[key]*2);
    const changed=measure.outlineBounds(text,25,style);changed.x=Infinity;assert.deepEqual(measure.outlineBounds(text,25,style),bounds);
    assert.deepEqual(measureTextOutline(text,25,style,measure),bounds);cases++;
  }
}
for(const method of [measure.measure,measure.outlineBounds]) {
  for(const size of [0,-1,NaN,Infinity])assert.throws(()=>method('text',size,bold),{code:'invalid-text-measurement'});
  assert.throws(()=>method('你好',25,bold),{code:'missing-glyph'});
  assert.throws(()=>method('text',25,{...bold,fontFamily:'Unavailable family'}),{code:'font-unavailable'});
}
fonts.clearSubstitutions();assert.deepEqual(measure.outlineBounds('narrow',40.5,{fontFamily:'Aptos',fontWeight:700}),measure.outlineBounds('narrow',40.5,bold));
assert.ok(fonts.substitutions.some(item=>item.requestedFamily==='Aptos'&&item.resolvedFamily==='Carlito'&&item.compatibility==='visual'));
console.log(`Font outlines: ${cases} pinned face/text combinations preserve advances, scaling and cache isolation; empty ink, negative bearings, substitution and strict errors pass.`);
