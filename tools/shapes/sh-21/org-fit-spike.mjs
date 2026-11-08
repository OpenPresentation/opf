import fs from 'node:fs';
const [source,out]=process.argv.slice(2);if(!source||!out||fs.existsSync(out))throw Error('Usage: org-fit-spike.mjs <trees.json> <fresh-report.json>');
const rows=JSON.parse(fs.readFileSync(source,'utf8').replace(/^\uFEFF/,''));
const t=(text,children=[])=>({text,children});
const sets={k1:t('Plan',[t('Build')]),k2:t('Plan',[t('Build'),t('Test')]),k3:t('Plan',[t('Build'),t('Test'),t('Ship')]),k4:t('Plan',[t('Build'),t('Test'),t('Ship'),t('Learn')]),k6:t('Plan',Array.from({length:6},(_,i)=>t('A'+(i+1)))),'2x2':t('Plan',[t('Build',[t('Web'),t('App')]),t('Test',[t('Unit'),t('Load')])]),'3x1':t('Plan',[t('Build',[t('Web')]),t('Test',[t('Unit')]),t('Ship',[t('Docs')])]),uneven:t('Plan',[t('Build',[t('Web'),t('App'),t('API')]),t('Test')]),depth3:t('Plan',[t('Build',[t('Web',[t('CSS')])])]),roots2:t('Plan',[t('Build'),t('Run',[t('Ops')])]),asst:{...t('Plan',[t('Build'),t('Test'),t('Ship')]),assistant:'Aide'}};
function place(node,root=false){
 if(node.assistant){const own=place({...node,assistant:undefined},true),nodes=own.nodes.map((n,i)=>i?{...n,row:n.row+1}:n);nodes.push({text:node.assistant,x:own.root-1.21,row:1});const min=Math.min(...nodes.map(n=>n.x));return{root:own.root-min,nodes:nodes.map(n=>({...n,x:n.x-min}))};}
 if(!node.children.length)return{root:0,nodes:[{text:node.text,x:0,row:0}]};
 if(!root&&node.children.every(c=>!c.children.length))return{root:0,nodes:[{text:node.text,x:0,row:0},...node.children.map((c,i)=>({text:c.text,x:.5,row:i+1}))]};
 const placed=[];const roots=[];const contour=new Map();
 for(const child of node.children){const own=place(child);let shift=0;
  for(const v of own.nodes)if(contour.has(v.row))shift=Math.max(shift,contour.get(v.row)+.42-v.x);
  roots.push(own.root+shift);for(const v of own.nodes){const x=v.x+shift;placed.push({...v,x,row:v.row+1});contour.set(v.row,Math.max(contour.get(v.row)??-Infinity,x+2));}
 }
 const x=(roots[0]+roots.at(-1))/2;const nodes=[{text:node.text,x,row:0},...placed];const min=Math.min(...nodes.map(v=>v.x));return{root:x-min,nodes:nodes.map(v=>({...v,x:v.x-min}))};
}
const result=[];for(const r of rows.filter(r=>r.layout==='orgChart1'&&sets[r.set])){const[W,H]=r.frame.split('x').map(Number),model=place(sets[r.set],true),maxx=Math.max(...model.nodes.map(n=>n.x+2)),maxy=Math.max(...model.nodes.map(n=>n.row*1.42+1));let lo=0,hi=1.25*W,iterations=0;while(iterations++<40&&(hi-lo)>.002*(lo+hi)/2){const mid=(lo+hi)/2;if(maxx*mid<=W&&maxy*mid<=H)lo=mid;else hi=mid;}
 const h=lo,ox=(W-maxx*h)/2,oy=(H-maxy*h)/2;let error=0;const differences=[];
 for(const n of model.nodes){const actual=r.items.find(i=>i.text===n.text);if(!actual)throw Error('Missing '+r.set+' '+n.text);const expected=[ox+n.x*h,oy+n.row*1.42*h,2*h,h],v=['left','top','width','height'].map((k,i)=>Math.abs(actual[k]-expected[i]));error=Math.max(error,...v);if(Math.max(...v)>.1)differences.push({text:n.text,actual:[actual.left,actual.top,actual.width,actual.height],expected,error:Math.max(...v)});}
 result.push({set:r.set,frame:r.frame,error,iterations,nodes:model.nodes.length,units:[maxx,maxy],differences});}
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');for(const set of Object.keys(sets)){const g=result.filter(r=>r.set===set);console.log(set,'max',Math.max(...g.map(r=>r.error)),'fail',g.filter(r=>r.error>.1).length,g.find(r=>r.error>.1)?.differences[0]);}