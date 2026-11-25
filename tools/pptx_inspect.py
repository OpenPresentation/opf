#!/usr/bin/env python3
"""What a .pptx says, per slide, read with plain zipfile + xml.etree (works on OPF's exports and on Keynote's back.pptx).

  pptx_inspect.py <file.pptx> [--out file.json]       full JSON (stdout when no --out)
  pptx_inspect.py --diff a.pptx b.pptx [--out d.json]  per slide: what changed in kinds/counts, texts, fonts, links, notes, ...
  pptx_inspect.py --summary <file.pptx>                one line per slide (kinds and counts)

Per slide: layout name; placeholders (type, idx, has text); every shape-tree element in order with kind (sp, pic,
graphicFrame table / chart / other, cxnSp, grpSp, nested), name, descr, geometry (EMU and slide fractions), preset shape, fill and
line summary, text paragraphs (first 80 characters, alignment, rtl, bullet buAutoNum/buChar/buNone, run fonts latin/ea/cs, size,
lang, spc), hyperlinks on runs and shapes (target or slide jump), picture crop (srcRect), connector stCxn/endCxn, charts (chart
type elements, series names, secondary axis, legend, data labels, embedded workbook, cx: parts), tables (rows, columns,
firstRow/bandRow, merges), notes text, footer / slide number / date placeholders and fields (a:fld), transition and timing.
Document: slide size, theme fonts (major/minor latin/ea/cs and per-script list), all font names used, hidden slides
(show="0"), slide layouts' names.
"""
import json
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'c': 'http://schemas.openxmlformats.org/drawingml/2006/chart',
    'rel': 'http://schemas.openxmlformats.org/package/2006/relationships',
    'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    'cx': 'http://schemas.microsoft.com/office/drawing/2014/chartex',
    'p14': 'http://schemas.microsoft.com/office/powerpoint/2010/main',
}
A = '{%s}' % NS['a']
P = '{%s}' % NS['p']
R = '{%s}' % NS['r']
C = '{%s}' % NS['c']
CHART_URI = 'http://schemas.openxmlformats.org/drawingml/2006/chart'
TABLE_URI = 'http://schemas.openxmlformats.org/drawingml/2006/table'
CX_URI = 'http://schemas.microsoft.com/office/drawing/2014/chartex'
DGM_URI = 'http://schemas.openxmlformats.org/drawingml/2006/diagram'


def local(tag):
    return tag.split('}', 1)[-1]


class Pkg:
    def __init__(self, path):
        self.path = path
        self.z = zipfile.ZipFile(path)
        self.names = set(self.z.namelist())

    def xml(self, name):
        if name not in self.names:
            return None
        return ET.fromstring(self.z.read(name))

    def rels(self, part):
        d, b = posixpath.split(part)
        rp = posixpath.join(d, '_rels', b + '.rels')
        x = self.xml(rp)
        out = {}
        if x is None:
            return out
        for r in x.findall('rel:Relationship', NS):
            tgt = r.get('Target')
            mode = r.get('TargetMode')
            if mode != 'External':
                tgt = posixpath.normpath(posixpath.join(d, tgt))
            out[r.get('Id')] = {'type': r.get('Type', '').rsplit('/', 1)[-1], 'target': tgt, 'external': mode == 'External'}
        return out


def emu_box(xfrm, sw, sh):
    if xfrm is None:
        return None
    off = xfrm.find('a:off', NS)
    ext = xfrm.find('a:ext', NS)
    if off is None or ext is None:
        return None
    x, y, cx, cy = (int(off.get('x', 0)), int(off.get('y', 0)), int(ext.get('cx', 0)), int(ext.get('cy', 0)))
    b = {'x': x, 'y': y, 'cx': cx, 'cy': cy}
    if sw and sh:
        b['frac'] = [round(x / sw, 4), round(y / sh, 4), round(cx / sw, 4), round(cy / sh, 4)]
    if xfrm.get('rot'):
        b['rot'] = int(xfrm.get('rot')) / 60000
    if xfrm.get('flipH'):
        b['flipH'] = True
    if xfrm.get('flipV'):
        b['flipV'] = True
    return b


