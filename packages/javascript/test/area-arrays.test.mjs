import assert from 'node:assert/strict';
import {test} from 'node:test';
import {layoutTemplate, layoutTemplateIssues} from '../dist/composition.js';
import {validateCatalogRecord} from '../dist/index.js';
const base = {$schema:'https://openpresentation.org/schema/opf-layout/v2',id:'array-grid',name:'Array grid',areas:[['title','title'],['main','aside']],rows:['auto',1],regions:{main:{accepts:['text']},aside:{accepts:['metric']}}};
test('nested rows preserve spans, cell order and empty cells',()=>{
  const result=layoutTemplate(base);
  assert.equal(result.areas.find(area=>area.name==='title').columnSpan,2);
  assert.equal(result.areas.find(area=>area.name==='aside').column,1);
  assert.equal(validateCatalogRecord('layouts',base).valid,true);
  assert.equal(layoutTemplateIssues({...base,areas:[['title','title'],['main','.']],regions:{main:{accepts:['text']}}}).length,0);
});
test('legacy string rows and malformed cells fail explicitly instead of being split or coerced',()=>{
  for(const areas of [['title title','main aside'],[['title','title'],['main aside','.']],[['title','title'],['main',null]],[['title','title'],['main',42]],[[],['main','aside']]]) {
    assert.equal(validateCatalogRecord('layouts',{...base,areas}).valid,false,JSON.stringify(areas));
    assert.ok(layoutTemplateIssues({...base,areas}).length,JSON.stringify(areas));
  }
  assert.ok(layoutTemplateIssues({...base,areas:[['title','title'],['main',null]]}).some(issue=>issue.path==='/areas/1/1'));
});
test('ragged and nonrectangular arrays remain invalid',()=>{
  for(const areas of [[['title','title'],['main']],[['main','aside'],['aside','main']]])assert.ok(layoutTemplateIssues({...base,areas}).length);
});
