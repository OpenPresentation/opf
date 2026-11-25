"""pic-placeholders: what makes Keynote 16.0 say "Unsupported media were removed. Slide Layout(s): Cover, Gallery,
Hero, Image, Image beside" for the five layouts that carry <p:ph type="pic" idx="500"/>.
Base: build/036/qualification/pptx/coverage-images.pptx (= experiments/fonttest/A-default-aptos.pptx, same sha).
(b) "placeholders removed" is experiments/fonttest/E-aptos-no-picture-placeholders.pptx (not rebuilt here; the row
points at it)."""
import re, sys
sys.path.insert(0, '/Users/michael/opf-work/keynote-036/experiments/_lib')
from xv import Group, W
import zipfile
SRC = f'{W}/build/036/qualification/pptx/coverage-images.pptx'
z = zipfile.ZipFile(SRC)
LAYOUTS = [n for n in z.namelist() if re.match(r'ppt/slideLayouts/slideLayout\d+\.xml$', n) and 'type="pic"' in z.read(n).decode()]
SLIDES = [n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n) and 'type="pic"' in z.read(n).decode()]
PH_SP = r'<p:sp>(?:(?!</p:sp>).)*?<p:ph type="pic"[^>]*/>(?:(?!</p:sp>).)*?</p:sp>'
g = Group('pic-placeholders')
LOOK = ('Warnings panel line "Unsupported media were removed. Slide Layout(s): ..." present or not (user interface, View > Show Warnings; '
        'import-notes.txt when captured); probe.json document slide layouts; pictures of slides on Cover/Image/Image beside/Gallery/Hero '
        '(coverage-images: no slide uses these five layouts; all 16 slides are on slideLayout40) unchanged against a')
g.control('a-exported', SRC, LOOK, f'as exported: layouts {", ".join(LAYOUTS)} carry <p:ph type="pic" idx="500"/>')
g.rows.append([f'{W}/experiments/fonttest/E-aptos-no-picture-placeholders.pptx', 'pic-placeholders', 'b-removed', SRC,
               'the five picture placeholders removed from the layouts (made earlier by experiments/fonttest/variant.py; referenced, not rebuilt)', LOOK, 'pic-placeholders/a-exported'])
g.variant('c1-body', SRC, {n: (lambda x: re.sub(PH_SP, lambda m: m.group(0).replace('<p:ph type="pic" idx="500"/>', '<p:ph type="body" idx="500"/>'), x, flags=re.S)) for n in LAYOUTS},
          'layout placeholder kept, type="pic" -> type="body" (slides still say type="pic" idx="500")', LOOK, 'pic-placeholders/a-exported')
g.variant('c2-no-type', SRC, {n: (lambda x: re.sub(PH_SP, lambda m: m.group(0).replace('<p:ph type="pic" idx="500"/>', '<p:ph idx="500"/>'), x, flags=re.S)) for n in LAYOUTS},
          'layout placeholder kept with no type (an "obj" content placeholder); slides unchanged', LOOK, 'pic-placeholders/a-exported')

def pp_form(sp):
    sp = re.sub(r'(<p:cNvPr id="\d+" name=")[^"]*"', r'\1Picture Placeholder"', sp)
    sp = sp.replace('</a:xfrm></p:spPr>', '</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>')
    sp = sp.replace('<a:p><a:endParaRPr lang="en-US"/></a:p>', '<a:p><a:r><a:rPr lang="en-US"/><a:t>Click icon to add picture</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>')
    return sp
g.variant('d-powerpoint-form', SRC, {n: (lambda x: re.sub(PH_SP, lambda m: pp_form(m.group(0)), x, flags=re.S)) for n in LAYOUTS},
          'no other valid element exists for a picture placeholder (PowerPoint also writes p:sp + p:ph type="pic"); this is the same p:sp written '
          'the way PowerPoint writes its own: name "Picture Placeholder", a:prstGeom rect, prompt text "Click icon to add picture"', LOOK, 'pic-placeholders/a-exported')
ORD = f'{W}/build/036/layouts/layouts-ordinary/default.pptx'
zo = zipfile.ZipFile(ORD)
OSLIDES = [n for n in zo.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n) and '<p:ph type="pic"' in zo.read(n).decode()]
LOOK2 = ('Warnings panel line "Unsupported media were removed" (user interface); the pictures on the slides listed in the manifest '
         '(same place and crop as e0?); probe.json slide layout and isDefaultBody/position of the picture items')
g.control('e0-ordinary-exported', ORD, LOOK2, 'layouts-ordinary default as exported: slides ' + ', '.join(OSLIDES) + ' put their picture in the layout placeholder (p:pic with <p:ph type="pic" idx="500"/>)')
g.variant('e1-ordinary-slides-unbound', ORD, {n: (lambda x: re.sub(r'<p:ph type="pic" idx="\d+"/>', '', x)) for n in OSLIDES},
          'layouts unchanged; each slide p:pic loses its <p:ph type="pic"/> (a free picture at the same box) on ' + ', '.join(OSLIDES), LOOK2, 'pic-placeholders/e0-ordinary-exported')
g.write()
print('layouts', LAYOUTS, 'ordinary slides with pic ph', OSLIDES)