def fill_summary(sppr):
    if sppr is None:
        return None
    for ch in sppr:
        n = local(ch.tag)
        if n == 'noFill':
            return 'none'
        if n == 'solidFill':
            return 'solid ' + color_str(ch)
        if n == 'gradFill':
            return 'gradient %d stops' % len(ch.findall('.//a:gs', NS))
        if n == 'blipFill':
            return 'picture'
        if n == 'pattFill':
            return 'pattern ' + (ch.get('prst') or '')
        if n == 'grpFill':
            return 'group'
    return None


def color_str(el):
    for c in el:
        n = local(c.tag)
        v = c.get('val') or c.get('lastClr') or ''
        mods = ['%s=%s' % (local(m.tag), m.get('val')) for m in c]
        return '%s:%s%s' % (n, v, (' ' + ' '.join(mods)) if mods else '')
    return ''


def line_summary(sppr):
    if sppr is None:
        return None
    ln = sppr.find('a:ln', NS)
    if ln is None:
        return None
    r = {}
    if ln.get('w'):
        r['w'] = int(ln.get('w'))
    f = fill_summary(ln)
    if f:
        r['fill'] = f
    d = ln.find('a:prstDash', NS)
    if d is not None:
        r['dash'] = d.get('val')
    for end in ('headEnd', 'tailEnd'):
        e = ln.find('a:' + end, NS)
        if e is not None and e.get('type') not in (None, 'none'):
            r[end] = e.get('type')
    return r or None


def hlink(el, rels):
    if el is None:
        return None
    rid = el.get(R + 'id')
    act = el.get('action')
    r = {}
    if rid and rid in rels:
        r['target'] = rels[rid]['target']
        r['external'] = rels[rid]['external']
        r['relType'] = rels[rid]['type']
    elif rid:
        r['rid'] = rid
    if act:
        r['action'] = act
    if el.get('tooltip'):
        r['tooltip'] = el.get('tooltip')
    return r or {'empty': True}


def text_body(txbody, rels, fonts_used):
    if txbody is None:
        return None
    body = txbody.find('a:bodyPr', NS)
    res = {'paragraphs': []}
    if body is not None:
        bp = {k: body.get(k) for k in ('anchor', 'rtlCol', 'wrap', 'vert', 'numCol') if body.get(k)}
        fit = [local(c.tag) for c in body if local(c.tag) in ('normAutofit', 'spAutoFit', 'noAutofit')]
        if fit:
            bp['autofit'] = fit[0]
        if bp:
            res['bodyPr'] = bp
    for para in txbody.findall('a:p', NS):
        ppr = para.find('a:pPr', NS)
        pd = {}
        txt = []
        runs = []
        links = []
        fields = []
        for ch in para:
            n = local(ch.tag)
            if n in ('r', 'fld'):
                t = ch.find('a:t', NS)
                tx = t.text if t is not None and t.text else ''
                txt.append(tx)
                rpr = ch.find('a:rPr', NS)
                rd = {}
                if rpr is not None:
                    for k in ('sz', 'lang', 'spc', 'b', 'i', 'baseline', 'cap', 'altLang'):
                        if rpr.get(k) is not None:
                            rd[k] = rpr.get(k)
                    for f in ('latin', 'ea', 'cs', 'sym'):
                        fe = rpr.find('a:' + f, NS)
                        if fe is not None and fe.get('typeface'):
                            rd[f] = fe.get('typeface')
                            fonts_used.add(fe.get('typeface'))
                    sf = rpr.find('a:solidFill', NS)
                    if sf is not None:
                        rd['color'] = color_str(sf)
                    hl = rpr.find('a:hlinkClick', NS)
                    if hl is not None:
                        links.append({'text': tx[:40], **hlink(hl, rels)})
                if n == 'fld':
                    fields.append({'type': ch.get('type'), 'text': tx})
                rd['text'] = tx[:40]
                runs.append(rd)
            elif n == 'br':
                txt.append('\n')
        full = ''.join(txt)
        pd['text'] = full[:80]
        if len(full) > 80:
            pd['textLength'] = len(full)
        if ppr is not None:
            for k in ('algn', 'rtl', 'lvl', 'indent', 'marL'):
                if ppr.get(k) is not None:
                    pd[k] = ppr.get(k)
            for b in ('buAutoNum', 'buChar', 'buNone', 'buBlip'):
                be = ppr.find('a:' + b, NS)
                if be is not None:
                    pd['bullet'] = {'kind': b, **{k: v for k, v in be.attrib.items()}}
            bf = ppr.find('a:buFont', NS)
            if bf is not None and bf.get('typeface'):
                pd['bulletFont'] = bf.get('typeface')
                fonts_used.add(bf.get('typeface'))
            for sp in ('lnSpc', 'spcBef', 'spcAft'):
                se = ppr.find('a:' + sp, NS)
                if se is not None:
                    v = se.find('a:spcPct', NS)
                    v2 = se.find('a:spcPts', NS)
                    pd[sp] = ('%s%%' % (int(v.get('val')) / 1000)) if v is not None else ('%spt' % (int(v2.get('val')) / 100) if v2 is not None else None)
        if runs:
            pd['runs'] = runs
        if links:
            pd['links'] = links
        if fields:
            pd['fields'] = fields
        res['paragraphs'].append(pd)
    return res


