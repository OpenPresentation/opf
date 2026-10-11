// FF-27 (opf#323 section 2): fields renumber and update natively, in the 0.17/0.18 furniture forms (FA-31): generated values are
// `{{ }}` variables inside a zone's `text`, and `date: true` with a `dateFormat` is a native current-date field. The exporter is given
// the host date EXPORT_DATE (2026-01-15, a past date on purpose), so the cached field text is that date; a live field must read the
// clock natively, a static one would keep the cached text.
const S = 'https://openpresentation.org/schema/opf/v1';
const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
const slides = names.map((name, i) => ({title: `${name} slide`, text: `Slide ${i + 1} of the FF-27 field check. Furniture: date, text and slide number.`}));

export const FF27 = [
  {id: '01-footer-fields', covers: 'footer: left date:true MMMM d, yyyy (datetime4, the dt placeholder), center text (ftr), right {{slide.number}} (sldNum)',
    deck: {$schema: S, name: 'FF-27 footer fields', language: 'en-US', design: {footer: {
      left: {date: true, dateFormat: 'MMMM d, yyyy'},
      center: {text: 'FF-27 fields check'},
      right: {text: '{{slide.number}}'},
    }}, slides},
    fields: {slideNumber: {format: '{n}'}, date: {format: 'MMMM d, yyyy', fieldType: 'datetime4', ppFormat: 4}}},
  {id: '02-header-forms', covers: 'the other 0.18 forms: header left "Page {{slide.number}} of {{deck.slideCount}}" (field inside fixed words, a tagged header shape), header right date:true default M/d/yyyy (datetime1), footer right "A-{{slide.number}}" (sldNum with fixed prefix)',
    deck: {$schema: S, name: 'FF-27 header forms', language: 'en-US', design: {
      header: {left: {text: 'Page {{slide.number}} of {{deck.slideCount}}'}, right: {date: true}},
      footer: {right: {text: 'A-{{slide.number}}'}},
    }, slides},
    fields: {slideNumber: {format: 'Page {n} of 5', alsoFooter: 'A-{n}'}, date: {format: 'M/d/yyyy', fieldType: 'datetime1', ppFormat: 1}},
    note: '{{deck.slideCount}} is fixed text (PowerPoint has no slide-count field): after the in-memory insert it still reads 5, by design.'},
];
