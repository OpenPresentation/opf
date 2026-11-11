from pathlib import Path
import json,subprocess,hashlib,xml.etree.ElementTree as ET
root=Path('/tmp/opf-schema-review');out=Path('/tmp/opf-schema-nine-audit-4e');oldref='5b9e4386c00319da1fa4370dcc0b3eb6e93c9578';newref='4e03508b64e3e83e9bbdc33b2e4cd597b8a22985'
def gitjson(ref,p):return json.loads(subprocess.check_output(['git','show',ref+':'+p],cwd=root))
def canonical(v):
 if isinstance(v,dict):return '{'+','.join(json.dumps(k,ensure_ascii=False)+':'+canonical(v[k]) for k in sorted(v))+'}'
 if isinstance(v,list):return '['+','.join(map(canonical,v))+']'
 if isinstance(v,float) and v.is_integer():v=int(v)
 return json.dumps(v,ensure_ascii=False,separators=(',',':'))
def fnv(v):
 h=0xcbf29ce484222325
 for b in canonical(v).encode():h=((h^b)*0x100000001b3)&0xffffffffffffffff
 return format(h,'016x')
def record(p):return json.loads(bytes.fromhex(ET.fromstring(p.read_bytes())[0].attrib['val']))
def diff(a,b,p=''):
 if isinstance(a,dict) and isinstance(b,dict):return sum([diff(a.get(k,'<absent>'),b.get(k,'<absent>'),p+'.'+k) for k in sorted(set(a)|set(b))],[])
 if a!=b:return [{'path':p,'old':a,'new':b}]
 return []
rows=[]
for n in [1,2,5,6]:
 before=record(out/f'treemap-category__before__ppt__tags__opfLayout{n}.xml');after=record(out/f'treemap-category__after__ppt__tags__opfLayout{n}.xml');ident=before['reference'];assert after['reference']==ident;p=f'packages/gallery/catalog/layouts/{ident}.json';a={k:v for k,v in gitjson(oldref,p).items() if k not in ['$schema','id'] and not k.startswith('x-')};b={k:v for k,v in gitjson(newref,p).items() if k not in ['$schema','id'] and not k.startswith('x-')};ah=fnv(a);bh=fnv(b);assert ah==before['hash'] and bh==after['hash'];d=diff(a,b);project=json.loads(json.dumps(a));
 for key in ['titleAlignment','contentAlignment']:project['design'][key]={'left':'start','right':'end'}.get(project['design'][key],project['design'][key])
 assert project==b
 rows.append({'part':f'ppt/tags/opfLayout{n}.xml','record':p,'oldHash':ah,'currentHash':bh,'oldCanonicalSha256':hashlib.sha256(canonical(a).encode()).hexdigest(),'currentCanonicalSha256':hashlib.sha256(canonical(b).encode()).hexdigest(),'sourceDeltas':d,'onlyApprovedDesignAlignmentRenames':True})
r={'algorithm':'independently implemented UTF8 FNV1a64 over recursively sorted-key JSON, matching maintained recordHash definition; embeddedCopy excludes only root $schema/id/x-* per Gallery builder','oldProducer':oldref,'currentProducer':newref,'rows':rows,'noExport':True};(out/'layout-hash-cause.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
