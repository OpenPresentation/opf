"""Read native PDF output font names; never extract font programs or outlines."""
import hashlib
import json
import platform
import re
import sys
from pathlib import Path
import pdfplumber
import pypdf

root = Path(sys.argv[1]).resolve(strict=True)
sha = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
generation = json.loads((root / "generation.json").read_text(encoding="utf-8-sig"))
native = json.loads((root / "native.json").read_text(encoding="utf-8-sig"))
source = root / "private-font-proof.pdf"
assert sha(source) == native["privatePdfSha256"]
assert sha(root / "generation.json") == native["generationSha256"]
normalize = lambda name: re.sub(r"^[A-Z]{6}\+", "", name.lstrip("/"))
def face_tuple(name):
    # Windows PowerPoint PDF names encode the legacy family with an optional
    # comma style. Parse this dialect strictly; never strip arbitrary punctuation
    # or silently alias a fallback family to the requested one.
    parts = name.split(",")
    assert len(parts) <= 2
    style = parts[1] if len(parts) == 2 else ""
    assert style in ["", "Bold", "Italic", "BoldItalic"]
    return (parts[0], "Bold" in style, "Italic" in style)

expected = sorted((face["family"], face["bold"], face["italic"]) for face in generation["fonts"])
pages = []
with pdfplumber.open(source) as pdf:
    assert len(pdf.pages) == 7
    for index, page in enumerate(pdf.pages):
        font_names = sorted(set(normalize(char["fontname"]) for char in page.chars if char["text"].strip()))
        raster = root / f"pdf-{index + 1}.png"
        page.to_image(resolution=96).save(raster)
        pages.append({"slide": index + 1, "fontNames": font_names,
                      "text": page.extract_text(), "raster": raster.name, "rasterSha256": sha(raster)})
observed = sorted(set(name for page in pages for name in page["fontNames"]))
observed_faces = sorted(face_tuple(name) for name in observed)
report = {"generationSha256": sha(root / "generation.json"), "pdfSha256": sha(source),
          "extractorSha256": sha(Path(__file__)), "expectedFaces": expected, "observedFaces": observed_faces,
          "rawPdfFontNames": observed, "sourcePostscriptNames": [face["postscriptName"] for face in generation["fonts"]],
          "passed": observed_faces == expected, "pages": pages, "python": platform.python_version(),
          "pdfplumber": pdfplumber.__version__, "pypdf": pypdf.__version__,
          "scope": "Names of PDF fonts actually referenced by non-whitespace glyphs, parsed as Windows legacy-family plus optional comma Bold/Italic style. Exact family/style match with pinned open-font metadata; not PostScript-name equality, physical-file identity or browser/native raster equivalence. No font programs extracted."}
(root / "pdf-fonts.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"expected": expected, "observed": observed, "passed": report["passed"]}))
assert report["passed"], "Unexpected or missing native PDF output face; retain raw report"
