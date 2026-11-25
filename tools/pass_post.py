#!/usr/bin/env python3
"""After kn-run: compare.py and sheet.py --grid for every OPENED file of one kn-run output folder.

  pass_post.py --out <kn-run out dir> --sheets <dir> [--version 0.36.0] [--preview <dir> | --preview-map <file.tsv>]
               [--only <name>,...]

Preview folder per file: for an input <...>/build/<ver>/<family>/<deck>/<mode>.pptx it is <...>/<deck>/preview/ (bin/build-deck's
layout); for the qualification corpus (<...>/qualification/pptx/<deck>.pptx) it is <...>/qualification/preview/<deck>/;
otherwise give --preview (one folder for all) or --preview-map (TSV: name<TAB>preview dir). Mode = the part after "~" in the name
(default when none). Writes <out>/<name>/scores.json and <sheets>/<name>-pN.jpg, and prints one line per file with its top slides.
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def arg(argv, k, default=None):
    return argv[argv.index(k) + 1] if k in argv else default


def preview_for(inp, name, a):
    if a['map'] and name in a['map']:
        return a['map'][name]
    if a['preview']:
        return a['preview']
    m = re.search(r'^(.*/build/[^/]+/[^/]+/[^/]+)/[^/]+\.pptx$', inp)
    if m and os.path.isdir(os.path.join(m.group(1), 'preview')):
        return os.path.join(m.group(1), 'preview')
    m = re.search(r'^(.*/qualification)/pptx/([^/]+)\.pptx$', inp)
    if m:
        deck = m.group(2).split('~')[0]
        return os.path.join(m.group(1), 'preview', deck)
    return None


def main(argv):
    if not argv or '-h' in argv or '--help' in argv:
        print(__doc__)
        return 0
    out = os.path.abspath(arg(argv, '--out'))
    sheets = os.path.abspath(arg(argv, '--sheets', os.path.join(out, '_sheets')))
    os.makedirs(sheets, exist_ok=True)
    a = {'preview': arg(argv, '--preview'), 'map': {}}
    if arg(argv, '--preview-map'):
        with open(arg(argv, '--preview-map')) as f:
            for line in f:
                p = line.rstrip('\n').split('\t')
                if len(p) == 2:
                    a['map'][p[0]] = p[1]
    only = set((arg(argv, '--only') or '').split(',')) - {''}
    version = arg(argv, '--version', '0.36.0')
    for name in sorted(os.listdir(out)):
        rj = os.path.join(out, name, 'run.json')
        if not os.path.exists(rj) or (only and name not in only):
            continue
        with open(rj) as f:
            r = json.load(f)
        if r.get('status') != 'OPENED':
            print('%-40s skipped (%s)' % (name, r.get('status')))
            continue
        pv = preview_for(r['input'], name, a)
        if not pv or not os.path.isdir(pv):
            print('%-40s no preview folder (give --preview or --preview-map)' % name)
            continue
        mode = name.split('~', 1)[1] if '~' in name else 'default'
        deck = name.split('~', 1)[0]
        sc = os.path.join(out, name, 'scores.json')
        p1 = subprocess.run([sys.executable, os.path.join(HERE, 'compare.py'), '--preview', pv, '--keynote',
                             os.path.join(out, name, 'slides'), '--map', rj, '--out', sc], capture_output=True, text=True)
        p2 = subprocess.run([sys.executable, os.path.join(HERE, 'sheet.py'), '--grid', '--preview', pv, '--keynote',
                             os.path.join(out, name, 'slides'), '--deck', deck, '--version', version, '--mode', mode,
                             '--scores', sc, '--out-prefix', os.path.join(sheets, name)], capture_output=True, text=True)
        print('%-40s %s; %d sheet(s)%s' % (name, p1.stdout.strip() or p1.stderr.strip()[-200:], len(p2.stdout.split()),
                                         (' ERROR ' + p2.stderr.strip()[-200:]) if p2.returncode else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
