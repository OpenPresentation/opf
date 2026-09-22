from pathlib import Path
import base64,gzip,hashlib,json,zipfile,collections,subprocess
root=Path('/private/tmp/opf-svg-security-postmerge-diagnostic-20260921')
source=Path('/Users/michael/Source/pptx-dev')
artifact=Path('/private/tmp/opf-author-source-release-20260921/keyboard-postmerge-ci/linux-failure/svg-security-published-SVG-25408-rted-document-strings-inert')
trace=artifact/'trace.zip'
receipt={'sourceHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip(),'tracePath':str(trace),'traceSha256':hashlib.sha256(trace.read_bytes()).hexdigest(),'errorContextSha256':hashlib.sha256((artifact/'error-context.md').read_bytes()).hexdigest(),'snapshots':[],'actions':[]}
with zipfile.ZipFile(trace) as z:
 rows=[json.loads(line) for line in z.read('test.trace').decode().splitlines()]
 ends={row.get('callId'):row for row in rows if row['type']=='after'}
 for row in rows:
  if row.get('callId') in ['pw:api@34','expect@35','expect@36'] and row['type']=='before':
   end=ends[row['callId']]
   receipt['actions'].append({'callId':row['callId'],'title':row['title'],'startTime':row['startTime'],'endTime':end['endTime'],'durationMs':round(end['endTime']-row['startTime'],3),'success':'error' not in end,'stack':row['stack']})
 for row in map(json.loads,z.read('1-trace.trace').decode().splitlines()):
  if row['type']=='frame-snapshot':
   s=row['snapshot'];url=s['frameUrl'];info={'callId':s['callId'],'phase':s['phase'],'timestamp':s['timestamp']}
   if '#opf=' in url:
    token=url.split('#opf=')[1];data=gzip.decompress(base64.urlsafe_b64decode(token+'='*((-len(token))%4)));doc=json.loads(data)
    label='hostile' if doc['name']=='Untrusted shared document' else 'starter'
    (root/f'{label}-url-document.json').write_bytes(data)
    info.update({'url':url,'decodedSha256':hashlib.sha256(data).hexdigest(),'documentName':doc['name'],'slideCount':len(doc['slides']),'firstTitle':doc['slides'][0]['title']})
   receipt['snapshots'].append(info)
  elif row['type']=='screencast-frame' and row['timestamp'] in [191810.212,192318.348]:
   target=root/('before-strict-failure.jpeg' if row['timestamp']==191810.212 else 'after-strict-failure.jpeg')
   target.write_bytes(z.read('resources/'+row['file']) if 'resources/'+row['file'] in z.namelist() else z.read(row['file']))
 network=[json.loads(line)['snapshot'] for line in z.read('1-trace.network').decode().splitlines()]
 receipt['network']={'retainedRequests':len(network),'statuses':dict(collections.Counter(row['response']['status'] for row in network)),'maxRetainedDurationMs':max(row['time'] for row in network),'limitation':'Retained completed requests only; no new probes.'}
 receipt['sourceHashes']={f:hashlib.sha256((source/f).read_bytes()).hexdigest() for f in ['tests/e2e/svg-security.spec.ts','components/playground/playground-shell.tsx','components/playground/preview-pane.tsx','components/playground/preview-canvas-slide.tsx','components/playground/slide-canvas.tsx','lib/playground/opf-handoff.ts','lib/playground/opf-codec.ts','lib/playground/__tests__/opf-handoff.test.ts']}
(root/'trace-facts.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k not in ['snapshots','sourceHashes']},indent=2))
