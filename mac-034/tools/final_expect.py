"""Read what each PPTX of a corpus says: theme fonts, per slide its layout name, the title placeholder's paragraphs and the fonts
its runs name (+mj-lt / +mn-lt / a face), notes page size, docProps title/description, and layout names.

usage: python3 final_expect.py <corpus-dir>   (writes <dir>/pptx-expect.json)
"""
import glob
import json
import os
import re
import sys
import zipfile
from html import unescape

root = sys.argv[1]
out = {}
for path in sorted(glob.glob(os.path.join(root, 'pptx', '*.pptx'))):
    z = zipfile.ZipFile(path)
    names = set(z.namelist())
    read = lambda n: z.read(n).decode('utf-8') if n in names else ''
    theme = read('ppt/theme/theme1.xml')
    major = re.search(r'<a:majorFont><a:latin typeface="([^"]*)"', theme)
    minor = re.search(r'<a:minorFont><a:latin typeface="([^"]*)"', theme)
    pres = read('ppt/presentation.xml')
    notes = re.search(r'<p:notesSz cx="(\d+)" cy="(\d+)"', pres)
    sld = re.search(r'<p:sldSz cx="(\d+)" cy="(\d+)"', pres)
    core = read('docProps/core.xml')
    props = {k: unescape(m.group(1)) for k in ('title', 'description', 'subject', 'creator') if (m := re.search(rf'<dc:{k}>([^<]*)</dc:{k}>', core))}
    layouts = {}
    for n in names:
        m = re.match(r'ppt/slideLayouts/(slideLayout\d+\.xml)$', n)
        if m:
            layouts[m.group(1)] = unescape(re.search(r'<p:cSld(?: name="([^"]*)")?', read(n)).group(1) or '')
    slides = []
    nums = sorted(int(m.group(1)) for n in names if (m := re.match(r'ppt/slides/slide(\d+)\.xml$', n)))
    for i in nums:
        xml = read(f'ppt/slides/slide{i}.xml')
        rels = read(f'ppt/slides/_rels/slide{i}.xml.rels')
        lay = re.search(r'Target="\.\./slideLayouts/(slideLayout\d+\.xml)"', rels)
        title = None
        for sp in re.findall(r'<p:sp>.*?</p:sp>', xml, re.S):
            if re.search(r'<p:ph type="(?:title|ctrTitle)"', sp):
                paras = [''.join(unescape(t) for t in re.findall(r'<a:t>([^<]*)</a:t>', p)) for p in re.findall(r'<a:p>.*?</a:p>', sp, re.S)]
                fonts = sorted(set(re.findall(r'<a:latin typeface="([^"]*)"', sp)))
                size = sorted(set(re.findall(r'<a:rPr[^>]*\bsz="(\d+)"', sp)))
                spc = sorted(set(re.findall(r'<a:rPr[^>]*\bspc="(-?\d+)"', sp)))
                title = {'paragraphs': paras, 'fonts': fonts, 'sizes': size, 'spc': spc}
                break
        theme_refs = sorted(set(re.findall(r'typeface="(\+m[jn]-[a-z]+)"', xml)))
        slides.append({'n': i, 'layout': layouts.get(lay.group(1)) if lay else None, 'title': title, 'themeRefs': theme_refs})
    out[os.path.basename(path)[:-5]] = {
        'major': major.group(1) if major else None, 'minor': minor.group(1) if minor else None,
        'slideSize': sld.groups() if sld else None, 'notesSize': notes.groups() if notes else None,
        'props': props, 'layoutNames': sorted(set(layouts.values())), 'slides': slides,
    }
json.dump(out, open(os.path.join(root, 'pptx-expect.json'), 'w'), indent=1, ensure_ascii=False)
print(len(out), 'files')
