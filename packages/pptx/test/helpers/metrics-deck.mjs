// FR-07, part 3: decks of metrics without a gauge (every metric form: plain, a unit, a change and a trend with its sentiment, a number
// format, a data link, tiles, a right-to-left deck). A metric without `gauge` draws and exports byte for byte as before the gauge; the
// test fr-07-gauge-unchanged.mjs pins the bytes these decks exported at 572449431, before the gauge landed.
const ops = {columns: ['Week', {name: 'Utilization', format: '0%'}], rows: [['W45', 0.64], ['W46', 0.68], ['W47', 0.72]]};
const metrics = [
  {label: 'Revenue', value: 1284300, unit: 'USD', description: 'Recognized in Q3.'},
  {label: 'Retention', value: '94%', delta: '+2 pts', trend: 'up'},
  {label: 'Latency', value: 182, unit: 'ms', delta: -12, trend: 'down', sentiment: 'positive'},
  {label: 'Gross margin', value: 0.724, format: '0.0%', delta: 0.012, trend: 'up'},
  {label: 'Utilization', value: 0.72, data: {dataset: 'ops', field: 'Utilization', aggregate: 'last', delta: {compare: 'previous'}}},
];
export const metricsDeck = {
  metrics: {
    name: 'Metrics', language: 'en-US', design: {theme: 'classic'}, datasets: {ops},
    slides: [
      ...metrics.map((metric, index) => ({title: `Metric ${index + 1}`, metric})),
      {title: 'Scorecard', layout: 'scorecard', blocks: metrics.slice(0, 4).map(metric => ({metric}))},
      {title: 'Two metrics', blocks: metrics.slice(1, 3).map(metric => ({metric}))},
    ],
  },
  rtl: {
    name: 'Metrics right to left', language: 'ar', design: {theme: 'classic'},
    slides: [{title: 'الإيرادات', metric: {label: 'الإيرادات', value: 1284300, delta: '+4%', trend: 'up'}}],
  },
};
