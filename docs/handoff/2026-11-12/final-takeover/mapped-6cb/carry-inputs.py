import json,pathlib,hashlib,subprocess
root=pathlib.Path('/tmp/opf-034');out=pathlib.Path('/tmp/opf-final-coherent-qualification04')
r=json.loads((out/'receipt.json').read_text());assert r['code']==0 and r['sourceUnchanged'] and r['runtimeUnchanged']
b=json.loads((root/'artifacts/owner-post-arabic-build-01/build-receipt.json').read_text());a=json.loads((root/'artifacts/owner-post-arabic-assets-01/asset-receipt.json').read_text())
rows=b['inputs']+b['compiler']+b['binding']['manifestsAndDrivers']+a['inputs']+a['outputs']
assert len(rows)==1609
for v in rows:
 data=(root/v['path']).read_bytes();assert len(data)==v['bytes'] and hashlib.sha256(data).hexdigest()==v['sha256'],v['path']
prior=json.loads(pathlib.Path('/tmp/opf-final-coherent-qualification02/runtime-after.json').read_text());current=json.loads((out/'runtime-after.json').read_text());assert current==prior and len(current)==609
proof={'measuredSource':b['source'],'currentSource':r['sourceAfter']['head'],'actualFileRecordsCompared':len(rows),'allActualInputsAndAssetsUnchanged':True,'bundleInputs':len(b['inputs']),'compiledFiles':len(current),'compiledUnchangedThroughMappedBuild':True,'scope':'Input equality only; original W06 receipts remain on measured0fe. No rerender, revised guard, current-head performance measurement or version/device comparison claimed.'}
(out/'w06-input-equality.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