def chart_info(pkg, part):
    x = pkg.xml(part)
    if x is None:
        return {'part': part, 'missing': True}
    r = {'part': part}
    pa = x.find('.//c:plotArea', NS)
    types = []
    series = []
    if pa is not None:
        for ch in pa:
            n = local(ch.tag)
            if n.endswith('Chart'):
                t = {'type': n}
                for k in ('barDir', 'grouping', 'scatterStyle', 'radarStyle', 'holeSize', 'varyColors', 'gapWidth', 'overlap'):
                    e = ch.find('c:' + k, NS)
                    if e is not None:
                        t[k] = e.get('val')
                t['axIds'] = [a.get('val') for a in ch.findall('c:axId', NS)]
                t['series'] = len(ch.findall('c:ser', NS))
                types.append(t)
                for s in ch.findall('c:ser', NS):
                    nm = s.find('c:tx', NS)
                    name = ''
                    if nm is not None:
                        v = nm.find('.//c:v', NS)
                        name = v.text if v is not None else ''
                    sd = {'chart': n, 'name': name, 'points': len(s.findall('.//c:val//c:pt', NS)) or len(s.findall('.//c:yVal//c:pt', NS))}
                    if s.find('c:dLbls', NS) is not None:
                        dl = s.find('c:dLbls', NS)
                        sd['dataLabels'] = {local(e.tag): e.get('val') for e in dl if e.get('val') is not None}
                    if s.find('c:trendline', NS) is not None:
                        sd['trendline'] = True
                    if s.find('c:errBars', NS) is not None:
                        sd['errorBars'] = True
                    sf = s.find('c:spPr', NS)
                    if sf is not None:
                        sd['fill'] = fill_summary(sf)
                    series.append(sd)
        axes = []
        for ax in pa:
            n = local(ax.tag)
            if n.endswith('Ax'):
                ad = {'kind': n, 'id': (ax.find('c:axId', NS).get('val') if ax.find('c:axId', NS) is not None else None)}
                for k in ('axPos', 'delete', 'crosses', 'majorUnit', 'minorUnit', 'tickLblPos'):
                    e = ax.find('c:' + k, NS)
                    if e is not None:
                        ad[k] = e.get('val')
                nf = ax.find('c:numFmt', NS)
                if nf is not None:
                    ad['numFmt'] = nf.get('formatCode')
                sc = ax.find('c:scaling', NS)
                if sc is not None:
                    for k in ('min', 'max', 'orientation'):
                        e = sc.find('c:' + k, NS)
                        if e is not None:
                            ad[k] = e.get('val')
                axes.append(ad)
        r['axes'] = axes
        r['secondaryAxis'] = len([t for t in types]) > 1 and len({tuple(t['axIds']) for t in types}) > 1
    r['types'] = types
    r['series'] = series
    lg = x.find('.//c:legend', NS)
    if lg is not None:
        pos = lg.find('c:legendPos', NS)
        r['legend'] = pos.get('val') if pos is not None else 'present'
    else:
        r['legend'] = None
    t = x.find('.//c:chart/c:title', NS)
    if t is not None:
        r['title'] = ''.join(e.text or '' for e in t.iter(A + 't'))[:80]
    adt = x.find('.//c:autoTitleDeleted', NS)
    if adt is not None:
        r['autoTitleDeleted'] = adt.get('val')
    rels = pkg.rels(part)
    r['embeddedWorkbook'] = any(v['type'] == 'package' for v in rels.values())
    r['rels'] = sorted({v['type'] for v in rels.values()})
    return r


