import zipfile,re,sys
def rewrite(src,dst,fonts=None,drop_pic_ph=False):
    zi=zipfile.ZipFile(src); zo=zipfile.ZipFile(dst,'w',zipfile.ZIP_DEFLATED); n_f=0; n_p=0
    for it in zi.infolist():
        data=zi.read(it.filename)
        if it.filename.endswith('.xml') or it.filename.endswith('.rels'):
            s=data.decode('utf-8')
            if fonts:
                for a,b in fonts:
                    c=s.count('"%s"'%a); n_f+=c; s=s.replace('"%s"'%a,'"%s"'%b)
            if drop_pic_ph and re.match(r'ppt/slideLayouts/slideLayout\d+\.xml$',it.filename):
                s2,c=re.subn(r'<p:sp>(?:(?!</p:sp>).)*?<p:ph type="pic"[^>]*/>(?:(?!</p:sp>).)*?</p:sp>','',s,flags=re.S); n_p+=c; s=s2
            data=s.encode('utf-8')
        zo.writestr(it,data)
    zo.close(); print(dst,'font replacements',n_f,'pic placeholders removed',n_p)
mac=[('Aptos Display','Helvetica Neue'),('Aptos','Helvetica Neue')]
rewrite('A-default-aptos.pptx','C-helvetica-neue.pptx',fonts=mac)
rewrite('A-default-aptos.pptx','D-helvetica-neue-no-picture-placeholders.pptx',fonts=mac,drop_pic_ph=True)
rewrite('A-default-aptos.pptx','E-aptos-no-picture-placeholders.pptx',drop_pic_ph=True)
