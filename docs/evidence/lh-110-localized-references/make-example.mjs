import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {embed} from '../../../packages/javascript/dist/index.js';
import {gallery} from '../../../packages/gallery/dist/index.js';
const rows=[
 ['en-US','Since 2023, delivery stayed above ninety-two percent','Year','On-time delivery'],
 ['de-DE','Seit 2023 lag die Pünktlichkeit über zweiundneunzig Prozent','Jahr','Pünktlichkeit'],
 ['fr-FR','Depuis 2023, la ponctualité dépasse quatre-vingt-douze pour cent','Année','Ponctualité'],
 ['es-ES','Desde 2023, la puntualidad supera noventa y dos por ciento','Año','Puntualidad'],
 ['it-IT','Dal 2023, la puntualità supera novantadue per cento','Anno','Puntualità'],
 ['pt-PT','Desde 2023, a pontualidade supera noventa e dois por cento','Ano','Pontualidade'],
 ['nl-NL','Sinds 2023 blijft de stiptheid boven tweeënnegentig procent','Jaar','Stiptheid'],
];
const document={name:'Localized chart references',description:'One unchanged English control and six localized title messages: cardinal percent words draw the target line; the named year draws its band. Integer cardinal words are read in the effective slide language. All numbers are illustrative.',language:'en-US',design:{theme:'minimal',fontScheme:'arial'},slides:rows.map(([language,title,year,series])=>({id:language,title,language,chart:{type:'line',data:{columns:[year,{name:series,format:'0.0%'}],rows:[.934,.941,.928,.952,.961].map((value,index)=>[String(2021+index),value])}}}))};
const embedded=embed(document,{catalogs:[gallery]});assert.deepEqual(embedded.unresolved,[]);await fs.writeFile(new URL('../../../examples/technical/localized-chart-references.opf.json',import.meta.url),JSON.stringify(embedded.document,null,2)+'\n');