def frame_info(gf, rels, pkg):
    gd = gf.find('a:graphic/a:graphicData', NS)
    uri = gd.get('uri') if gd is not None else None
    if uri == TABLE_URI:
        tbl = gd.find('a:tbl', NS)
        tp = tbl.find('a:tblPr', NS)
        rows = tbl.findall('a:tr', NS)
        cols = tbl.findall('a:tblGrid/a:gridCol', NS)
        merges = []
        cells = []
        for ri, tr in enumerate(rows):
            row = []
            for ci, tc in enumerate(tr.findall('a:tc', NS)):
                m = {k: tc.get(k) for k in ('gridSpan', 'rowSpan', 'hMerge', 'vMerge') if tc.get(k)}
                if m:
                    merges.append({'row': ri, 'col': ci, **m})
                row.append(''.join(e.text or '' for e in tc.iter(A + 't'))[:40])
            cells.append(row)
        info = {'kind': 'graphicFrame table', 'rows': len(rows), 'columns': len(cols), 'merges': merges, 'cells': cells}
        if tp is not None:
            info['tblPr'] = {k: v for k, v in tp.attrib.items()}
            sid = tp.find('a:tableStyleId', NS)
            if sid is not None:
                info['tableStyleId'] = sid.text
        rtl = tp.get('rtl') if tp is not None else None
        if rtl:
            info['rtl'] = rtl
        return info
    if uri == CHART_URI:
        ch = gd.find('c:chart', NS)
        rid = ch.get(R + 'id') if ch is not None else None
        part = rels.get(rid, {}).get('target')
        return {'kind': 'graphicFrame chart', 'chart': chart_info(pkg, part) if part else None}
    if uri == CX_URI or (gd is not None and gd.find('.//{%s}chart' % NS['cx']) is not None):
        el = gd.find('.//{%s}chart' % NS['cx'])
        rid = el.get(R + 'id') if el is not None else None
        part = rels.get(rid, {}).get('target')
        return {'kind': 'graphicFrame chart', 'chartex': part}
    if uri == DGM_URI:
        return {'kind': 'graphicFrame other', 'uri': uri, 'diagram': True}
    return {'kind': 'graphicFrame other', 'uri': uri}


def nv_props(el):
    for nv in el:
        if local(nv.tag).startswith('nv'):
            c = nv.find('p:cNvPr', NS)
            ph = nv.find('p:nvPr/p:ph', NS)
            return c, ph, nv
    return None, None, None


