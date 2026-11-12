import re
def read(p): return open(p,encoding='utf8').read()
def write(p,s): open(p,'w',encoding='utf8').write(s)
def edit(p, pairs):
    s=read(p)
    for a,b,*c in pairs:
        n=c[0] if c else 1
        assert s.count(a)==n, (p, a[:100], s.count(a))
        s=s.replace(a,b)
    write(p,s)
def region_word(t): return 'start' if t=='left' else 'end' if t=='right' else t
def region_key(k):
    if ':' in k:
        r,c=k.split(':',1); return r+':'+'+'.join(region_word(t) for t in c.split('+'))
    return '+'.join(region_word(t) for t in k.split('+'))
REGION_LIT=re.compile(r'''(["'`])((?:(?:top|middle|bottom)(?:\+(?:top|middle|bottom))*:)?(?:left|center|right)(?:\+(?:left|center|right))*)\1''')
def fix_region_literals(s):
    """Quoted region keys (left, center+right, top:left ...) -> start/end. Use only on text that holds region keys."""
    return REGION_LIT.sub(lambda m: m.group(1)+region_key(m.group(2))+m.group(1), s)
def fix_array(p, name):
    """Region keys inside the array literal assigned to `name`."""
    s=read(p); i=s.index(name); j=s.index('[',i); k=s.index(']',j)
    seg=fix_region_literals(s[j:k]); n=sum(1 for a,b in zip(s[j:k].split('\n'),seg.split('\n')) if a!=b)
    write(p,s[:j]+seg+s[k:]); return n
def fix_regex_alternations(p, expect=None):
    """left|center|right alternations of region-key regexes."""
    s=read(p); n=0
    for a,b in [('left|center|right','start|center|end'),('center|right','center|end'),('left|center','start|center')]:
        n+=s.count(a); s=s.replace(a,b)
    if expect is not None: assert n==expect,(p,n)
    write(p,s); return n
