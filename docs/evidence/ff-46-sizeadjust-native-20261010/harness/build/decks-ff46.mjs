// FF-46 / RR-17 (opf#323 section 3): script, visual and code-table families, ONE FAMILY PER DECK (set 2 design, avoiding opf-pptx#168),
// regenerated on the published 0.18 packages because the native PNGs of the 0.12 runs were not kept.
// Slide 1 shows the family's FF-44 corpus samples as single lines; slide 2 is a wrapping paragraph (line breaks). The text is the
// original OPF corpus (opf-render test/fixtures/script-corpora.json, MIT), copied in ../measure/script-corpora.json.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {defaultCatalog} from '@openpresentation/opf/catalog';
import {ROOT} from './lib.mjs';

const S = 'https://openpresentation.org/schema/opf/v1';
const corpora = JSON.parse(readFileSync(path.join(ROOT, 'measure', 'script-corpora.json'), 'utf8'));
const schemes = Object.entries(defaultCatalog.fontSchemes).map(([id, record]) => ({...record, id: record.id ?? id}));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SCRIPT_OF = {ja: 'Jpan', 'zh-Hans': 'Hans', 'zh-Hant': 'Hant', ko: 'Kore', ar: 'Arab', ur: 'Arab', fa: 'Arab', he: 'Hebr', hi: 'Deva', bn: 'Beng', 'pa-Guru': 'Guru', gu: 'Gujr', or: 'Orya', ta: 'Taml', te: 'Telu', kn: 'Knda', ml: 'Mlym', th: 'Thai', km: 'Khmr', am: 'Ethi', hy: 'Armn', ka: 'Geor'};
const NO_SPACES = new Set(['Jpan', 'Hans', 'Hant', 'Thai', 'Khmr', 'Laoo']);

// [family, language, status] in the order of the 2026-10-05 set (scripts-01 .. scripts-42), plus BatangChe and GungsuhChe on their own decks.
const SCRIPT_DECKS = [
  ['Meiryo', 'ja'], ['Yu Gothic', 'ja'], ['MS Gothic', 'ja'], ['MS Mincho', 'ja'],
  ['Microsoft YaHei', 'zh-Hans'], ['SimSun', 'zh-Hans'], ['SimHei', 'zh-Hans'], ['FangSong', 'zh-Hans'],
  ['Microsoft JhengHei', 'zh-Hant'], ['MingLiU', 'zh-Hant'], ['PMingLiU', 'zh-Hant'],
  ['Malgun Gothic', 'ko'], ['Batang', 'ko'], ['BatangChe', 'ko'], ['Gungsuh', 'ko'], ['GungsuhChe', 'ko'],
  ['Arabic Typesetting', 'ar'], ['Traditional Arabic', 'ar'], ['Sakkal Majalla', 'ar'], ['Sakkal Majalla', 'ur'], ['Sakkal Majalla', 'fa'],
  ['David', 'he'], ['Gisha', 'he'], ['Miriam', 'he'],
  ['Mangal', 'hi'], ['Aparajita', 'hi'], ['Nirmala UI', 'hi'],
  ['Vrinda', 'bn'], ['Shonar Bangla', 'bn'], ['Raavi', 'pa-Guru'], ['Shruti', 'gu'], ['Kalinga', 'or'], ['Latha', 'ta'], ['Gautami', 'te'], ['Tunga', 'kn'], ['Kartika', 'ml'],
  ['Angsana New', 'th'], ['DilleniaUPC', 'th'], ['DaunPenh', 'km'], ['Khmer UI', 'km'], ['Nyala', 'am'], ['Ebrima', 'am'], ['Sylfaen', 'hy'], ['Sylfaen', 'ka'],
];

function samplesFor(language) {
  const script = SCRIPT_OF[language];
  const group = corpora.groups.find(g => g.script === script);
  const base = language.split('-')[0];
  // The deck's own language first (Urdu and Persian decks take their own samples), then the rest of the script group.
  const own = group.samples.filter(s => s.lang === language || s.lang === base);
  const rest = group.samples.filter(s => !own.includes(s));
  return {script, group, samples: [...own, ...rest]};
}

