"""graders: the remaining XML experiments of grades/experiments.md that no other group covers
(SW-01, SW-02, MX-08, LG-01, LG-04, LY-02, LY-06). The others: LG-02 -> rtl-table, MX-01 -> flush-space,
MX-02 -> plot-area, MX-03 -> one-series-highlight, MX-04 -> tick-skip, MX-05 -> label-separator, MX-06 -> rtl-explicit,
MX-07 -> legend-frame, LY-01 -> title-one-paragraph, LY-03 -> legend-frame, LY-04 -> alt-text, LY-05 -> x-min/LY-05*."""
import re, sys, zipfile
sys.path.insert(0, '/Users/michael/opf-work/keynote-036/experiments/_lib')
from xv import Group, W
g = Group('graders')
B = f'{W}/build/036'

# SW-01: sweep-tables default slides 7, 12, 13: header row typeface Arial; slides 12, 13: grid 10% wider, aside narrowed
ST = f'{B}/matrix/sweep-tables/default.pptx'
def header_arial(x):
    def tbl(m):
        t = m.group(0)
        tr = re.search(r'<a:tr .*?</a:tr>', t, re.S)
        row = re.sub(r'<a:latin typeface="\+mn-lt"', '<a:latin typeface="Arial"', tr.group(0))
        assert row != tr.group(0)
        return t[:tr.start()] + row + t[tr.end():]
    return re.sub(r'<a:tbl>.*?</a:tbl>', tbl, x, flags=re.S)
def widen(x):
    fr = re.search(r'<p:graphicFrame>(?:(?!</p:graphicFrame>).)*?<a:tbl>.*?</p:graphicFrame>', x, re.S)
    f = fr.group(0)
    off = re.search(r'<p:xfrm><a:off x="(\d+)" y="\d+"/><a:ext cx="(\d+)"', f)
    x0, cx = int(off.group(1)), int(off.group(2))
    cols = [int(w) for w in re.findall(r'<a:gridCol w="(\d+)"/>', f)]
    new = [round(w * 1.1) for w in cols]; grow = sum(new) - sum(cols)
    it = iter(new)
    f2 = re.sub(r'<a:gridCol w="\d+"/>', lambda _: f'<a:gridCol w="{next(it)}"/>', f)
    f2 = f2.replace(f'<a:ext cx="{cx}"', f'<a:ext cx="{cx + grow}"', 1)
    x = x[:fr.start()] + f2 + x[fr.end():]
    right = x0 + cx
    def aside(m):
        s = m.group(0)
        o = re.search(r'<a:off x="(\d+)" y="(\d+)"/><a:ext cx="(\d+)"', s)
        if not o or int(o.group(1)) < right: return s
        ax, acx = int(o.group(1)), int(o.group(3))
        return s.replace(o.group(0), f'<a:off x="{ax + grow}" y="{o.group(2)}"/><a:ext cx="{acx - grow}"', 1)
    return re.sub(r'<p:sp>.*?</p:sp>', aside, x, flags=re.S)
LOOK = 'sweep-tables slides 7, 12, 13: header words "Team", "Participants", "Completion" whole on one line (a: "Tea|m", "Participant|s", "Completio|n")'
g.control('SW-01-a-exported', ST, LOOK, 'sweep-tables default as exported')
g.variant('SW-01-b-header-arial', ST, {f'ppt/slides/slide{i}.xml': header_arial for i in (7, 12, 13)}, 'header row runs: a:latin +mn-lt -> Arial (body rows unchanged)', LOOK, 'graders/SW-01-a-exported')
g.variant('SW-01-c-grid-wider', ST, {f'ppt/slides/slide{i}.xml': widen for i in (12, 13)}, 'slides 12, 13: every a:gridCol +10%, frame cx grown by the same, the aside shapes right of the table moved right and narrowed by it (wrap="none" lines: no rewrap)', LOOK, 'graders/SW-01-a-exported')

# SW-02: sweep-tables native slide 11: body placeholder idx 300 moved up to the default file's y
SN = f'{B}/matrix/sweep-tables/native.pptx'
def note_up(x):
    m = re.search(r'(<p:sp>(?:(?!</p:sp>).)*?<p:ph [^>]*idx="300"[^>]*/>.*?<a:off x="\d+" y=")5449443(")', x, re.S)
    assert m
    return x[:m.start()] + m.group(1) + '4527995' + m.group(2) + x[m.end():]