def walk_tree(tree, rels, pkg, sw, sh, fonts_used, depth=0):
    items = []
    for el in tree:
        n = local(el.tag)
        if n == 'AlternateContent':
            ch = el.find('mc:Choice', NS)
            if ch is None:
                ch = el.find('mc:Fallback', NS)
            if ch is not None:
                items += walk_tree(ch, rels, pkg, sw, sh, fonts_used, depth)
            continue
        if n not in ('sp', 'pic', 'graphicFrame', 'cxnSp', 'grpSp', 'contentPart'):
            continue
        c, ph, nv = nv_props(el)
        it = {'kind': n, 'depth': depth}
        if c is not None:
            it['id'] = c.get('id')
            it['name'] = c.get('name')
            if c.get('descr'):
                it['descr'] = c.get('descr')
            if c.get('hidden'):
                it['hidden'] = c.get('hidden')
            hl = c.find('a:hlinkClick', NS)
            if hl is not None:
                it['shapeLink'] = hlink(hl, rels)
        if ph is not None:
            it['placeholder'] = {'type': ph.get('type') or 'body', 'idx': ph.get('idx')}
        sppr = el.find('p:spPr', NS) if n != 'grpSp' else el.find('p:grpSpPr', NS)
        xfrm = None
        if n == 'graphicFrame':
            xfrm = el.find('p:xfrm', NS)
        elif sppr is not None:
            xfrm = sppr.find('a:xfrm', NS)
        it['box'] = emu_box(xfrm, sw, sh)
        if sppr is not None:
            pg = sppr.find('a:prstGeom', NS)
            if pg is not None:
                it['preset'] = pg.get('prst')
            elif sppr.find('a:custGeom', NS) is not None:
                it['preset'] = 'custGeom'
            f = fill_summary(sppr)
            if f:
                it['fill'] = f
            ls = line_summary(sppr)
            if ls:
                it['line'] = ls
        if n == 'sp':
            tb = text_body(el.find('p:txBody', NS), rels, fonts_used)
            if tb and any(p['text'] for p in tb['paragraphs']):
                it['text'] = tb
            elif tb:
                it['emptyText'] = True
        elif n == 'pic':
            bf = el.find('p:blipFill', NS)
            if bf is not None:
                bl = bf.find('a:blip', NS)
                if bl is not None:
                    rid = bl.get(R + 'embed') or bl.get(R + 'link')
                    it['image'] = rels.get(rid, {}).get('target')
                    eff = [local(e.tag) for e in bl]
                    if eff:
                        it['blipEffects'] = eff
                sr = bf.find('a:srcRect', NS)
                if sr is not None and sr.attrib:
                    it['crop'] = dict(sr.attrib)
                if bf.find('a:tile', NS) is not None:
                    it['tile'] = dict(bf.find('a:tile', NS).attrib)
        elif n == 'graphicFrame':
            it.update(frame_info(el, rels, pkg))
        elif n == 'cxnSp':
            nvc = nv.find('p:cNvCxnSpPr', NS) if nv is not None else None
            if nvc is not None:
                for k in ('stCxn', 'endCxn'):
                    e = nvc.find('a:' + k, NS)
                    if e is not None:
                        it[k] = {'id': e.get('id'), 'idx': e.get('idx')}
        elif n == 'grpSp':
            it['items'] = walk_tree(el, rels, pkg, sw, sh, fonts_used, depth + 1)
        items.append(it)
    return items


def theme_fonts(pkg, master_part):
    rels = pkg.rels(master_part)
    th = [v['target'] for v in rels.values() if v['type'] == 'theme']
    if not th:
        return None
    x = pkg.xml(th[0])
    if x is None:
        return None
    r = {'part': th[0]}
    for scope in ('majorFont', 'minorFont'):
        e = x.find('.//a:fontScheme/a:' + scope, NS)
        if e is None:
            continue
        d = {}
        for k in ('latin', 'ea', 'cs'):
            f = e.find('a:' + k, NS)
            if f is not None:
                d[k] = f.get('typeface')
        d['scripts'] = {f.get('script'): f.get('typeface') for f in e.findall('a:font', NS)}
        r[scope] = d
    return r


def transition(sx):
    out = {}
    t = sx.find('p:transition', NS)
    if t is None:
        alt = sx.find('mc:AlternateContent', NS)
        if alt is not None:
            t = alt.find('.//p:transition', NS)
    if t is not None:
        out['transition'] = {**dict(t.attrib), 'effects': [local(c.tag) for c in t]}
    tm = sx.find('p:timing', NS)
    if tm is not None:
        out['timing'] = {'animations': len(tm.findall('.//p:anim', NS)) + len(tm.findall('.//p:animEffect', NS)),
                         'sets': len(tm.findall('.//p:set', NS)), 'pars': len(tm.findall('.//p:par', NS))}
    return out


