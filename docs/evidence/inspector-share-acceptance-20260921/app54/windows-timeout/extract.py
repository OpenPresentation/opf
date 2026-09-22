from pathlib import Path
import json,hashlib,zipfile,shutil,collections
base=Path('/private/tmp/opf-inspector-share-guard-20260921');repo=base/'pptx-dev';ci=base/'ci';raw=ci/'windows-failure/svg-security-published-SVG-25408-rted-document-strings-inert';out=Path('/private/tmp/opf-app54-windows-timeout-20260921')
def write(n,x):(out/n).write_text(json.dumps(x,indent=2)+'\n')
def digest(p):
 b=p.read_bytes();return {'path':str(p),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
z=zipfile.ZipFile(raw/'trace.zip');assert z.testzip() is None
te=[json.loads(x) for x in z.read('test.trace').decode().splitlines()];ends={e['callId']:e for e in te if e['type']=='after'}
rows=[]
for e in te:
 if e['type']=='before':
  after=ends.get(e['callId'],{});r={k:e[k] for k in ['callId','startTime','title','stack','params'] if k in e};r.update({k:after[k] for k in ['endTime','error'] if k in after});r['durationMs']=round(after['endTime']-e['startTime'],3) if 'endTime' in after else None;rows.append(r)
write('test-timeline.json',{'source':str(raw/'trace.zip'),'member':'test.trace','clock':'Original Playwright monotonic milliseconds; error event itself has no timestamp, bounded by adjacent calls.','rows':rows,'errors':[e for e in te if e['type']=='error']})
lib=[json.loads(x) for x in z.read('1-trace.trace').decode().splitlines()]
write('preview-click-and-hook-events.json',[e for e in lib if e.get('callId') in ['call@4341','call@4343','call@4345']])
net=[json.loads(x)['snapshot'] for x in z.read('1-trace.network').decode().splitlines()]
selected=[x for x in net if '1n-j6a4lqrto8' in x['request']['url'] or x['request']['url'].endswith('/author') or x.get('response',{}).get('status',0)<0]
write('selected-network-records.json',selected)
r=json.loads((raw/'windows-readiness-timings.json').read_text());doc=r['documents'][0]
write('timing-summary.json',{'diagnostic':{k:v for k,v in r.items() if k!='documents'},'document':{k:v for k,v in doc.items() if k!='entries'},'entryCount':len(doc['entries']),'navigation':[x for x in doc['entries'] if x['entryType']=='navigation'],'longtasks':[x for x in doc['entries'] if x['entryType']=='longtask'],'slowestResources':sorted([x for x in doc['entries'] if x['entryType']=='resource'],key=lambda x:x.get('duration',0),reverse=True)[:8],'traceHttpStatusCounts':dict(collections.Counter(x.get('response',{}).get('status') for x in net)),'scope':'Resource observations describe completed requests. One -1 is an unfinished/failed network record, not an HTTP error status. No >=400 response status appears in this trace.'})
for name in ['windows-readiness-timings.json','error-context.md']:shutil.copyfile(raw/name,out/name)
source=[]
for name in ['tests/e2e/svg-security.spec.ts','tests/e2e/helpers/readiness-diagnostics.ts','playwright.config.ts']:
 p=repo/name;d=digest(p);d['traceSourceMatches']=[n for n in z.namelist() if n.startswith('src/') and z.read(n)==p.read_bytes()];source.append(d)
write('identities.json',{'run':35638158483,'attempt':1,'head':'60c91f6b97c75636f533202f4112e09dc01144e4','traceCrcPass':True,'originals':[digest(raw/'trace.zip'),digest(raw/'error-context.md'),digest(raw/'windows-readiness-timings.json'),digest(ci/'windows-failure-artifact.zip'),digest(ci/'windows-readiness-artifact.zip'),digest(ci/'windows-job.log')],'sources':source,'duplicateTimingEqual':(raw/'windows-readiness-timings.json').read_bytes()==(ci/'windows-readiness/svg-security-published-SVG-25408-rted-document-strings-inert/windows-readiness-timings.json').read_bytes()})
print(json.dumps({'sourceIdentities':source,'unfinishedNetwork':[(x['request']['url'],x['response'].get('_failureText'),x['response']['status']) for x in selected if x['response']['status']<0]},indent=2))
