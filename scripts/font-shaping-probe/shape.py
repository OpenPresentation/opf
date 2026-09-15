import hashlib, json, sys
from pathlib import Path
import uharfbuzz as hb

font_root, output = sys.argv[1:]
root = Path(output)
source = json.loads((root / 'fontkit-matrix.json').read_text())
fonts = {}
for face in source['faces']:
    data = (Path(font_root) / face['file']).read_bytes()
    assert hashlib.sha256(data).hexdigest() == face['sha256']
    hf = hb.Face(data)
    font = hb.Font(hf)
    font.scale = (hf.upem, hf.upem)
    fonts[face['id']] = (font, hf.upem)
results = []
trace = []
for item in source['samples']:
    font, upem = fonts[item['face']]
    original = item['text']
    buf = hb.Buffer()
    buf.add_str(original)
    buf.language = 'und'
    buf.guess_segment_properties()
    if item['id'] == 'Probe1-7889-decomposed':
        def capture(message):
            trace.append(dict(message=message, type=buf.content_type.name,
                              buffer=[dict(value=g.codepoint, cluster=g.cluster) for g in buf.glyph_infos]))
            return True  # Observe every stage; never skip a shaping operation.
        buf.set_message_func(capture)
    hb.shape(font, buf)
    glyphs = [dict(id=g.codepoint, cluster=g.cluster, xAdvance=p.x_advance, yAdvance=p.y_advance, xOffset=p.x_offset, yOffset=p.y_offset) for g, p in zip(buf.glyph_infos, buf.glyph_positions)]
    assert original == item['text']
    results.append(dict(id=item['id'], script=buf.script, language=buf.language, direction=buf.direction, harfbuzzAt32=sum(g['xAdvance'] for g in glyphs)*32/upem, glyphs=glyphs))
(root / 'harfbuzz-matrix.json').write_text(json.dumps(dict(binding=hb.__version__, harfbuzz=hb.version_string(), sourceSha256=hashlib.sha256((root/'fontkit-matrix.json').read_bytes()).hexdigest(), results=results), ensure_ascii=True))
(root / 'harfbuzz-trace.json').write_text(json.dumps(dict(sample='Probe1-7889-decomposed', text='o\u0302\u0301', binding=hb.__version__, harfbuzz=hb.version_string(), trace=trace), ensure_ascii=True))
print(f'Recorded {len(results)} unchanged-source HarfBuzz specimens.')
