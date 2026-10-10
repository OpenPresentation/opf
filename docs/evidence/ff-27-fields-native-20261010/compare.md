# FF-27 native compare (0.18)

Generated 2026-10-10T21:50:11.217Z by `compare.mjs` from the native read-outs of `native/attempt-1`. Packages: `@openpresentation/opf` 0.18.1, `@openpresentation/opf-render` 0.18.0, `@openpresentation/opf-pptx` 0.18.0, `@openpresentation/opf-editor` 0.18.0, `fontkit` 2.0.4. PowerPoint 16.0 build 20430, Microsoft Windows NT 10.0.26200.0, culture en-US.

## FF-27

Criterion: After Slides(1).Duplicate() and Slides(last).MoveTo(1), in memory, every slide-number field reads its new position, and every live date field reads the host date in the chosen en-US format (never the cached export date).

**2 PASS, 0 FAIL, 0 not run** of 2.

### 01-footer-fields: PASS

footer: left date:true MMMM d, yyyy (datetime4, the dt placeholder), center text (ftr), right {{slide.number}} (sldNum)

Date field: format `MMMM d, yyyy`, host date 2026-10-10 (en-US), expected "October 10, 2026", cached at export "January 15, 2026"; HeadersFooters.DateAndTime.Format 4 (expected 4 where the date is the dt placeholder).

| Step | Operation | Order | Slide numbers read | Numbers follow order | Date text | Date ok |
| --- | --- | --- | --- | --- | --- | --- |
| initial | - | Alpha, Bravo, Charlie, Delta, Echo | 1; 2; 3; 4; 5 | yes | October 10, 2026 | yes |
| after-duplicate | Slides(1).Duplicate() | Alpha, Alpha, Bravo, Charlie, Delta, Echo | 1; 2; 3; 4; 5; 6 | yes | October 10, 2026 | yes |
| after-move | Slides(6).MoveTo(1) | Echo, Alpha, Alpha, Bravo, Charlie, Delta | 1; 2; 3; 4; 5; 6 | yes | October 10, 2026 | yes |

### 02-header-forms: PASS

the other 0.18 forms: header left "Page {{slide.number}} of {{deck.slideCount}}" (field inside fixed words, a tagged header shape), header right date:true default M/d/yyyy (datetime1), footer right "A-{{slide.number}}" (sldNum with fixed prefix)

Date field: format `M/d/yyyy`, host date 2026-10-10 (en-US), expected "10/10/2026", cached at export "1/15/2026"; HeadersFooters.DateAndTime.Format 14 (expected 1 where the date is the dt placeholder).

| Step | Operation | Order | Slide numbers read | Numbers follow order | Date text | Date ok |
| --- | --- | --- | --- | --- | --- | --- |
| initial | - | Alpha, Bravo, Charlie, Delta, Echo | Page 1 of 5 / A-1; Page 2 of 5 / A-2; Page 3 of 5 / A-3; Page 4 of 5 / A-4; Page 5 of 5 / A-5 | yes | 10/10/2026 | yes |
| after-duplicate | Slides(1).Duplicate() | Alpha, Alpha, Bravo, Charlie, Delta, Echo | Page 1 of 5 / A-1; Page 2 of 5 / A-2; Page 3 of 5 / A-3; Page 4 of 5 / A-4; Page 5 of 5 / A-5; Page 6 of 5 / A-6 | yes | 10/10/2026 | yes |
| after-move | Slides(6).MoveTo(1) | Echo, Alpha, Alpha, Bravo, Charlie, Delta | Page 1 of 5 / A-1; Page 2 of 5 / A-2; Page 3 of 5 / A-3; Page 4 of 5 / A-4; Page 5 of 5 / A-5; Page 6 of 5 / A-6 | yes | 10/10/2026 | yes |