function scriptDeck(family, language, index) {
  const {script, samples} = samplesFor(language);
  const record = schemes.find(r => r.major === family && r.minor === family);
  // No catalog record (MS Gothic, SimHei, Batang, BatangChe, Gungsuh, GungsuhChe, Ebrima): name the family in the Latin pair AND the
  // script slot, otherwise the language's default script font (Meiryo, Microsoft YaHei, Malgun Gothic) would draw the script text.
  const slot = ['Jpan', 'Hans', 'Hant', 'Kore'].includes(script) ? 'eastAsian' : 'complexScript';
  const fontScheme = record ? record.id : {major: family, minor: family, ...(['Ethi', 'Armn', 'Geor'].includes(script) ? {} : {[slot]: {major: family, minor: family}})};
  const lines = samples.slice(0, 5).map(s => s.text);
  const joiner = NO_SPACES.has(script) ? '' : ' ';
  const paragraph = Array.from({length: 3}, () => samples.slice(0, 6).map(s => s.text).join(joiner)).join(joiner);
  const title = record?.textSample ?? samples[0].text;
  const id = `scripts-${String(index + 1).padStart(2, '0')}-${slug(language)}-${slug(family)}`;
  return {
    id, family, language, script, status: 'script-gap',
    deck: {$schema: S, name: `FF-46 ${family} (${language})`, language, design: {fontScheme}, slides: [
      {title, items: lines},
      {title: family, text: paragraph},
    ]},
    slides: [{slide: 1, kind: 'samples', wrap: false, corpus: samples.slice(0, 5).map(s => s.id)}, {slide: 2, kind: 'line-breaks', wrap: true, corpus: samples.slice(0, 6).map(s => s.id)}],
    fontScheme,
  };
}

// FF-45 code-table families: codes U+F0xx (private use) and their Windows-1252 characters, in runs of the symbol family inside a Calibri deck.
const pua = (from, to) => { const out = []; for (let c = from; c <= to; c++) out.push(String.fromCodePoint(c)); return out; };
const rows = (chars, per = 16) => Array.from({length: Math.ceil(chars.length / per)}, (_, i) => chars.slice(i * per, i * per + per).join(' '));
function symbolDeck(family, id) {
  const run = text => [{text, fontFamily: family}];
  const ascii = pua(0x21, 0x7e);
  const slides = [
    {title: `${family} F021 to F05F`, items: rows(pua(0xf021, 0xf05f)).map(run)},
    {title: `${family} F060 to F09F`, items: rows(pua(0xf060, 0xf09f)).map(run)},
    {title: `${family} F0A0 to F0FF`, items: rows(pua(0xf0a1, 0xf0ff)).map(run)},
    {title: `${family} plain forms`, items: rows(ascii).map(run)},
    {title: `${family} inside Calibri text`, items: [['Status ', {text: '', fontFamily: family}, ' done and ', {text: '', fontFamily: family}, ' open'], ['Phone ', {text: '', fontFamily: family}, ' and mail ', {text: '', fontFamily: family}]]},
  ];
  return {id, family, language: 'en-US', script: 'Zsym', status: 'code-table', deck: {$schema: S, name: `FF-46 ${family}`, language: 'en-US', design: {fontScheme: 'calibri'}, slides},
    slides: slides.map((_, i) => ({slide: i + 1, kind: i < 4 ? 'code-table' : 'mixed', wrap: false})), runFamily: family};
}

