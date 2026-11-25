"""flush-space (MX-01): 0.36.0 shifts each right/center/end-aligned line box by the line's hanging (trailing) space and
keeps the space in the run; Keynote does not hang the space, so the lines end a space off. Which form is flush in
Keynote? Bases: m-text-flush and m-text-flush-rtl default exports (0.36.0); geometry for (b) from the 0.35.1 exports.
Edited: every shape whose a:xfrm or a:pPr differs between 0.36.0 and 0.35.1 (m-text-flush slides 1, 3, 4, 6;
m-text-flush-rtl: printed when run). Slide 1's heading is one shape with a paragraph per line (marR on the shifted line)."""
import re, sys, zipfile
sys.path.insert(0, '/Users/michael/opf-work/keynote-036/experiments/_lib')
from xv import Group, W
g = Group('flush-space')
SP = r'<p:sp>.*?</p:sp>'
END = r'(?:<a:endParaRPr[^>]*/>|<a:endParaRPr[^>]*>(?:(?!</a:p>).)*?</a:endParaRPr>)?</a:p>'
TRAIL = r' </a:t></a:r>(' + END + ')'

def shapes(x):
    return {re.search(r'name="([^"]*)"', m.group(0)).group(1): m for m in re.finditer(SP, x, re.S)}

def plan(src, old):
    a, b = zipfile.ZipFile(src), zipfile.ZipFile(old)
    out = {}
    for n in a.namelist():
        if not re.match(r'ppt/slides/slide\d+\.xml$', n): continue
        A, B = shapes(a.read(n).decode()), shapes(b.read(n).decode())
        norm = lambda t: re.sub(r' marR="\d+"', '', re.sub(r'<a:off x="\d+"', '<a:off', t)).replace(' marL="0" indent="0"', ' indent="0" marL="0"')
        # only the hanging-space shift: x of a:off and marR differ, nothing else (rtl slide 2 moved down in 0.36.0: not this)
        names = [k for k in A if k in B and A[k].group(0) != B[k].group(0) and norm(A[k].group(0)) == norm(B[k].group(0))]
        if names: out[n] = (names, {k: B[k].group(0) for k in names})
    return out

def edit_for(names, old, mode):
    def fn(x):
        def one(m):
            s = m.group(0)
            k = re.search(r'name="([^"]*)"', s).group(1)
            if k not in names: return s
            if mode in ('b', 'b2'):
                s2 = re.sub(TRAIL, r'</a:t></a:r>\1', s, flags=re.S)
                if mode == 'b':
                    o = old[k]
                    s2 = s2.replace(re.search(r'<a:xfrm>.*?</a:xfrm>', s2, re.S).group(0), re.search(r'<a:xfrm>.*?</a:xfrm>', o, re.S).group(0))
                    pa, pb = re.findall(r'<a:pPr[^>]*>', s2), re.findall(r'<a:pPr[^>]*>', o)
                    assert len(pa) == len(pb)
                    it = iter(pb)
                    s2 = re.sub(r'<a:pPr[^>]*>', lambda _: next(it), s2)
                return s2
            if mode == 'c':
                return re.sub(r'<a:r>(<a:rPr[^>]*/>|<a:rPr[^>]*>.*?</a:rPr>)<a:t>([^<]*?) </a:t></a:r>(' + END + ')',
                              lambda q: f'<a:r>{q.group(1)}<a:t>{q.group(2)}</a:t></a:r><a:r>{q.group(1)}<a:t> </a:t></a:r>{q.group(3)}', s, flags=re.S)
        return re.sub(SP, one, x, flags=re.S)
    return fn

for deck, slides_note in [('m-text-flush', 'slides 1 (heading), 3 (right), 4 (center), 6 (caption)'), ('m-text-flush-rtl', 'slides 4-7 (rtl: centered, end-aligned)')]:
    src = f'{W}/build/036/matrix/{deck}/default.pptx'
    old = f'{W}/build/0351/matrix/{deck}/default.pptx'
    p = plan(src, old)
    print(deck, {n: len(v[0]) for n, v in p.items()})
    sl = ', '.join(re.search(r'\d+', n).group(0) for n in sorted(p, key=lambda n: int(re.search(r'\d+', n).group(0))))
    LOOK = (f'slides {sl}: x of the line ends (right), line centers (center) or line starts (rtl end-aligned) in Keynote slide pictures, '
            'measured at 1280 px as in grades/matrix-m/REPORT.md MX-01; all lines of a paragraph should share one edge as in the preview')
    ctl = g.control(f'{deck}-a-exported', src, LOOK, f'0.36.0 as exported: shifted line boxes, trailing space in the run ({sl})')
    trailing = lambda fn: (lambda x: fn(x))
    def ed(mode):
        return {n: edit_for(v[0], v[1], mode) for n, v in p.items()}
    g.variant(f'{deck}-b-nospace-0351-box', src, ed('b'),
              f'each changed shape: trailing space removed from the run text, a:xfrm and a:pPr (incl. marR) restored to 0.35.1 ({sl})', LOOK, f'flush-space/{deck}-a-exported; Keynote 0.35.1 output keynote/0351/matrix/{deck}~default')
    g.variant(f'{deck}-b2-nospace-036-box', src, ed('b2'),
              f'trailing space removed, 0.36.0 shifted box kept ({sl}): isolates the shift', LOOK, f'flush-space/{deck}-a-exported')
    g.variant(f'{deck}-c-space-own-run', src, ed('c'),
              f'trailing space kept as a separate run (same a:rPr), 0.36.0 box kept ({sl})', LOOK, f'flush-space/{deck}-a-exported')
g.write()
