import assert from 'node:assert/strict';
export function portableShowcase(document,embed){
 const result=embed(document);assert.deepEqual(result.unresolved,[],'showcase references must resolve before rendering');
 assert.ok(result.document.catalogs?.default?.fontSchemes?.roboto,'showcase must embed its authored Roboto scheme');
 return result.document;
}
export function assertShowcaseSvg(svg){
 assert.ok(svg.includes('font-family="Roboto, sans-serif"'),'showcase must draw its authored Roboto family');
 assert.ok(!/font-family="(?:Intos|Intos Display)[,"]/.test(svg),'showcase must not silently use engine default fonts');
 for(const weight of [400,700])assert.ok(new RegExp('font-family:\"Roboto\";font-weight:'+weight+';font-style:normal;src:url\\(\"data:font/').test(svg),'showcase must embed Roboto '+weight);
 assert.ok(svg.includes('SIL OPEN FONT LICENSE'),'showcase embedded fonts must retain their license');
}
