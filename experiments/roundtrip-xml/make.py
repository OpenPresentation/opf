"""roundtrip-xml: the round-trip grader's Keynote-side XML experiments RT-06, RT-07, RT-08 (grades/experiments.md).
RT-01 B is in one-series-highlight (e-...), RT-03 in alt-text (RT-03-*), RT-02 in x-min/LY-05*, RT-04 needs no Keynote."""
import re, sys
sys.path.insert(0, '/Users/michael/opf-work/keynote-036/experiments/_lib')
from xv import Group, W
g = Group('roundtrip-xml')
B = f'{W}/build/036'
# RT-06: title size 4875 -> 4800 / 4900 on layouts-ordinary slide 1; m-agenda slide 2 title wrap square
LO = f'{B}/layouts/layouts-ordinary/default.pptx'
def title_sz(v):
    def fn(x):
        def sp(m):
            s = m.group(0)
            return s.replace('sz="4875"', f'sz="{v}"') if 'name="OPF heading slides.0.title' in s else s
        y = re.sub(r'<p:sp>.*?</p:sp>', sp, x, flags=re.S)
        return y
    return fn
L6 = 'layouts-ordinary slide 1: probe.json title font size (48.75 written; what Keynote reads), title lines in the picture; back.pptx sz'
g.control('RT-06-a-exported', LO, L6, 'layouts-ordinary default as exported: cover title sz 4875')
g.variant('RT-06-b-sz4800', LO, {'ppt/slides/slide1.xml': title_sz(4800)}, 'slide 1 cover title: every sz="4875" -> 4800', L6, 'roundtrip-xml/RT-06-a-exported')
g.variant('RT-06-c-sz4900', LO, {'ppt/slides/slide1.xml': title_sz(4900)}, 'slide 1 cover title: every sz="4875" -> 4900', L6, 'roundtrip-xml/RT-06-a-exported')
MA = f'{B}/matrix/m-agenda/default.pptx'
def wrap_sq(x):
    def sp(m):
        s = m.group(0)
        return s.replace('<a:bodyPr wrap="none" ', '<a:bodyPr wrap="square" ', 1) if 'name="OPF heading slides.1.title' in s else s
    return re.sub(r'<p:sp>.*?</p:sp>', sp, x, flags=re.S)
L6b = 'm-agenda slide 2: does Keynote still shrink the title (back.pptx defRPr sz, probe size)?'
g.control('RT-06-d-agenda-exported', MA, L6b, 'm-agenda default as exported: slide 2 title wrap="none"')
g.variant('RT-06-e-agenda-title-wrap-square', MA, {'ppt/slides/slide2.xml': wrap_sq}, 'slide 2 title shape(s) bodyPr wrap="none" -> "square"', L6b, 'roundtrip-xml/RT-06-d-agenda-exported')
# RT-07: lang-rtl slide 2: the "0123456789" line boxes with a leading RLM (U+200F)
LR = f'{B}/languages/lang-rtl/default.pptx'
L7 = 'lang-rtl slide 2: the digit lines placed as in the preview; back.pptx a:pPr rtl="1" kept on those lines?'
g.control('RT-07-a-exported', LR, L7, 'lang-rtl default as exported: digit line boxes a:pPr rtl="1", text "0123456789"')
g.variant('RT-07-b-rlm', LR, {'ppt/slides/slide2.xml': lambda x: x.replace('<a:t>0123456789</a:t>', '<a:t>\u200f0123456789</a:t>')}, 'slide 2: U+200F RIGHT-TO-LEFT MARK before "0123456789" in both digit line boxes', L7, 'roundtrip-xml/RT-07-a-exported')
# RT-08: sweep-tables slide 4: the right column as plain numbers, algn r kept
STB = f'{B}/matrix/sweep-tables/default.pptx'
L8 = 'sweep-tables slide 4: probe.json table cells: value a number for the right column? back.pptx keeps algn="r"?'
g.control('RT-08-a-exported', STB, L8, 'sweep-tables default as exported: slide 4 right column "89%", "79%" (algn r)')
g.variant('RT-08-b-plain-numbers', STB, {'ppt/slides/slide4.xml': lambda x: x.replace('<a:t>89%</a:t>', '<a:t>89</a:t>').replace('<a:t>79%</a:t>', '<a:t>79</a:t>')}, 'slide 4, both tables: right column "89%" -> "89", "79%" -> "79" (algn="r" unchanged)', L8, 'roundtrip-xml/RT-08-a-exported')
g.write()
