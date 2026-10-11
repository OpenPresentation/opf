// RR-05 / FF-12 (opf#323 section 1): the bounded native font sample, at most 12 decks, re-run on the published 0.18 packages.
// Same twelve decks as rr-05-ff-12-native-20261005 so the result compares across releases. Each entry lists the families the deck
// CHOSE: `required` are families its runs draw (Presentation.Fonts must list them), `soft` are theme-only script families that the
// accepted 2026-10-05 reading lets PowerPoint leave out of Presentation.Fonts, and any other name fails (FF-12 criterion).
const S = 'https://openpresentation.org/schema/opf/v1';
const chart = {type: 'column', data: {columns: ['Quarter', 'Revenue', 'Cost'], rows: [['Q1', 12, 9], ['Q2', 15, 10], ['Q3', 18, 11], ['Q4', 21, 12]]}};
const table = {columns: ['Region', 'Owner', 'Status'], rows: [['North', 'Avery', 'On track'], ['South', 'Blake', 'Watch'], ['West', 'Casey', 'At risk']]};
const code = {source: 'const score = urgency * confidence;\nif (score >= threshold) {\n  route(item);\n}', language: 'ts'};
const latinContent = (extra = {}) => [
  {title: 'Quarterly review', subtitle: 'Font sample deck', notes: 'Speaker notes on the cover: open with the decision.', ...extra},
  {title: 'What changed', items: ['Revenue grew in every region', 'Costs held flat', 'Two risks remain open'], notes: 'Notes on a bullet slide.'},
  {title: 'Decision rule', code},
  {title: 'Revenue and cost', chart, notes: 'Notes on the chart slide.'},
  {title: 'Owners', table},
];