def inspect(path):
    pkg = Pkg(path)
    pres = pkg.xml('ppt/presentation.xml')
    prels = pkg.rels('ppt/presentation.xml')
    sz = pres.find('p:sldSz', NS)
    sw, sh = int(sz.get('cx')), int(sz.get('cy'))
    doc = {'file': path, 'slideSize': {'cx': sw, 'cy': sh, 'type': sz.get('type'), 'inches': [round(sw / 914400, 3), round(sh / 914400, 3)]}}
    fonts_used = set()
    masters = [prels[e.get(R + 'id')]['target'] for e in pres.findall('p:sldMasterIdLst/p:sldMasterId', NS)]
    doc['masters'] = masters
    doc['themeFonts'] = theme_fonts(pkg, masters[0]) if masters else None
    lays = []
    for m in masters:
        for rid, v in pkg.rels(m).items():
            if v['type'] == 'slideLayout':
                lx = pkg.xml(v['target'])
                cs = lx.find('p:cSld', NS)
                lays.append({'part': v['target'], 'name': cs.get('name') if cs is not None else None, 'type': lx.get('type')})
    doc['slideLayouts'] = lays
    slides = []
    hidden = []
    for i, e in enumerate(pres.findall('p:sldIdLst/p:sldId', NS), 1):
        part = prels[e.get(R + 'id')]['target']
        sx = pkg.xml(part)
        rels = pkg.rels(part)
        s = {'number': i, 'part': part}
        if sx.get('show') == '0':
            s['hidden'] = True
            hidden.append(i)
        lay = [v['target'] for v in rels.values() if v['type'] == 'slideLayout']
        if lay:
            lx = pkg.xml(lay[0])
            cs = lx.find('p:cSld', NS)
            s['layout'] = cs.get('name') if cs is not None else None
            s['layoutPart'] = lay[0]
        cs = sx.find('p:cSld', NS)
        bg = cs.find('p:bg', NS)
        if bg is not None:
            bp = bg.find('p:bgPr', NS)
            s['background'] = fill_summary(bp) if bp is not None else 'bgRef'
        tree = cs.find('p:spTree', NS)
        s['items'] = walk_tree(tree, rels, pkg, sw, sh, fonts_used)
        s['placeholders'] = [{'type': it['placeholder']['type'], 'idx': it['placeholder']['idx'], 'hasText': 'text' in it}
                             for it in iter_items(s['items']) if 'placeholder' in it]
        furn = [it for it in iter_items(s['items']) if it.get('placeholder', {}).get('type') in ('ftr', 'sldNum', 'dt')]
        s['furniture'] = [{'type': it['placeholder']['type'],
                           'text': ' | '.join(p['text'] for p in it.get('text', {}).get('paragraphs', [])),
                           'fields': [f for p in it.get('text', {}).get('paragraphs', []) for f in p.get('fields', [])]}
                          for it in furn]
        s['fields'] = [f for it in iter_items(s['items']) for p in it.get('text', {}).get('paragraphs', []) for f in p.get('fields', [])]
        s['links'] = links_of(s['items'])
        notes = [v['target'] for v in rels.values() if v['type'] == 'notesSlide']
        if notes:
            nx = pkg.xml(notes[0])
            texts = []
            for sp in nx.iter(P + 'sp'):
                ph = sp.find('p:nvSpPr/p:nvPr/p:ph', NS)
                if ph is not None and ph.get('type') == 'body':
                    texts.append('\n'.join(''.join(t.text or '' for t in p.iter(A + 't')) for p in sp.iter(A + 'p')))
            s['notes'] = '\n'.join(texts).strip()
        s.update(transition(sx))
        s['kinds'] = kinds(s['items'])
        slides.append(s)
    doc['hiddenSlides'] = hidden
    doc['slides'] = slides
    tf = doc.get('themeFonts') or {}
    for scope in ('majorFont', 'minorFont'):
        for k in ('latin', 'ea', 'cs'):
            v = (tf.get(scope) or {}).get(k)
            if v:
                fonts_used.add(v)
    doc['fontsUsed'] = sorted(fonts_used)
    doc['parts'] = {'charts': sorted(n for n in pkg.names if n.startswith('ppt/charts/chart')),
                    'chartex': sorted(n for n in pkg.names if n.startswith('ppt/charts/chartEx')),
                    'embeddings': sorted(n for n in pkg.names if n.startswith('ppt/embeddings/')),
                    'media': len([n for n in pkg.names if n.startswith('ppt/media/')])}
    return doc


def iter_items(items):
    for it in items:
        yield it
        yield from iter_items(it.get('items') or [])