const EMOJI = ['😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇', '👍 👍🏻 👍🏽 👍🏿 👋 👏 🙌 🙏 💪 ✌️', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 ⭐ ✨', '🇺🇸 🇯🇵 🇩🇪 🇧🇷 🇮🇳 🇿🇦 🏳️‍🌈 🏴‍☠️', '👨‍👩‍👧‍👦 👩‍💻 🧑‍🚀 👨‍🔬 1️⃣ 2️⃣ #️⃣ ©️ ®️ ™️'];
const MATH = ['∑ᵢ₌₁ⁿ xᵢ² ≤ ∫₀^∞ e^(−x) dx', 'α β γ δ ε θ λ μ π σ φ ω Γ Δ Θ Λ Π Σ Φ Ω', '∀x ∈ ℝ, ∃y ∈ ℕ : x < y ⇒ ¬(y ≤ x)', '√2 ≈ 1.414, ∛8 = 2, ∞ − ∞ ≠ 0, ∂f/∂x', 'A ∪ B ⊆ C, A ∩ ∅ = ∅, ℤ ⊂ ℚ ⊂ ℝ ⊂ ℂ'];
const VISUAL = [
  {id: 'emoji-math-01-segoe-ui-emoji', family: 'Segoe UI Emoji', status: 'visual-gap', script: 'Zsye', language: 'en-US',
    deck: {$schema: S, name: 'FF-46 Segoe UI Emoji', language: 'en-US', slides: [
      {title: 'Segoe UI Emoji', items: EMOJI.map(text => [{text, fontFamily: 'Segoe UI Emoji'}])},
      {title: 'Emoji with Latin text', items: [['Launch ', {text: '🚀', fontFamily: 'Segoe UI Emoji'}, ' on time ', {text: '✅', fontFamily: 'Segoe UI Emoji'}], ['Risk ', {text: '⚠️', fontFamily: 'Segoe UI Emoji'}, ' and owner ', {text: '👩‍💼', fontFamily: 'Segoe UI Emoji'}]]},
      {title: 'Emoji paragraph', text: [{text: EMOJI.join(' '), fontFamily: 'Segoe UI Emoji'}]},
    ]}, slides: [{slide: 1, kind: 'samples', wrap: false}, {slide: 2, kind: 'mixed', wrap: false}, {slide: 3, kind: 'line-breaks', wrap: true}], runFamily: 'Segoe UI Emoji'},
  {id: 'emoji-math-02-cambria-math', family: 'Cambria Math', status: 'visual-gap', script: 'Zmth', language: 'en-US',
    deck: {$schema: S, name: 'FF-46 Cambria Math', language: 'en-US', design: {fontScheme: {major: 'Cambria Math', minor: 'Cambria Math'}}, slides: [
      {title: 'Cambria Math', items: MATH},
      {title: 'Math paragraph', text: Array.from({length: 2}, () => MATH.join('; ')).join(' ')},
    ]}, slides: [{slide: 1, kind: 'samples', wrap: false}, {slide: 2, kind: 'line-breaks', wrap: true}]},
  {id: 'emoji-math-03-emoji-in-aptos-deck', family: 'Segoe UI Emoji', status: 'visual-gap', script: 'Zsye', language: 'en-US', probe: true,
    deck: {$schema: S, name: 'FF-46 emoji in Aptos', language: 'en-US', slides: [
      {title: 'Emoji in the default deck 🎉', items: EMOJI.slice(0, 3)},
      {title: 'Mixed', items: ['Shipped ✅ on Friday', 'Two risks ⚠️ remain']},
    ]}, slides: [{slide: 1, kind: 'samples', wrap: false}, {slide: 2, kind: 'mixed', wrap: false}],
    note: 'Probe: no family chosen for emoji; PowerPoint picks its own emoji font. Names are reported, not counted for Segoe UI Emoji.'},
];

export const FF46 = [
  ...SCRIPT_DECKS.map(([family, language], i) => scriptDeck(family, language, i)),
  symbolDeck('Wingdings', 'symbol-01-wingdings'), symbolDeck('Webdings', 'symbol-02-webdings'), symbolDeck('Symbol', 'symbol-03-symbol'),
  ...VISUAL,
];
