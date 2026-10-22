// FA-30: the representative slide of test/preview-a11y.mjs and test/preview-a11y-browser.mjs: a tag, title and subtitle, body text with a
// footnote, a list, a quote, a metric with a trend, a picture with alt, a picture with alt "", a chart with alt, a table, and header and
// footer text, on the plain slide background.
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const data = { columns: ['Quarter', 'North', 'South'], rows: [['Q1', 10, 5], ['Q2', 20, 8]] };

export const previewA11yDeck = () => ({
  design: { fontScheme: 'roboto' },
  slides: [{
    title: 'Quarterly review', subtitle: 'Sales Q2', tag: 'Draft',
    blocks: [
      { type: 'text', text: ['Body paragraph with a note', { text: '.', footnote: 'An inline note.' }] },
      { type: 'list', items: ['First point', 'Second point'] },
      { type: 'quote', quote: { text: 'A memorable quote', attribution: 'Ada' } },
      { type: 'metric', metric: { value: '42%', label: 'Growth', trend: 'up' } },
      { type: 'image', image: { src: png, alt: 'A harbour' } },
      { type: 'image', image: { src: png, alt: '' } },
      { type: 'chart', chart: { type: 'column', alt: 'North leads', data } },
      { type: 'table', table: { columns: ['Col A', 'Col B'], rows: [['cell x', 'cell y']] } }
    ],
    design: { footer: { center: { text: 'Footer text' } }, header: { left: { text: 'Header text' } } }
  }]
});