LOOK = 'sweep-tables native slide 11: the note right under the table as in the preview (a: ~97 px of 720 lower, at the foot)'
g.control('SW-02-a-native-exported', SN, LOOK, 'sweep-tables native as exported: body placeholder idx 300 at y 5449443')
g.variant('SW-02-b-native-note-at-core-box', SN, {'ppt/slides/slide11.xml': note_up}, 'slide 11: body placeholder idx 300 a:off y 5449443 -> 4527995 (the default file\'s y), cy and anchor kept', LOOK, 'graders/SW-02-a-native-exported')

# MX-08: m-text-flush default slide 5: gridCol 1 +10% taken from column 2
TF = f'{B}/matrix/m-text-flush/default.pptx'
def col1(x):
    def tbl(m):
        t = m.group(0)
        cols = [int(w) for w in re.findall(r'<a:gridCol w="(\d+)"/>', t)]
        d = round(cols[0] * 0.1); cols[0] += d; cols[1] -= d
        it = iter(cols)
        return re.sub(r'<a:gridCol w="\d+"/>', lambda _: f'<a:gridCol w="{next(it)}"/>', t)
    return re.sub(r'<a:tblGrid>.*?</a:tblGrid>', tbl, x, count=1, flags=re.S)
LOOK = 'm-text-flush slide 5: table header "Terminal" on one line (a: "Termina" / "l")'
g.control('MX-08-a-exported', TF, LOOK, 'm-text-flush default as exported')
g.variant('MX-08-b-col1-wider', TF, {'ppt/slides/slide5.xml': col1}, 'slide 5: first a:gridCol +10%, the second narrower by the same (table width unchanged)', LOOK, 'graders/MX-08-a-exported')

# LG-01: lang-other default slide 1 (am): theme Ethi font Ebrima -> Kefa III
LO = f'{B}/languages/lang-other/default.pptx'
LOOK = 'lang-other slide 1 (am): Amharic first column still runs into the "Latin line" block? (a: 20 pt overlap); missing-fonts list without Ebrima'
g.control('LG-01-a-exported', LO, LOOK, 'lang-other default as exported (theme Ethi = Ebrima)')
g.variant('LG-01-b-ethi-kefa', LO, {'ppt/theme/theme1.xml': lambda x: x.replace('<a:font script="Ethi" typeface="Ebrima"/>', '<a:font script="Ethi" typeface="Kefa III"/>')},
          'theme1 a:font script="Ethi" Ebrima -> Kefa III (major and minor); no run names Ebrima (Kefa III is installed here)', LOOK, 'graders/LG-01-a-exported')

# LG-04: lang-cjk native slide 4 (ko): altLang on the Korean runs; eaLnBrk="0" on the paragraphs
CJ = f'{B}/languages/lang-cjk/native.pptx'
def korean(fn):
    def edit(x):
        return re.sub(r'<p:sp>.*?</p:sp>', lambda m: fn(m.group(0)) if re.search('[가-힣]', m.group(0)) and 'OPF native body' in m.group(0) else m.group(0), x, flags=re.S)
    return edit
alt = lambda s: re.sub(r'<a:rPr lang="ko-KR"(?! altLang)', '<a:rPr lang="ko-KR" altLang="en-US"', s)
eabrk = lambda s: re.sub(r'<a:pPr ', '<a:pPr eaLnBrk="0" ', s)
LOOK = 'lang-cjk native slide 4 (ko): Keynote wraps inside a word ("권/리에") or at spaces as the preview; back.pptx lang kept?'
g.control('LG-04-a-native-exported', CJ, LOOK, 'lang-cjk native as exported (runs lang="ko-KR", no altLang)')
g.variant('LG-04-b-altlang', CJ, {'ppt/slides/slide4.xml': korean(alt)}, 'slide 4 Korean native bodies: altLang="en-US" on every a:rPr lang="ko-KR"', LOOK, 'graders/LG-04-a-native-exported')
g.variant('LG-04-c-ealnbrk0', CJ, {'ppt/slides/slide4.xml': korean(eabrk)}, 'slide 4 Korean native bodies: eaLnBrk="0" on every a:pPr (East Asian line breaking off: break at spaces)', LOOK, 'graders/LG-04-a-native-exported')

