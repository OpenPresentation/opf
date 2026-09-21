from pathlib import Path
from urllib.parse import urlsplit
import json,zipfile,hashlib
root=Path(__file__).parent
(root/'review-images').mkdir(exist_ok=True)
allresults=[]
for archive in sorted((root/'results').glob('*/trace.zip')):
 z=zipfile.ZipFile(archive)
 rows=[];network=[]
 for name in z.namelist():
  if name.endswith('.trace') and name!='test.trace':rows.extend(json.loads(r) for r in z.read(name).splitlines())
  if name.endswith('.network'):network.extend(json.loads(r)['snapshot'] for r in z.read(name).splitlines())
 befores={r['callId']:r for r in rows if r['type']=='before'}
 failed=[{'start':befores.get(r['callId'],{}).get('startTime'),'end':r.get('endTime'),'params':befores.get(r['callId'],{}).get('params'),'error':r.get('error')} for r in rows if r['type']=='after' and 'error' in r]
 selected=[]
 for r in network:
  response=r['response'];request=r['request'];url=request['url'];status=response['status'];duration=r.get('time',0)
  if status<0 or status>=400 or duration>4000:
   selected.append({'path':urlsplit(url).path,'status':status,'durationMs':duration,'started':r['startedDateTime'],'monotonicStart':r.get('_monotonicTime'),'resourceType':r.get('_resourceType'),'responseBodyBytes':response.get('bodySize'),'contentBytes':response.get('content',{}).get('size'),'cacheHeaders':{h['name']:h['value'] for h in response.get('headers',[]) if h['name'].lower() in ['x-vercel-cache','age','cache-control','content-length','content-encoding']},'referer':next((urlsplit(h['value']).path for h in request['headers'] if h['name'].lower()=='referer'),None)})
 # Resolve snapshot references using Playwright's post-order node table.
 snaps=[r['snapshot'] for r in rows if r['type']=='frame-snapshot' and r['snapshot'].get('isMainFrame')]
 def nodes(s):
  if '_nodes' not in s:
   out=[]
   def visit(n):
    if isinstance(n,str):out.append(n)
    elif isinstance(n,list) and isinstance(n[0],str):
     for c in n[2:]:visit(c)
     out.append(n)
   visit(s['html']);s['_nodes']=out
  return s['_nodes']
 def resolve(n,i):
  if isinstance(n,str):return n
  if isinstance(n[0],list):
   j=i-n[0][0];return resolve(nodes(snaps[j])[n[0][1]],j)
  return [n[0],n[1] if len(n)>1 else {},*[resolve(c,i) for c in n[2:]]]
 def text(n):
  if isinstance(n,str):return n
  if n[0] in ['STYLE','SCRIPT']:return ''
  return ''.join(text(c) for c in n[2:])
 def matches(n,out):
  if isinstance(n,str):return
  a=n[1];cls=a.get('class','')
  if any(c in cls for c in ['suggest-widget','quick-input-widget','monaco-editor ']) or a.get('data-testid')=='inspector-canvas-overlay' or a.get('role')=='img':
   out.append({'tag':n[0],'attrs':a,'text':text(n)[:500]})
  for c in n[2:]:matches(c,out)
 final=[]
 if snaps:matches(resolve(snaps[-1]['html'],len(snaps)-1),final)
 timeline=[]
 if 'author-json-options' in str(archive):
  for i,s in enumerate(snaps):
   if s['timestamp']>min(f['start'] for f in failed if f['start'])-1500:
    found=[];matches(resolve(s['html'],i),found)
    timeline.append({'time':s['timestamp'],'state':found})
 screens=[r for r in rows if r['type']=='screencast-frame']
 screenfile=None
 if screens:
  s=max(screens,key=lambda x:x['timestamp']);name=s['file']
  if name in z.namelist():
   screenfile='review-images/'+archive.parent.name+'.jpeg';(root/screenfile).write_bytes(z.read(name))
 record={'testDirectory':archive.parent.name,'tracePath':str(archive.relative_to(root)),'traceSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'requestCount':len(network),'httpErrorResponses':[r['response']['status'] for r in network if r['response']['status']>=400],'failedAssertions':failed,'pendingOrSlowRequests':selected,'lastSnapshotTime':snaps[-1]['timestamp'] if snaps else None,'finalState':final,'finalScreenshot':screenfile,'consoleErrors':[r for r in rows if r['type']=='console' and r.get('messageType')=='error']}
 allresults.append(record)
 if timeline:(root/'author-lf-widget-timeline.json').write_text(json.dumps(timeline,indent=2)+'\n')
(root/'trace-readiness-evidence.json').write_text(json.dumps(allresults,indent=2)+'\n')
for r in allresults:
 print(r['testDirectory'],'requests',r['requestCount'],'HTTP errors',r['httpErrorResponses'],'pending',sum(x['status']<0 for x in r['pendingOrSlowRequests']))
 print('failure',[(f['start'],f['end'],f['params'].get('selector') if f['params'] else None) for f in r['failedAssertions']])
 print('state',[(s['attrs'].get('class','')[:55],s['attrs'].get('data-testid'),s['text'][:110]) for s in r['finalState']])
