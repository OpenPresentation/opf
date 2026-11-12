import fs from 'node:fs';
import {parseTarget,buildPollQuery,ghDeps,readTarget,latestPerName,evaluateChecks} from '/tmp/opf-034/scripts/pr-gate.mjs';
const out='/tmp/opf-final-candidate-snapshot05', target=parseTarget('OpenPresentation/opf@e923afbe78413608f98d942089e9763d6b10282b',{commit:true});
const query=buildPollQuery([target]);fs.writeFileSync(out+'/query.graphql',query,{flag:'wx'});
const data=await ghDeps().graphql(query);fs.writeFileSync(out+'/snapshot.json',JSON.stringify(data,null,2)+'\n',{flag:'wx'});
const view=readTarget(target,data.t0), checks=latestPerName(view.checks??[]),counts={};
for(const c of checks)counts[c.state]=(counts[c.state]??0)+1;
const result={at:new Date().toISOString(),apiBudget:1,actualGraphQLCalls:1,target,exists:view.exists,commitOid:view.commitOid,truncated:view.truncated,counts,verdict:view.truncated?'UNJUDGED_PARTIAL':evaluateChecks({checks,required:'all'}),checks};
fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({at:result.at,exists:view.exists,oid:view.commitOid,truncated:view.truncated,counts,verify:checks.filter(c=>c.name==='verify'),failing:checks.filter(c=>!['SUCCESS','SKIPPED','NEUTRAL','PENDING'].includes(c.state)),pending:checks.filter(c=>c.state==='PENDING').map(c=>c.name)}));