# LY-02: layouts-lots default slide 12: the first column's seven line boxes as one wrapped box
LL = f'{B}/layouts/layouts-lots/default.pptx'
def one_box(x):
    sps = [m for m in re.finditer(r'<p:sp>.*?</p:sp>', x, re.S) if 'name="OPF text slides.11.blocks.0.text line' in m.group(0)]
    assert len(sps) == 7
    first = sps[0].group(0)
    paras = [re.search(r'<a:p>.*?</a:p>', m.group(0), re.S).group(0) for m in sps]
    runs = lambda p: ''.join(re.findall(r'<a:r>.*?</a:r>', p, re.S))
    body_p = re.sub(r'(<a:pPr[^>]*?(?:/>|>.*?</a:pPr>))(.*?)(<a:endParaRPr|</a:p>)', lambda q: q.group(1) + ''.join(runs(p) for p in paras[1:]) + q.group(3), paras[1], count=1, flags=re.S)
    off = re.search(r'<a:off x="(\d+)" y="(\d+)"/><a:ext cx="(\d+)" cy="(\d+)"/>', first)
    last = re.search(r'<a:off x="\d+" y="(\d+)"/><a:ext cx="\d+" cy="(\d+)"/>', sps[-1].group(0))
    h = int(last.group(1)) + int(last.group(2)) - int(off.group(2))
    new = first.replace(off.group(0), f'<a:off x="{off.group(1)}" y="{off.group(2)}"/><a:ext cx="{off.group(3)}" cy="{h}"/>', 1)
    new = new.replace('<a:bodyPr wrap="none" ', '<a:bodyPr wrap="square" ', 1)
    new = new.replace(paras[0], paras[0] + body_p, 1)
    out = x[:sps[0].start()] + new + x[sps[0].end():sps[1].start()]
    for a, b in zip(sps[1:], sps[2:] + [None]):
        out += x[a.end():b.start()] if b else ''
    return out + x[sps[-1].end():]
LOOK = 'layouts-lots slide 12: left column no longer touches the right column ("Monday;" / "Every", "before the" / "managers"); compare native.pptx slide 12'
g.control('LY-02-a-exported', LL, LOOK, 'layouts-lots default as exported: seven wrap="none" line boxes in the first column')
g.variant('LY-02-b-first-column-one-box', LL, {'ppt/slides/slide12.xml': one_box}, 'slide 12: the first column\'s seven line boxes replaced by one box (first line\'s shape, column width 5490210, height to the last line\'s foot, wrap="square"): paragraph 1 = "Option A: focused pilot", paragraph 2 = lines 2-7 joined (runs kept)', LOOK, 'graders/LY-02-a-exported; build/036/layouts/layouts-lots/native.pptx slide 12')

# LY-06: layouts-ordinary default slide 2: the slide's p:bg removed (its clrMapOvr maps bg1 to accent1); second variant also the layout's bg accent1
LO2 = f'{B}/layouts/layouts-ordinary/default.pptx'
nobg = lambda x: re.sub(r'<p:bg>.*?</p:bg>', '', x, count=1, flags=re.S)
LOOK = 'layouts-ordinary slide 2: background still accent1 blue; probe.json slide layout name ("Section" or "Section 0"); back.pptx layout count (a: 43 for 39)'
g.control('LY-06-a-exported', LO2, LOOK, 'layouts-ordinary default as exported: slide 2 p:bg accent1 on layout Section (slideLayout3, bg bg1), clrMapOvr bg1=accent1')
g.variant('LY-06-b-no-slide-bg', LO2, {'ppt/slides/slide2.xml': nobg}, 'slide 2: p:bg removed (the layout bg is schemeClr bg1, which the slide\'s clrMapOvr maps to accent1)', LOOK, 'graders/LY-06-a-exported')
g.variant('LY-06-c-bg-on-layout', LO2, {'ppt/slides/slide2.xml': nobg, 'ppt/slideLayouts/slideLayout3.xml': lambda x: x.replace('<p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/>', '<p:bg><p:bgPr><a:solidFill><a:schemeClr val="accent1"/>', 1)},
          'b plus the Section layout\'s own bg accent1 (slideLayout3 is used by slide 2 only)', LOOK, 'graders/LY-06-a-exported')
g.write()
