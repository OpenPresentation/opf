#!/usr/bin/env python3
"""Turn kn.applescript's probe lines (path<TAB>type<TAB>value) into probe.json.

  knprobe.py probe.lines [probe.json]

Types: s text, n number, b boolean, e enumeration or other dictionary value (already its dictionary name), null, list (value =
count; the members follow as path/#i), err (the property threw: the value becomes null and one entry goes into `errors`).
Derived, not read from Keynote (marked so in the JSON): `skippedSlides`, per item `isDefaultTitle` / `isDefaultBody` (the item has
the default title/body item's position, size and text; that is how a probe tells that OPF's title sits in the layout's title
placeholder), per table `cellsByRow` (the bulk cell lists cut into rows, using column count).
"""
import json
import re
import sys

UNESC = re.compile(r'\\(u2028|u2029|[\\tnr])')


def unesc(s):
    return UNESC.sub(lambda m: {'\\': '\\', 't': '\t', 'n': '\n', 'r': '\r', 'u2028': ' ', 'u2029': ' '}[m.group(1)], s)


def setp(root, parts, value):
    cur = root
    for i, p in enumerate(parts):
        last = i == len(parts) - 1
        key = int(p[1:]) if p.startswith('#') else p
        if isinstance(cur, list):
            while len(cur) <= key:
                cur.append(None)
            existing = cur[key]
        else:
            existing = cur.get(key)
        if last:
            if isinstance(existing, (dict, list)) and (value is None or value == []):
                return
            cur[key] = value
            return
        if not isinstance(existing, (dict, list)):
            existing = [] if parts[i + 1].startswith('#') else {}
            cur[key] = existing
        cur = existing


def convert(lines):
    root = {}
    errors = []
    for line in lines:
        line = line.rstrip('\n')
        if not line:
            continue
        parts = line.split('\t', 2)
        if len(parts) < 3:
            parts += [''] * (3 - len(parts))
        path, typ, raw = parts
        val = unesc(raw)
        keys = path.split('/')
        if typ == 's':
            v = val
        elif typ == 'e':
            v = val
        elif typ == 'n':
            v = float(val) if ('.' in val or 'e' in val.lower()) else int(val)
        elif typ == 'b':
            v = val == 'true'
        elif typ == 'null':
            v = None
        elif typ == 'list':
            v = []
        elif typ == 'err':
            v = None
            errors.append({'path': path, 'error': val})
        else:
            v = val
        setp(root, keys, v)
    root['errors'] = errors
    derive(root)
    return root


def same_box(a, b):
    try:
        return (a.get('position') == b.get('position') and a.get('width') == b.get('width')
                and a.get('height') == b.get('height') and (a.get('text') or '') == (b.get('object text') or ''))
    except AttributeError:
        return False


def derive(root):
    slides = root.get('slides') or []
    root['skippedSlides'] = [s.get('slide number') for s in slides if isinstance(s, dict) and s.get('skipped')]
    for s in slides:
        if not isinstance(s, dict):
            continue
        tr = s.get('transition')
        if isinstance(tr, list) and len(tr) == 4:
            s['transition'] = {'effect': tr[0], 'duration': tr[1], 'delay': tr[2], 'automatic': tr[3]}
        dt = s.get('default title item') or {}
        db = s.get('default body item') or {}
        for it in walk(s.get('items') or []):
            if s.get('title showing') and dt.get('width'):
                it['isDefaultTitle'] = same_box(it, dt)
            if s.get('body showing') and db.get('width'):
                it['isDefaultBody'] = same_box(it, db)
            if it.get('class') == 'table' and isinstance(it.get('cells'), dict):
                cc = it.get('column count') or 0
                rows = []
                vals = it['cells'].get('formatted value') or it['cells'].get('value') or []
                if cc:
                    for r in range(0, len(vals), cc):
                        rows.append(vals[r:r + cc])
                it['cellsByRow'] = rows
    root['derived'] = ['skippedSlides', 'isDefaultTitle', 'isDefaultBody', 'cellsByRow']


def walk(items):
    for it in items:
        if isinstance(it, dict):
            yield it
            yield from walk(it.get('items') or [])


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    with open(argv[0], encoding='utf-8') as f:
        d = convert(f)
    out = argv[1] if len(argv) > 1 else None
    s = json.dumps(d, ensure_ascii=False, indent=1)
    if out:
        with open(out, 'w', encoding='utf-8') as f:
            f.write(s)
    else:
        print(s)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
