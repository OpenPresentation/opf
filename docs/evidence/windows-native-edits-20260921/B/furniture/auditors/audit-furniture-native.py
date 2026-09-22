"""Independent, offline native observation and archive checks; no COM/importer."""
import copy, hashlib, json, pathlib, sys, zipfile, xml.etree.ElementTree as ET

run = pathlib.Path(sys.argv[1]).resolve()
checks = []
def read(p): return json.loads(pathlib.Path(p).read_text(encoding='utf-8-sig'))
def sha(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def check(name, fn):
    try: fn(); checks.append({'name': name, 'passed': True})
    except Exception as exc: checks.append({'name': name, 'passed': False, 'error': str(exc)})
def eq(a,b): assert a == b, (a,b)
def bound(p):
    p = pathlib.Path(p).resolve()
    assert p.is_relative_to(run), p
    return p
report = read(run/'report.json')
request = read(run/'request.json')
worker = read(run/'worker.json')
parent = read(run/'supervisor.json')
check('worker and parent cleanup',lambda: eq([worker['timedOut'],worker['exitCode'],parent['cleanupConfirmed'],report['cleanupConfirmed'],report['officeOperationsStopped'],report['error'],report['lastStage']], [False,0,True,True,False,None,'worker.complete']))
for key in ['source','verifier','processHelper']:
    item=request[key]
    check(key+' external and snapshot hashes',lambda item=item: eq([sha(item['path']),sha(bound(item['snapshotPath'])),item['snapshotSha256']], [item['sha256']]*3))
plan=request['actionPlan']
check('plan snapshot',lambda: eq(sha(bound(plan['snapshotPath'])),plan['snapshotSha256']))
if plan['path']: check('external action plan and snapshot agree',lambda: eq([sha(plan['path']),plan['snapshotSha256']],[plan['sha256']]*2))
for label in ['saved','reopened']:
    item=report[label]
    check(label+' presentation hash',lambda item=item: eq(sha(bound(item['path'])),item['sha256']))
check('saved presentation unchanged on readonly reopen',lambda: eq(report['saved']['sha256'],report['reopened']['sha256']))

def stages():
    rows=[json.loads(s.lstrip('\ufeff')) for s in (run/'stages.jsonl').read_text(encoding='utf-8-sig').splitlines() if s.strip()]
    eq([s['sequence'] for s in rows],list(range(1,len(rows)+1)))
    pending=[]
    for s in rows:
        assert s['status']!='error',s
        if s['status']=='begin': pending.append(s['stage'])
        elif pending: eq(pending.pop(),s['stage'])
    eq(pending,[])
    eq(rows[-1]['stage'],'worker.complete')
    for name in ['edited.presentation.close','reopen.presentation.open','reopened.presentation.close']:
        eq(sum(s['stage']==name and s['status']=='success' for s in rows),1)
check('complete ordered per-call stage log',stages)

for phase,state in report['phases'].items():
    check(phase+' complete slide and raster inventory',lambda state=state: eq([[s['index'] for s in state['slides']], [r['slideIndex'] for r in state['rasters']]], [list(range(1,state['slideCount']+1))]*2))
    for raster in state['rasters']:
        check(f'{phase} slide {raster["slideIndex"]} raster',lambda r=raster: eq(sha(bound(r['path'])),r['sha256']))
check('edited and reopened rasters identical',lambda: eq([(r['slideIndex'],r['sha256']) for r in report['phases']['edited']['rasters']],[(r['slideIndex'],r['sha256']) for r in report['phases']['reopened']['rasters']]))

def normalized(slides):
    records=copy.deepcopy(slides)
    for slide in records:
        slide.pop('index',None)
        slide['tags']=sorted([(t['name'],t['value']) for t in slide['tags']])
        for shape in slide['shapes']:
            shape.pop('index',None)
            shape['tags']=sorted([(t['name'],t['value']) for t in shape['tags']])
    return records
def compare(expected,actual):
    if isinstance(expected,dict):
        eq(set(expected),set(actual))
        for key in expected:
            if key in ['left','top','width','height','rotation']:
                assert abs(expected[key]-actual[key])<=.02,(key,expected[key],actual[key])
            else: compare(expected[key],actual[key])
    elif isinstance(expected,list):
        eq(len(expected),len(actual))
        for a,b in zip(expected,actual): compare(a,b)
    else: eq(expected,actual)
original=normalized(report['phases']['original']['slides'])
edited=normalized(report['phases']['edited']['slides'])
reopened=normalized(report['phases']['reopened']['slides'])
check('native state survives save/reopen at 0.02pt',lambda: compare(edited,reopened))

def planned_edits():
    expected=copy.deepcopy(original)
    actions=read(plan['snapshotPath'])
    eq(actions,report['actionPlan']['actions'])
    eq(len(actions),len(report['actionPlan']['completed']))
    eq(report['actionPlan']['completed'],[{'index':i+1,'op':a['op'],'status':'success'} for i,a in enumerate(actions)])
    for action in actions:
        slide=expected[action['slideIndex']-1]
        op=action['op']
        if op=='move-slide': expected.insert(action['toIndex']-1,expected.pop(action['slideIndex']-1)); continue
        shape=None
        if 'shapeName' in action:
            matches=[s for s in slide['shapes'] if s['name']==action['shapeName']]
            eq(len(matches),1);shape=matches[0]
        if op=='set-text': shape['text']=action['text']
        elif op=='set-alt': shape['alternativeText']=action['alt']
        elif op=='delete-shape': slide['shapes'].remove(shape);slide['shapeCount']-=1
        elif op=='duplicate-shape':
            duplicate=copy.deepcopy(shape)
            observed=next(s for s in edited[action['slideIndex']-1]['shapes'] if s['name']==action['newName'])
            # Native Duplicate chooses a fresh id and offsets its placement.
            duplicate.update({k:observed[k] for k in ['id','left','top']})
            duplicate['name']=action['newName']
            position=next(i for i,s in enumerate(edited[action['slideIndex']-1]['shapes']) if s['name']==action['newName'])
            slide['shapes'].insert(position,duplicate);slide['shapeCount']+=1
        elif op in ['set-tag','delete-tag']:
            target=slide if action['target']=='slide' else shape
            target['tags']=[t for t in target['tags'] if t[0].upper()!=action['tagName'].upper()]
            if op=='set-tag':target['tags'].append((action['tagName'].upper(),action['tagValue'].upper()))
            target['tags'].sort()
        else: raise AssertionError(op)
    compare(expected,edited)
check('only planned native content edits occurred',planned_edits)

def archive(p):
    with zipfile.ZipFile(p) as z:
        eq(z.testzip(),None)
        for name in z.namelist():
            if name.endswith(('.xml','.rels')):ET.fromstring(z.read(name))
        assert not any(name.lower().endswith(('.fntdata','.odttf','.ttf','.otf','.woff','.woff2')) for name in z.namelist()),'Embedded font program found'
check('saved ZIP CRC and XML, no font program',lambda:archive(bound(report['saved']['path'])))
out={'passed':all(c['passed'] for c in checks),'scope':'Independent offline native observation/current-action persistence/ZIP XML checks. Semantic importer, physical font identity and cross-renderer pixel fidelity are separate. Duplicate id/placement are native choices.', 'verifierSha256':sha(__file__),'reportSha256':sha(run/'report.json'),'checks':checks}
target=run/(sys.argv[2] if len(sys.argv)>2 else 'independent-native-audit.json')
assert target.parent == run and target.suffix == '.json'
with target.open('x',encoding='utf-8') as f:json.dump(out,f,indent=2);f.write('\n')
print(json.dumps({'passed':out['passed'],'checks':len(checks),'failures':[c for c in checks if not c['passed']]}))
sys.exit(0 if out['passed'] else 1)
