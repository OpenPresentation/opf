import zipfile, re, sys, glob, os, json
inst = set(l.strip().lower() for l in open(sys.argv[2]))
res={}
for f in sorted(glob.glob(sys.argv[1] + '/*.pptx')):
    z = zipfile.ZipFile(f); used=set()
    for n in z.namelist():
        if re.match(r'ppt/(slides/slide|charts/chart|diagrams/|slideLayouts/|slideMasters/)', n) and n.endswith('.xml'):
            used |= set(re.findall(r'<a:(?:latin|ea|cs) typeface="([^"+][^"]*)"', z.read(n).decode('utf8','replace')))
    th = z.read('ppt/theme/theme1.xml').decode()
    maj = re.search(r'<a:majorFont><a:latin typeface="([^"]*)"', th); mnr = re.search(r'<a:minorFont><a:latin typeface="([^"]*)"', th)
    for m in (maj, mnr):
        if m: used.add(m.group(1))
    miss = sorted(x for x in used if x.lower() not in inst)
    res[os.path.basename(f)] = miss
    print(f"{os.path.basename(f):40s} {', '.join(miss) or '-'}")
json.dump(res, open(sys.argv[3],'w'), indent=1, ensure_ascii=False)
