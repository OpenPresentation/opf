import assert from 'node:assert/strict';
import {assertCatalogGeneration} from './consumer-dependencies.mjs';
export const BROWSER_TEXT={title:'Quarterly review',body:'Revenue grew while costs stayed flat across every region',code:'const score = urgency * confidence;'};
export function browserFixture(scheme,{catalogSchema,coreVersion,gallery,validate}){
 assert.ok(catalogSchema===1||catalogSchema===2||catalogSchema===3||catalogSchema===4,'supported actual catalog schema');
 assertCatalogGeneration(coreVersion,catalogSchema);
 const text=BROWSER_TEXT;
 const code=catalogSchema===1
  ?{id:'b',layout:'code-1x',title:text.title,code:{source:text.code,language:'ts'},text:text.body}
  :{id:'b',layout:'code',title:text.title,blocks:[{region:'code',code:{source:text.code,language:'ts'}},{region:'notes',text:text.body}]};
 assert.ok(gallery.layouts[code.layout],'fixture layout belongs to the loaded catalog');
 const deck={name:`browser ${scheme}`,language:'en',design:{theme:'minimal',fontScheme:scheme},slides:[{id:'a',title:text.title,text:text.body},code]};
 const report=validate(deck,{catalogs:[gallery],only:['format','references']});assert.equal(report.valid,true,JSON.stringify(report.findings));
 return deck;
}
