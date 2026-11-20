import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {smartArtUnavailable,opfSmartArtUnavailable,SMART_ART_DOMAIN,SMART_ART_OPF_DOMAIN} from '@openpresentation/opf/composition';
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('fixtures/sh20-live-domain-boundary.json.gz',import.meta.url)))),rows=fixture.rows;
assert.equal(rows.length,516,'all original observations remain');assert.equal(new Set(rows.map(r=>r.id)).size,516);
const live=rows.filter(r=>r.originalLive),passed=live.filter(r=>r.originalResult==='pass');assert.equal(live.length,465);assert.equal(passed.length,201);
const decision=({type,candidate})=>type==='builtin'?smartArtUnavailable(candidate):opfSmartArtUnavailable(candidate);
for(const row of rows){const allowed=row.predicate?decision(row.predicate)===undefined:false;assert.equal(allowed,row.eligible,row.id+': current core policy agrees with recorded native/export boundary');if(allowed)assert.equal(row.originalResult,'pass',row.id+': every enabled measured instance passed the complete native gate');else assert.ok(row.reason,row.id+': fallback has a recorded reason');}
assert.equal(rows.filter(r=>r.eligible).length,132);assert.equal(rows.filter(r=>r.eligible&&r.predicate.type==='opf').length,30);
const failed=live.filter(r=>r.originalResult!=='pass');assert.equal(failed.length,264);assert.ok(failed.every(r=>!r.eligible&&r.checks.native===false),'no failed pixel/text case becomes live');assert.ok(live.every(r=>r.checks.layout&&r.checks.size),'all node/rotation/size observations remain passing');assert.equal(failed.filter(r=>!r.checks.geometry).length,3,'all dense escaped-text failures retained');
for(const script of ['cjk','zh','he','rtl'])assert.ok(rows.filter(r=>r.script===script).every(r=>!r.eligible),script+': measured script failures stay outside live domain');
const caps=rows.filter(r=>r.originalLive&&r.script==='latin'&&r.predicate?.type==='opf').filter(r=>{const c=r.predicate.candidate;return !c.rtl&&!c.script&&Math.max(...c.lines)<=SMART_ART_OPF_DOMAIN.lines&&c.stable.every(Boolean)&&(c.widest??0)<=SMART_ART_DOMAIN.lineWidth+1e-6&&(c.ink??0)<=SMART_ART_OPF_DOMAIN.ink+1e-6});
assert.equal(caps.length,30);assert.ok(caps.every(r=>r.eligible),'dropping only design/count/compact restrictions admits no new measured domain');
for(const type of ['builtin','opf']){const selected=rows.find(r=>r.eligible&&r.predicate.type===type).predicate,candidate=structuredClone(selected.candidate);candidate.rtl=true;assert.ok(decision({type,candidate}),'RTL refuses even when other fields fit');candidate.rtl=false;candidate.script='cjk';assert.ok(decision({type,candidate}),'Chinese/Japanese refusal remains explicit');}
console.log('SH20/22 boundary: all516observations,465live,201pass/264fail,132eligible/0fail(30OPF), no safe additional domain; script/dense-wrap refusals retained.');
