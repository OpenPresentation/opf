"""Compare the fonts Keynote reports (kn-probe2 _probe2.tsv) for the same files in two passes.
usage: python3 fontcmp.py <old-corpus> <new-corpus> <out.json>   (prints one line per file)"""
import glob, json, os, sys
old, new, out = sys.argv[1:4]
def load(d, name):
    p = os.path.join(d, 'keynote', name, '_probe2.tsv')
    if not os.path.exists(p): return None
    rows = {}
    for line in open(p, encoding='utf-8', errors='replace'):
        f = line.rstrip('\n').split('\t')
        if f[0] == 'slide' and len(f) >= 9:
            rows[int(f[1])] = {'titleFont': f[5], 'titleSize': f[6], 'fonts': sorted(x for x in f[8].split(',') if x)}
    return rows
res = {}
for d in sorted(glob.glob(os.path.join(old, 'keynote', '*', '_probe2.tsv'))):
    name = os.path.basename(os.path.dirname(d))
    a, b = load(old, name), load(new, name)
    if b is None:
        res[name] = {'status': 'no new probe'}; print(f'{name:40s} no new probe'); continue
    diffs = []
    for n in sorted(set(a) | set(b)):
        x, y = a.get(n), b.get(n)
        if x is None or y is None:
            diffs.append({'slide': n, 'old': x, 'new': y}); continue
        if x['fonts'] != y['fonts'] or x['titleFont'] != y['titleFont'] or x['titleSize'] != y['titleSize']:
            diffs.append({'slide': n, 'old': x, 'new': y})
    allfonts = lambda r: sorted({f for s in r.values() for f in s['fonts']} | {s['titleFont'] for s in r.values() if s['titleFont']})
    res[name] = {'slidesOld': len(a), 'slidesNew': len(b), 'fontsOld': allfonts(a), 'fontsNew': allfonts(b), 'differences': diffs}
    print(f"{name:40s} slides {len(a)}/{len(b)}  differing slides {len(diffs)}  fonts {','.join(allfonts(b))}")
json.dump(res, open(out, 'w'), indent=1, ensure_ascii=False)
