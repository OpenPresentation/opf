import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unzipSync,strFromU8} from 'fflate';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx} from '../dist/index.js';

// Failed name metadata must not bypass the existing 500→400 / 800→700
// normalization for weights DrawingML represents only with a bold flag.
test('metric demand handles retain native drawn-weight normalization',async()=>{
  const document={slides:[{title:'Metric',metric:{value:'42%',label:'Growth',description:'Year over year'}}]};
  const fonts=await loadFonts({pack:'office',substitutionPolicy:'metric',scripts:'auto',presentation:document});
  const full=await loadFonts({pack:'office',substitutionPolicy:'metric'});
  for(const fontWeight of [500,800]){
    assert.throws(()=>fonts.textMeasurement.resolveStyle({fontFamily:'Aptos',fontWeight}),error=>error.code==='font-unavailable');
    const nominal=fonts.registry.fontNames.resolveFont({fontFamily:'Aptos',fontWeight});
    assert.equal(nominal.resolvedWeight,undefined,'A fallback name is not successful metadata selection');
  }
  const parts=bytes=>Object.fromEntries(Object.entries(unzipSync(bytes)).filter(([name])=>/^ppt\/(slides|theme)\/.*\.xml$/.test(name)).map(([name,value])=>[name,strFromU8(value)]));
  try{
    const options={bodyText:'native',date:'2026-11-10'};
    const expected=parts(await toPptx(document,{...options,fonts:full}));
    const actual=parts(await toPptx(document,{...options,fonts}));
    assert.deepEqual(actual,expected,'Generated metric weights match the original fully prepared provider exactly');
    assert.match(actual['ppt/slides/slide1.xml'],/<a:t>42%<\/a:t>/);
  }finally{fonts.dispose?.();full.dispose?.();}
});
