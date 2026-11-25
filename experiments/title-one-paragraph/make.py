"""title-one-paragraph (LY-01): 0.36.0 writes a wrapped title as one a:p per OPF line (trailing space on each but the
last), bodyPr wrap="none", noAutofit; Keynote (Helvetica Bold for Aptos) wraps a line again and the third line lands on
the content. Base: build/036/layouts/layouts-lots/default.pptx, every slide whose title placeholder holds 2+
paragraphs (slide 13 is the one the grader named)."""
import re, sys, zipfile
sys.path.insert(0, '/Users/michael/opf-work/keynote-036/experiments/_lib')
from xv import Group, W
SRC = f'{W}/build/036/layouts/layouts-lots/default.pptx'
TITLE = r'<p:sp>(?:(?!</p:sp>).)*?<p:ph type="(?:title|ctrTitle)"[^>]*/>.*?</p:sp>'
z = zipfile.ZipFile(SRC)
SLIDES = []
for n in sorted((n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n)), key=lambda n: int(re.search(r'\d+', n).group(0))):
    m = re.search(TITLE, z.read(n).decode(), re.S)
    if m and len(re.findall(r'<a:p>', m.group(0))) > 1: SLIDES.append(n)
NUMS = ', '.join(re.search(r'\d+', n).group(0) for n in SLIDES)

def merge(sp):
    paras = re.findall(r'<a:p>.*?</a:p>', sp, re.S)
    texts = [''.join(re.findall(r'<a:t>([^<]*)</a:t>', p)) for p in paras]
    for p in paras: assert len(re.findall(r'<a:r>', p)) == 1, 'one run per line expected'
    first = paras[0]
    joined = ''.join(texts)
    one = re.sub(r'<a:t>[^<]*</a:t>', lambda _: f'<a:t>{joined}</a:t>', first, count=1)
    body = sp[:sp.index(paras[0])] + one + sp[sp.index(paras[-1]) + len(paras[-1]):]
    return body

def title_edit(fn):
    return lambda x: re.sub(TITLE, lambda m: fn(m.group(0)), x, count=1, flags=re.S)

g = Group('title-one-paragraph')
LOOK = (f'slides {NUMS} (13 first): number of title lines and whether the last line overprints the content below; where Keynote breaks; '
        'probe.json default title item text/height; back.pptx title paragraphs and bodyPr wrap/autofit')
g.control('a-exported', SRC, LOOK, f'as exported: title placeholder with one a:p per measured line, wrap="none", noAutofit (slides {NUMS})')
g.variant('b1-one-paragraph-wrap-none', SRC, {n: title_edit(merge) for n in SLIDES},
          'title lines joined into one paragraph (first line\'s a:pPr and a:rPr, sz kept), wrap="none" kept', LOOK, 'title-one-paragraph/a-exported')
g.variant('b2-one-paragraph-wrap-square', SRC, {n: title_edit(lambda s: merge(s).replace('<a:bodyPr wrap="none" ', '<a:bodyPr wrap="square" ', 1)) for n in SLIDES},
          'title as one paragraph with bodyPr wrap="square" and no line breaks: Keynote wraps at the box width', LOOK, 'title-one-paragraph/a-exported')
g.variant('c-normautofit', SRC, {n: title_edit(lambda s: s.replace('<a:noAutofit/>', '<a:normAutofit/>', 1)) for n in SLIDES},
          'as exported (one paragraph per line, wrap none) with a:normAutofit in place of a:noAutofit', LOOK, 'title-one-paragraph/a-exported')
g.write()
print('slides', NUMS)