def links_of(items):
    out = []
    for it in iter_items(items):
        if it.get('shapeLink'):
            out.append({'on': 'shape', 'name': it.get('name'), **it['shapeLink']})
        for p in it.get('text', {}).get('paragraphs', []):
            for l in p.get('links', []):
                out.append({'on': 'run', 'name': it.get('name'), **l})
    return out


def kinds(items):
    c = {}
    for it in iter_items(items):
        k = it['kind']
        if k == 'graphicFrame':
            k = it.get('kind', k)
        if 'graphicFrame' in it.get('kind', ''):
            k = it['kind']
        c[k] = c.get(k, 0) + 1
    return c


# ---------- diff ----------

def slide_sig(s):
    texts = [p['text'] for it in iter_items(s['items']) for p in it.get('text', {}).get('paragraphs', []) if p['text']]
    fonts = sorted({r.get(k) for it in iter_items(s['items']) for p in it.get('text', {}).get('paragraphs', [])
                    for r in p.get('runs', []) for k in ('latin', 'ea', 'cs') if r.get(k)})
    return {'kinds': s['kinds'], 'texts': texts, 'fonts': fonts,
            'links': [(l['on'], l.get('target') or l.get('action')) for l in s['links']],
            'notes': s.get('notes', ''), 'layout': s.get('layout'), 'hidden': bool(s.get('hidden')),
            'placeholders': sorted('%s:%s' % (p['type'], p['hasText']) for p in s['placeholders']),
            'fields': sorted(f['type'] or '' for f in s['fields']),
            'pictureDescr': [it.get('descr') for it in iter_items(s['items']) if it['kind'] == 'pic'],
            'connectors': [(bool(it.get('stCxn')), bool(it.get('endCxn'))) for it in iter_items(s['items']) if it['kind'] == 'cxnSp'],
            'transition': (s.get('transition') or {}).get('effects')}


def diff(a, b):
    da, db = inspect(a), inspect(b)
    out = {'a': a, 'b': b, 'slideCount': [len(da['slides']), len(db['slides'])],
           'slideSize': [da['slideSize'], db['slideSize']], 'hiddenSlides': [da['hiddenSlides'], db['hiddenSlides']],
           'fontsOnlyInA': sorted(set(da['fontsUsed']) - set(db['fontsUsed'])),
           'fontsOnlyInB': sorted(set(db['fontsUsed']) - set(da['fontsUsed'])), 'slides': []}
    for i in range(max(len(da['slides']), len(db['slides']))):
        sa = slide_sig(da['slides'][i]) if i < len(da['slides']) else None
        sb = slide_sig(db['slides'][i]) if i < len(db['slides']) else None
        ch = {'number': i + 1}
        if sa is None or sb is None:
            ch['missingIn'] = 'a' if sa is None else 'b'
            out['slides'].append(ch)
            continue
        for k in sa:
            if sa[k] != sb[k]:
                if k == 'texts':
                    ch['texts'] = {'onlyInA': [t for t in sa[k] if t not in sb[k]], 'onlyInB': [t for t in sb[k] if t not in sa[k]]}
                    if not ch['texts']['onlyInA'] and not ch['texts']['onlyInB']:
                        ch['texts'] = 'same texts, other order or split'
                else:
                    ch[k] = {'a': sa[k], 'b': sb[k]}
        if len(ch) > 1:
            out['slides'].append(ch)
    return out


def main(argv):
    if not argv or argv[0] in ('-h', '--help'):
        print(__doc__)
        return 0
    out = None
    if '--out' in argv:
        i = argv.index('--out')
        out = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    if argv[0] == '--diff':
        res = diff(argv[1], argv[2])
    elif argv[0] == '--summary':
        d = inspect(argv[1])
        for s in d['slides']:
            print('%2d %-22s %s%s' % (s['number'], (s.get('layout') or '')[:22], ' '.join('%s=%d' % kv for kv in s['kinds'].items()),
                                     ' HIDDEN' if s.get('hidden') else ''))
        return 0
    else:
        res = inspect(argv[0])
    s = json.dumps(res, ensure_ascii=False, indent=1)
    if out:
        with open(out, 'w', encoding='utf-8') as f:
            f.write(s)
    else:
        print(s)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