export const FF12 = [
  {id: '01-carlito-code-chart-table-notes', covers: 'Carlito with code, chart, table and notes; no code family, so code uses the documented code fallback',
    deck: {$schema: S, name: 'FF-12 Carlito', language: 'en-US', design: {fontScheme: {major: 'Carlito', minor: 'Carlito'}}, slides: latinContent()},
    chosen: ['Carlito'], codeFallback: true},
  {id: '02-carlito-code-family-carlito', covers: 'the same content with fontScheme.code Carlito: the deck names Carlito only',
    deck: {$schema: S, name: 'FF-12 Carlito code', language: 'en-US', design: {fontScheme: {major: 'Carlito', minor: 'Carlito', code: 'Carlito'}}, slides: latinContent()},
    chosen: ['Carlito']},
  {id: '03-default-aptos', covers: 'the default scheme (no fontScheme: engine default aptos)',
    deck: {$schema: S, name: 'FF-12 default', language: 'en-US', slides: latinContent().slice(0, 3)},
    chosen: ['Aptos', 'Aptos Display'], codeFallback: true},
  {id: '04-ja-meiryo', covers: 'Japanese with the Meiryo scheme (re-runs lang-ja-meiryo, the 2026-10-02 Aptos failure)',
    deck: {$schema: S, name: 'FF-12 Japanese', language: 'ja', design: {fontScheme: 'meiryo'}, slides: [
      {title: '四半期レビュー', subtitle: 'メイリオのサンプル', notes: '表紙のノート。'},
      {title: '変更点', items: ['すべての地域で売上が増加', 'コストは横ばい', '二つのリスクが残る'], notes: '箇条書きのノート。'},
      {title: '担当者', table: {columns: ['地域', '担当', '状況'], rows: [['北', '佐藤', '順調'], ['南', '鈴木', '注意']]}},
    ]}, chosen: ['Meiryo']},
  {id: '05-ar-rtl', covers: 'Arabic, right to left (language ar: its scheme arabic-typesetting)',
    deck: {$schema: S, name: 'FF-12 Arabic', language: 'ar', slides: [
      {title: 'مراجعة ربع سنوية', subtitle: 'عينة الخطوط', notes: 'ملاحظات الغلاف.'},
      {title: 'ما الذي تغير', items: ['نمت الإيرادات في كل المناطق', 'بقيت التكاليف ثابتة', 'تبقى مخاطرتان'], notes: 'ملاحظات النقاط.'},
      {title: 'الإيرادات', chart: {type: 'column', data: {columns: ['الربع', 'الإيرادات'], rows: [['الأول', 12], ['الثاني', 15], ['الثالث', 18]]}}},
    ]}, chosen: ['Aptos', 'Aptos Display', 'Arabic Typesetting'], scriptSoft: true},
  {id: '06-monospace-consolas', covers: 'a monospace scheme (Consolas)',
    deck: {$schema: S, name: 'FF-12 monospace', language: 'en-US', design: {fontScheme: 'consolas'}, slides: latinContent().slice(0, 3)},
    chosen: ['Consolas']},
  {id: '07-per-slide-override', covers: 'a per-slide override: Calibri deck, Georgia on slide 2, Courier New on slide 4',
    deck: {$schema: S, name: 'FF-12 per-slide', language: 'en-US', design: {fontScheme: 'calibri'}, slides: [
      {title: 'Deck in Calibri', subtitle: 'Per-slide font override'},
      {title: 'This slide in Georgia', items: ['Serif override on one slide'], design: {fontScheme: 'georgia'}},
      {title: 'Back to Calibri', items: ['The deck scheme again']},
      {title: 'This slide in Courier New', items: ['Monospace override on one slide'], design: {fontScheme: 'courier-new'}},
    ]}, chosen: ['Calibri', 'Georgia', 'Courier New'], perSlide: {1: ['Calibri'], 2: ['Georgia'], 3: ['Calibri'], 4: ['Courier New']}},
  {id: '08-cjk-in-latin', covers: 'CJK inside a Latin deck: Japanese and Chinese words in an English Aptos deck',
    deck: {$schema: S, name: 'FF-12 CJK in Latin', language: 'en-US', slides: [
      {title: 'Tokyo office 東京オフィス', subtitle: 'Mixed script sample'},
      {title: 'Regions', items: ['Japan: 日本の売上が増加', 'China: 中国市场保持稳定', 'Latin text around 漢字 and かな']},
    ]}, chosen: ['Aptos', 'Aptos Display'], scriptFromExport: true},
  {id: '09-ko-malgun', covers: 'Korean with the Malgun Gothic scheme',
    deck: {$schema: S, name: 'FF-12 Korean', language: 'ko', design: {fontScheme: 'malgun-gothic'}, slides: [
      {title: '분기 검토', subtitle: '맑은 고딕 샘플'},
      {title: '변경 사항', items: ['모든 지역에서 매출 증가', '비용은 유지', '두 가지 위험이 남음']},
    ]}, chosen: ['Malgun Gothic']},
  {id: '10-hi-mangal', covers: 'Hindi (language hi: its scheme mangal)',
    deck: {$schema: S, name: 'FF-12 Hindi', language: 'hi', slides: [
      {title: 'तिमाही समीक्षा', subtitle: 'फ़ॉन्ट नमूना'},
      {title: 'क्या बदला', items: ['हर क्षेत्र में राजस्व बढ़ा', 'लागत स्थिर रही']},
    ]}, chosen: ['Aptos', 'Aptos Display', 'Mangal'], scriptSoft: true},
  {id: '11-he-rtl', covers: 'Hebrew, right to left (language he: its scheme david)',
    deck: {$schema: S, name: 'FF-12 Hebrew', language: 'he', slides: [
      {title: 'סקירה רבעונית', subtitle: 'דוגמת גופנים'},
      {title: 'מה השתנה', items: ['ההכנסות גדלו בכל האזורים', 'העלויות נשארו יציבות']},
    ]}, chosen: ['Aptos', 'Aptos Display', 'David'], scriptSoft: true},
  {id: '12-serif-georgia', covers: 'a serif scheme (Georgia)',
    deck: {$schema: S, name: 'FF-12 serif', language: 'en-US', design: {fontScheme: 'georgia'}, slides: latinContent().slice(0, 2)},
    chosen: ['Georgia']},
];
