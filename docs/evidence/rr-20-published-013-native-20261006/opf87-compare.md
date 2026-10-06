# opf#87 save and reopen: FAIL

Attempt `20261006T175248Z`. Packages: @openpresentation/opf 0.13.0, @openpresentation/opf-pptx 0.13.1, @openpresentation/opf-render 0.13.0.

| Deck | Mode | Verdict | Failures | Warnings |
| --- | --- | --- | --- | --- |
| pictures | control | FAIL | 1 | 0 |
| pictures | edit | FAIL | 1 | 1 |
| furniture | control | PASS | 0 | 0 |
| furniture | edit | PASS | 0 | 1 |

## pictures / control

PowerPoint 16.0 build 20430.

- FAIL opc: slide 5: "OPF image 4" blip png -> undefined

What PowerPoint rewrote:

- field cached text: {"slide":1,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- field cached text: {"slide":2,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- field cached text: {"slide":3,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- field cached text: {"slide":4,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- picture media bytes: {"slide":5,"picture":"OPF image 4","source":"ppt/media/image-5-1.png"}
- field cached text: {"slide":5,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- masters p:hf: {"source":["<p:hf sldNum=\"1\" hdr=\"0\" ftr=\"1\" dt=\"1\"/>"],"saved":["<p:hf hdr=\"0\"/>"]}
- layouts p:hf: {"source":["<p:hf sldNum=\"1\" hdr=\"0\" ftr=\"1\" dt=\"1\"/>"],"saved":["<p:hf hdr=\"0\"/>"]}
- package parts: 31 added, 32 removed, 29 changed, 8 byte-identical
  - added: ppt/media/image1.png, ppt/media/image2.jpeg, ppt/media/image3.svg, ppt/tags/tag1.xml, ppt/tags/tag10.xml, ppt/tags/tag11.xml, ppt/tags/tag12.xml, ppt/tags/tag13.xml, ppt/tags/tag14.xml, ppt/tags/tag15.xml, ppt/tags/tag16.xml, ppt/tags/tag17.xml, ppt/tags/tag18.xml, ppt/tags/tag19.xml, ppt/tags/tag2.xml, ppt/tags/tag20.xml, ppt/tags/tag21.xml, ppt/tags/tag22.xml, ppt/tags/tag23.xml, ppt/tags/tag24.xml, ppt/tags/tag25.xml, ppt/tags/tag26.xml, ppt/tags/tag27.xml, ppt/tags/tag28.xml, ppt/tags/tag3.xml, ppt/tags/tag4.xml, ppt/tags/tag5.xml, ppt/tags/tag6.xml, ppt/tags/tag7.xml, ppt/tags/tag8.xml, ppt/tags/tag9.xml
  - removed: ppt/media/image-2-1.png, ppt/media/image-3-1.jpeg, ppt/media/image-5-1.png, ppt/media/svg-5-1.svg, ppt/tags/opfDocument.xml, ppt/tags/opfFurniture1.xml, ppt/tags/opfFurniture10.xml, ppt/tags/opfFurniture11.xml, ppt/tags/opfFurniture12.xml, ppt/tags/opfFurniture13.xml, ppt/tags/opfFurniture14.xml, ppt/tags/opfFurniture15.xml, ppt/tags/opfFurniture2.xml, ppt/tags/opfFurniture3.xml, ppt/tags/opfFurniture4.xml, ppt/tags/opfFurniture5.xml, ppt/tags/opfFurniture6.xml, ppt/tags/opfFurniture7.xml, ppt/tags/opfFurniture8.xml, ppt/tags/opfFurniture9.xml, ppt/tags/opfFurnitureSlide0.xml, ppt/tags/opfFurnitureSlide1.xml, ppt/tags/opfFurnitureSlide2.xml, ppt/tags/opfFurnitureSlide3.xml, ppt/tags/opfFurnitureSlide4.xml, ppt/tags/opfHeading1.xml, ppt/tags/opfHeading2.xml, ppt/tags/opfHeading3.xml, ppt/tags/opfHeading4.xml, ppt/tags/opfHeading5.xml, ppt/tags/opfText1.xml, ppt/tags/opfText2.xml
  - changed: [Content_Types].xml, _rels/.rels, docProps/app.xml, docProps/core.xml, ppt/_rels/presentation.xml.rels, ppt/notesMasters/_rels/notesMaster1.xml.rels, ppt/notesMasters/notesMaster1.xml, ppt/notesSlides/_rels/notesSlide1.xml.rels, ppt/notesSlides/_rels/notesSlide2.xml.rels, ppt/notesSlides/_rels/notesSlide3.xml.rels, ppt/notesSlides/_rels/notesSlide4.xml.rels, ppt/notesSlides/_rels/notesSlide5.xml.rels, ppt/presProps.xml, ppt/presentation.xml, ppt/slideLayouts/slideLayout1.xml, ppt/slideMasters/_rels/slideMaster1.xml.rels, ppt/slideMasters/slideMaster1.xml, ppt/slides/_rels/slide1.xml.rels, ppt/slides/_rels/slide2.xml.rels, ppt/slides/_rels/slide3.xml.rels, ppt/slides/_rels/slide4.xml.rels, ppt/slides/_rels/slide5.xml.rels, ppt/slides/slide1.xml, ppt/slides/slide2.xml, ppt/slides/slide3.xml, ppt/slides/slide4.xml, ppt/slides/slide5.xml, ppt/theme/theme1.xml, ppt/theme/theme2.xml
- p:presentation attributes: {"source":"<p:presentation firstSlideNum=\"1\"  saveSubsetFonts=\"1\" autoCompressPictures=\"0\">","saved":"<p:presentation saveSubsetFonts=\"1\" autoCompressPictures=\"0\">"}

## pictures / edit

PowerPoint 16.0 build 20430.

- FAIL opc: slide 5: "OPF image 4" blip png -> undefined
- WARN png: slide 1 0.53 % pixels differ

What PowerPoint rewrote:

- HeadersFooters: {"slide":1,"source":{"footerVisible":-1,"footerText":"Footer original text","slideNumberVisible":-1,"dateVisible":-1,"dateUseFormat":-1,"dateFormat":1},"saved":{"footerVisible":-1,"footerText":"Footer edited natively","slideNumberVisible":-1,"dateVisible":-1,"dateUseFormat":-1,"dateFormat":1}}
- field cached text: {"slide":1,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- field cached text: {"slide":2,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- field cached text: {"slide":3,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- field cached text: {"slide":4,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- picture media bytes: {"slide":5,"picture":"OPF image 4","source":"ppt/media/image-5-1.png"}
- field cached text: {"slide":5,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- masters p:hf: {"source":["<p:hf sldNum=\"1\" hdr=\"0\" ftr=\"1\" dt=\"1\"/>"],"saved":["<p:hf hdr=\"0\"/>"]}
- layouts p:hf: {"source":["<p:hf sldNum=\"1\" hdr=\"0\" ftr=\"1\" dt=\"1\"/>"],"saved":["<p:hf hdr=\"0\"/>"]}
- package parts: 31 added, 32 removed, 29 changed, 8 byte-identical
  - added: ppt/media/image1.png, ppt/media/image2.jpeg, ppt/media/image3.svg, ppt/tags/tag1.xml, ppt/tags/tag10.xml, ppt/tags/tag11.xml, ppt/tags/tag12.xml, ppt/tags/tag13.xml, ppt/tags/tag14.xml, ppt/tags/tag15.xml, ppt/tags/tag16.xml, ppt/tags/tag17.xml, ppt/tags/tag18.xml, ppt/tags/tag19.xml, ppt/tags/tag2.xml, ppt/tags/tag20.xml, ppt/tags/tag21.xml, ppt/tags/tag22.xml, ppt/tags/tag23.xml, ppt/tags/tag24.xml, ppt/tags/tag25.xml, ppt/tags/tag26.xml, ppt/tags/tag27.xml, ppt/tags/tag28.xml, ppt/tags/tag3.xml, ppt/tags/tag4.xml, ppt/tags/tag5.xml, ppt/tags/tag6.xml, ppt/tags/tag7.xml, ppt/tags/tag8.xml, ppt/tags/tag9.xml
  - removed: ppt/media/image-2-1.png, ppt/media/image-3-1.jpeg, ppt/media/image-5-1.png, ppt/media/svg-5-1.svg, ppt/tags/opfDocument.xml, ppt/tags/opfFurniture1.xml, ppt/tags/opfFurniture10.xml, ppt/tags/opfFurniture11.xml, ppt/tags/opfFurniture12.xml, ppt/tags/opfFurniture13.xml, ppt/tags/opfFurniture14.xml, ppt/tags/opfFurniture15.xml, ppt/tags/opfFurniture2.xml, ppt/tags/opfFurniture3.xml, ppt/tags/opfFurniture4.xml, ppt/tags/opfFurniture5.xml, ppt/tags/opfFurniture6.xml, ppt/tags/opfFurniture7.xml, ppt/tags/opfFurniture8.xml, ppt/tags/opfFurniture9.xml, ppt/tags/opfFurnitureSlide0.xml, ppt/tags/opfFurnitureSlide1.xml, ppt/tags/opfFurnitureSlide2.xml, ppt/tags/opfFurnitureSlide3.xml, ppt/tags/opfFurnitureSlide4.xml, ppt/tags/opfHeading1.xml, ppt/tags/opfHeading2.xml, ppt/tags/opfHeading3.xml, ppt/tags/opfHeading4.xml, ppt/tags/opfHeading5.xml, ppt/tags/opfText1.xml, ppt/tags/opfText2.xml
  - changed: [Content_Types].xml, _rels/.rels, docProps/app.xml, docProps/core.xml, ppt/_rels/presentation.xml.rels, ppt/notesMasters/_rels/notesMaster1.xml.rels, ppt/notesMasters/notesMaster1.xml, ppt/notesSlides/_rels/notesSlide1.xml.rels, ppt/notesSlides/_rels/notesSlide2.xml.rels, ppt/notesSlides/_rels/notesSlide3.xml.rels, ppt/notesSlides/_rels/notesSlide4.xml.rels, ppt/notesSlides/_rels/notesSlide5.xml.rels, ppt/presProps.xml, ppt/presentation.xml, ppt/slideLayouts/slideLayout1.xml, ppt/slideMasters/_rels/slideMaster1.xml.rels, ppt/slideMasters/slideMaster1.xml, ppt/slides/_rels/slide1.xml.rels, ppt/slides/_rels/slide2.xml.rels, ppt/slides/_rels/slide3.xml.rels, ppt/slides/_rels/slide4.xml.rels, ppt/slides/_rels/slide5.xml.rels, ppt/slides/slide1.xml, ppt/slides/slide2.xml, ppt/slides/slide3.xml, ppt/slides/slide4.xml, ppt/slides/slide5.xml, ppt/theme/theme1.xml, ppt/theme/theme2.xml
- p:presentation attributes: {"source":"<p:presentation firstSlideNum=\"1\"  saveSubsetFonts=\"1\" autoCompressPictures=\"0\">","saved":"<p:presentation saveSubsetFonts=\"1\" autoCompressPictures=\"0\">"}

Edit versus control (parts that differ): docProps/core.xml, ppt/slides/slide1.xml

## furniture / control

PowerPoint 16.0 build 20430.


What PowerPoint rewrote:

- field cached text: {"slide":1,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- field cached text: {"slide":2,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- field cached text: {"slide":3,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- masters p:hf: {"source":["<p:hf sldNum=\"1\" hdr=\"0\" ftr=\"1\" dt=\"1\"/>"],"saved":["<p:hf hdr=\"0\"/>"]}
- layouts p:hf: {"source":["<p:hf sldNum=\"1\" hdr=\"0\" ftr=\"1\" dt=\"1\"/>"],"saved":["<p:hf hdr=\"0\"/>"]}
- package parts: 22 added, 22 removed, 23 changed, 6 byte-identical
  - added: ppt/media/image1.png, ppt/tags/tag1.xml, ppt/tags/tag10.xml, ppt/tags/tag11.xml, ppt/tags/tag12.xml, ppt/tags/tag13.xml, ppt/tags/tag14.xml, ppt/tags/tag15.xml, ppt/tags/tag16.xml, ppt/tags/tag17.xml, ppt/tags/tag18.xml, ppt/tags/tag19.xml, ppt/tags/tag2.xml, ppt/tags/tag20.xml, ppt/tags/tag21.xml, ppt/tags/tag3.xml, ppt/tags/tag4.xml, ppt/tags/tag5.xml, ppt/tags/tag6.xml, ppt/tags/tag7.xml, ppt/tags/tag8.xml, ppt/tags/tag9.xml
  - removed: ppt/media/image-1-1.png, ppt/tags/opfDocument.xml, ppt/tags/opfFurniture1.xml, ppt/tags/opfFurniture10.xml, ppt/tags/opfFurniture11.xml, ppt/tags/opfFurniture12.xml, ppt/tags/opfFurniture2.xml, ppt/tags/opfFurniture3.xml, ppt/tags/opfFurniture4.xml, ppt/tags/opfFurniture5.xml, ppt/tags/opfFurniture6.xml, ppt/tags/opfFurniture7.xml, ppt/tags/opfFurniture8.xml, ppt/tags/opfFurniture9.xml, ppt/tags/opfFurnitureSlide0.xml, ppt/tags/opfFurnitureSlide1.xml, ppt/tags/opfFurnitureSlide2.xml, ppt/tags/opfHeading1.xml, ppt/tags/opfHeading2.xml, ppt/tags/opfHeading3.xml, ppt/tags/opfText1.xml, ppt/tags/opfText2.xml
  - changed: [Content_Types].xml, _rels/.rels, docProps/app.xml, docProps/core.xml, ppt/_rels/presentation.xml.rels, ppt/notesMasters/_rels/notesMaster1.xml.rels, ppt/notesMasters/notesMaster1.xml, ppt/notesSlides/_rels/notesSlide1.xml.rels, ppt/notesSlides/_rels/notesSlide2.xml.rels, ppt/notesSlides/_rels/notesSlide3.xml.rels, ppt/presProps.xml, ppt/presentation.xml, ppt/slideLayouts/slideLayout1.xml, ppt/slideMasters/_rels/slideMaster1.xml.rels, ppt/slideMasters/slideMaster1.xml, ppt/slides/_rels/slide1.xml.rels, ppt/slides/_rels/slide2.xml.rels, ppt/slides/_rels/slide3.xml.rels, ppt/slides/slide1.xml, ppt/slides/slide2.xml, ppt/slides/slide3.xml, ppt/theme/theme1.xml, ppt/theme/theme2.xml
- p:presentation attributes: {"source":"<p:presentation firstSlideNum=\"1\"  saveSubsetFonts=\"1\" autoCompressPictures=\"0\">","saved":"<p:presentation saveSubsetFonts=\"1\" autoCompressPictures=\"0\">"}

## furniture / edit

PowerPoint 16.0 build 20430.

- WARN png: slide 1 0.53 % pixels differ

What PowerPoint rewrote:

- HeadersFooters: {"slide":1,"source":{"footerVisible":-1,"footerText":"Footer original text","slideNumberVisible":-1,"dateVisible":-1,"dateUseFormat":-1,"dateFormat":1},"saved":{"footerVisible":-1,"footerText":"Footer edited natively","slideNumberVisible":-1,"dateVisible":-1,"dateUseFormat":-1,"dateFormat":1}}
- field cached text: {"slide":1,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- field cached text: {"slide":2,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- field cached text: {"slide":3,"type":"datetime1","source":"10/5/2026","saved":"10/6/2026"}
- masters p:hf: {"source":["<p:hf sldNum=\"1\" hdr=\"0\" ftr=\"1\" dt=\"1\"/>"],"saved":["<p:hf hdr=\"0\"/>"]}
- layouts p:hf: {"source":["<p:hf sldNum=\"1\" hdr=\"0\" ftr=\"1\" dt=\"1\"/>"],"saved":["<p:hf hdr=\"0\"/>"]}
- package parts: 22 added, 22 removed, 23 changed, 6 byte-identical
  - added: ppt/media/image1.png, ppt/tags/tag1.xml, ppt/tags/tag10.xml, ppt/tags/tag11.xml, ppt/tags/tag12.xml, ppt/tags/tag13.xml, ppt/tags/tag14.xml, ppt/tags/tag15.xml, ppt/tags/tag16.xml, ppt/tags/tag17.xml, ppt/tags/tag18.xml, ppt/tags/tag19.xml, ppt/tags/tag2.xml, ppt/tags/tag20.xml, ppt/tags/tag21.xml, ppt/tags/tag3.xml, ppt/tags/tag4.xml, ppt/tags/tag5.xml, ppt/tags/tag6.xml, ppt/tags/tag7.xml, ppt/tags/tag8.xml, ppt/tags/tag9.xml
  - removed: ppt/media/image-1-1.png, ppt/tags/opfDocument.xml, ppt/tags/opfFurniture1.xml, ppt/tags/opfFurniture10.xml, ppt/tags/opfFurniture11.xml, ppt/tags/opfFurniture12.xml, ppt/tags/opfFurniture2.xml, ppt/tags/opfFurniture3.xml, ppt/tags/opfFurniture4.xml, ppt/tags/opfFurniture5.xml, ppt/tags/opfFurniture6.xml, ppt/tags/opfFurniture7.xml, ppt/tags/opfFurniture8.xml, ppt/tags/opfFurniture9.xml, ppt/tags/opfFurnitureSlide0.xml, ppt/tags/opfFurnitureSlide1.xml, ppt/tags/opfFurnitureSlide2.xml, ppt/tags/opfHeading1.xml, ppt/tags/opfHeading2.xml, ppt/tags/opfHeading3.xml, ppt/tags/opfText1.xml, ppt/tags/opfText2.xml
  - changed: [Content_Types].xml, _rels/.rels, docProps/app.xml, docProps/core.xml, ppt/_rels/presentation.xml.rels, ppt/notesMasters/_rels/notesMaster1.xml.rels, ppt/notesMasters/notesMaster1.xml, ppt/notesSlides/_rels/notesSlide1.xml.rels, ppt/notesSlides/_rels/notesSlide2.xml.rels, ppt/notesSlides/_rels/notesSlide3.xml.rels, ppt/presProps.xml, ppt/presentation.xml, ppt/slideLayouts/slideLayout1.xml, ppt/slideMasters/_rels/slideMaster1.xml.rels, ppt/slideMasters/slideMaster1.xml, ppt/slides/_rels/slide1.xml.rels, ppt/slides/_rels/slide2.xml.rels, ppt/slides/_rels/slide3.xml.rels, ppt/slides/slide1.xml, ppt/slides/slide2.xml, ppt/slides/slide3.xml, ppt/theme/theme1.xml, ppt/theme/theme2.xml
- p:presentation attributes: {"source":"<p:presentation firstSlideNum=\"1\"  saveSubsetFonts=\"1\" autoCompressPictures=\"0\">","saved":"<p:presentation saveSubsetFonts=\"1\" autoCompressPictures=\"0\">"}

Edit versus control (parts that differ): docProps/core.xml, ppt/slides/slide1.xml
