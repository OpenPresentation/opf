// Cardinal word references for the six existing European title profiles. Integer words only, through 999,999,999.
// Compact rules checked against Unicode CLDR SpelloutRules: https://github.com/unicode-org/cldr/tree/main/common/rbnf.
// We parse a complete contiguous number phrase; a malformed or unsupported fraction must not become a shorter, wrong reference.
import type {TitleReferenceNumber} from './chart-title-numbers.js';

type Language = 'de' | 'fr' | 'es' | 'it' | 'pt' | 'nl';
const SMALL: Record<Language, readonly string[]> = {
  de: 'null eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn vierzehn fünfzehn sechzehn siebzehn achtzehn neunzehn'.split(' '),
  fr: 'zéro un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze quinze seize'.split(' '),
  es: 'cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciséis diecisiete dieciocho diecinueve veinte veintiuno veintidós veintitrés veinticuatro veinticinco veintiséis veintisiete veintiocho veintinueve'.split(' '),
  it: 'zero uno due tre quattro cinque sei sette otto nove dieci undici dodici tredici quattordici quindici sedici diciassette diciotto diciannove'.split(' '),
  pt: 'zero um dois três quatro cinco seis sete oito nove dez onze doze treze catorze quinze dezesseis dezessete dezoito dezenove'.split(' '),
  nl: 'nul een twee drie vier vijf zes zeven acht negen tien elf twaalf dertien veertien vijftien zestien zeventien achttien negentien'.split(' '),
};
const TENS: Record<Language, readonly string[]> = {
  de: ['','','zwanzig','dreißig','vierzig','fünfzig','sechzig','siebzig','achtzig','neunzig'],
  fr: ['','','vingt','trente','quarante','cinquante','soixante'],
  es: ['','','veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'],
  it: ['','','venti','trenta','quaranta','cinquanta','sessanta','settanta','ottanta','novanta'],
  pt: ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'],
  nl: ['','','twintig','dertig','veertig','vijftig','zestig','zeventig','tachtig','negentig'],
};
const HUNDREDS = {
  es: ['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'],
  pt: ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'],
};
const normalize = (text: string): string => text.normalize('NFKC').toLowerCase().replace(/[\s\-‐‑\u00ad]/gu, '');

/** Standard cardinal form below one thousand; the reverse vocabulary also records grammatical gender and regional spellings. */
function groupWords(language: Language, n: number): string {
  const small = SMALL[language];
  if (small[n]) return small[n]!;
  if (language === 'fr' && n < 20) return `dix-${small[n - 10]}`;
  if (n >= 100) {
    const h = Math.floor(n / 100), r = n % 100, tail = r ? groupWords(language, r) : '';
    switch (language) {
      case 'de': return `${h === 1 ? 'ein' : small[h]}hundert${tail}`;
      case 'nl': return `${h === 1 ? '' : small[h]}honderd${tail}`;
      case 'it': return `${h === 1 ? '' : small[h]}${r === 8 || Math.floor(r / 10) === 8 ? 'cent' : 'cento'}${tail}`;
      case 'fr': return `${h === 1 ? '' : `${small[h]} `}cent${!r && h > 1 ? 's' : ''}${r ? ` ${tail}` : ''}`;
      case 'es': return n === 100 ? 'cien' : `${HUNDREDS.es[h]}${r ? ` ${tail}` : ''}`;
      case 'pt': return n === 100 ? 'cem' : `${HUNDREDS.pt[h]}${r ? ` e ${tail}` : ''}`;
    }
  }
  const t = Math.floor(n / 10), u = n % 10, tens = TENS[language];
  switch (language) {
    case 'de': return `${u ? `${u === 1 ? 'ein' : small[u]}und` : ''}${tens[t]}`;
    case 'nl': return `${u ? `${small[u]}${u === 2 || u === 3 ? 'ën' : 'en'}` : ''}${tens[t]}`;
    case 'it': return `${u === 1 || u === 8 ? tens[t]!.slice(0, -1) : tens[t]}${u ? u === 3 ? 'tré' : small[u] : ''}`;
    case 'es': return `${tens[t]}${u ? ` y ${small[u]}` : ''}`;
    case 'pt': return `${tens[t]}${u ? ` e ${small[u]}` : ''}`;
    case 'fr': {
      if (n >= 80) return `quatre-vingt${n === 80 ? 's' : `-${groupWords(language, n - 80)}`}`;
      const base = n >= 70 ? 60 : t * 10, rest = n - base;
      return `${tens[base / 10]}${rest ? `${rest === 1 || rest === 11 ? '-et' : ''}-${groupWords(language, rest)}` : ''}`;
    }
  }
}
interface Vocabulary {groups: Map<string, number>; tokens: Set<string>}
const cache = new Map<Language, Vocabulary>();
function vocabulary(language: Language): Vocabulary {
  const prior = cache.get(language);
  if (prior) return prior;
  const groups = new Map<string, number>(), tokens = new Set<string>();
  const add = (word: string, value: number) => {
    groups.set(normalize(word), value);
    for (const token of word.split(/[\s-]+/)) tokens.add(normalize(token));
  };
  for (let n = 0; n < 1000; n++) {
    const word = groupWords(language, n); add(word, n);
    if (language === 'de') {add(word.replace(/eins$/u, 'ein'), n); add(word.replace(/eins$/u, 'eine'), n);}
    if (language === 'it') {add(word.replace(/tré$/u, 'tre'), n); add(word.replace(/uno$/u, 'un'), n);}
    if (language === 'de' && n >= 100 && n < 200) add(word.replace(/^ein/u, ''), n);
    if (language === 'de' && n === 1) for (const alias of ['ein','eine','einen','einem','einer','eines']) add(alias, n);
    if (language === 'fr') {
      add(word.replace(/un$/u, 'une'), n);
      // A scale following an exact hundred or eighty suppresses its final s.
      add(word.replace(/(?:cents|vingts)$/u, match => match.slice(0, -1)), n);
      for (const [base, alias] of [[70,'septante'],[80,'huitante'],[80,'octante'],[90,'nonante']] as const) {
        const last = n % 100;
        if (last >= base && last < base + 10) {
          const rest = last - base;
          add(`${n >= 100 ? `${groupWords(language, n - last).replace(/s$/u, '')} ` : ''}${alias}${rest ? `${rest === 1 ? '-et' : ''}-${SMALL.fr[rest]}` : ''}`, n);
        }
      }
    }
    if (language === 'es') {
      add(word.replace(/ientos/gu, 'ientas').replace(/uno$/u, 'una'), n);
      add(word.replace(/veintiuno$/u, 'veintiún').replace(/uno$/u, 'un'), n);
    }
    if (language === 'pt') {
      const feminine = word.replace(/entos/gu, 'entas').replace(/um$/u, 'uma').replace(/dois$/u, 'duas');
      add(feminine, n);
      for (const spelling of [word, feminine]) add(spelling.replace(/catorze/gu, 'quatorze').replace(/dezesseis/gu, 'dezasseis').replace(/dezessete/gu, 'dezassete').replace(/dezenove/gu, 'dezanove'), n);
    }
    if (language === 'nl') { add(word.replace(/een/gu, 'één'), n); if (n > 100 && n % 100) {const withAnd = word.replace('honderd', 'honderd en '); add(withAnd, n); add(withAnd.replace(/een/gu, 'één'), n);} }
  }
  const result = {groups, tokens}; cache.set(language, result); return result;
}
const BLOCKERS: Record<Language, RegExp> = {
  de: /^(?:milliarden?|billionen?|halb(?:e|en|er|es)?|viertel)$/u,
  fr: /^(?:milliards?|billions?|demi(?:e)?|quarts?)$/u,
  es: /^(?:billón|billones|millardos?|medi[oa]|cuartos?)$/u,
  it: /^(?:miliard[oi]|bilion[ei]|mezz[oa]|quarti?)$/u,
  pt: /^(?:bilhão|bilhões|bilião|biliões|mei[oa]|quartos?)$/u,
  nl: /^(?:miljard|biljoen|half|halve|kwart)$/u,
};
// These complete positive comparisons end in the language's minus word; bare minus stays refused.
const AT_LEAST: Partial<Record<Language, RegExp>> = {
  fr: /(?:^|[^\p{L}])au moins\s+$/iu,
  es: /(?:^|[^\p{L}])al menos\s+$/iu,
  pt: /(?:^|[^\p{L}])pelo menos\s+$/iu,
};
const SCALES: Record<Language, {thousand: string; million: string; joiner?: string; percent: string; negative: string; fraction: string}> = {
  de: {thousand:'tausend',million:'millionen|million',percent:'prozent',negative:'minus',fraction:'komma'},
  fr: {thousand:'mille',million:'millions|million',percent:'pour\\s+cent',negative:'moins',fraction:'virgule'},
  es: {thousand:'mil',million:'millones|millón',percent:'por\\s+ciento',negative:'menos',fraction:'coma|punto'},
  it: {thousand:'mille|mila',million:'milioni|milione',percent:'per\\s+cento',negative:'meno',fraction:'virgola'},
  pt: {thousand:'mil',million:'milhões|milhão',joiner:'e',percent:'por\\s+cento',negative:'menos',fraction:'vírgula'},
  nl: {thousand:'duizend',million:'miljoen',joiner:'en',percent:'procent',negative:'min',fraction:'komma'},
};
function cardinal(text: string, language: Language): number | undefined {
  const {groups} = vocabulary(language), spec = SCALES[language], key = normalize(text);
  const group = (part: string) => groups.get(part);
  const scaled = (part: string, pattern: string, scale: number, remainder: (part: string) => number | undefined): number | undefined => {
    const pieces = part.split(new RegExp(pattern, 'u'));
    if (pieces.length === 1) return remainder(part);
    if (pieces.length !== 2) return undefined;
    const left = pieces[0] ? group(pieces[0]!) : 1;
    let tail = pieces[1]!;
    if (spec.joiner && tail.startsWith(spec.joiner)) tail = tail.slice(spec.joiner.length);
    const right = tail ? remainder(tail) : 0;
    return left && right !== undefined ? left * scale + right : undefined;
  };
  const thousands = (part: string) => scaled(part, spec.thousand, 1000, group);
  return scaled(key, spec.million, 1_000_000, thousands);
}

/** Located, complete cardinal phrases after a comparison. No fallback to English, unknown words or a prefix of a malformed number. */
export function localizedWordNumbers(text: string, primary: string, comparison: RegExp): TitleReferenceNumber[] {
  if (!Object.hasOwn(SCALES, primary)) return [];
  const language = primary as Language, spec = SCALES[language], {tokens} = vocabulary(language), plain = text.normalize('NFKC');
  const words = [...plain.matchAll(/[\p{L}\p{M}]+(?:[-‐‑\u00ad][\p{L}\p{M}]+)*/gu)], result: TitleReferenceNumber[] = [];
  const scale = new RegExp(`^(?:${spec.thousand}|${spec.million}|${spec.negative}|${spec.fraction})$`, 'u');
  const numberToken = (word: string) => tokens.has(normalize(word)) || cardinal(word, language) !== undefined || scale.test(word) || BLOCKERS[language].test(word) || word === spec.joiner || ['et','y','e'].includes(word);
  for (let i = 0; i < words.length; i++) {
    const start = words[i]!.index!, before = plain.slice(0, start);
    if (!comparison.test(before.toLowerCase())) continue;
    // Bare French/Spanish/Italian/Portuguese minus is not an unambiguous positive comparison ("moins cinq").
    if (['fr','es','it','pt'].includes(language) && new RegExp(`(?:^|[^\\p{L}])${spec.negative}\\s+$`, 'iu').test(before) && !AT_LEAST[language]?.test(before)) continue;
    let end = i;
    while (end < words.length && end - i < 32 && numberToken(words[end]![0].toLowerCase()) && (end === i || /^[\s‐‑\u00ad-]+$/u.test(plain.slice(words[end - 1]!.index! + words[end - 1]![0].length, words[end]!.index)))) end++;
    if (end === i || (end - i === 32 && end < words.length && numberToken(words[end]![0].toLowerCase()))) continue;
    const stop = words[end - 1]!.index! + words[end - 1]![0].length, phrase = plain.slice(start, stop).toLowerCase();
    const negative = phrase.startsWith(`${spec.negative} `), value = cardinal(negative ? phrase.slice(spec.negative.length + 1) : phrase, language);
    if (value === undefined) continue;
    const percent = new RegExp(`^\\s*(?:%|(?:${spec.percent})(?![\\p{L}]))`, 'iu').test(plain.slice(stop));
    const actual = negative ? -value : value;
    result.push({value:actual,decimals:0,percent,text:`${actual.toLocaleString(primary)}${percent ? '%' : ''}`,before});i = end - 1;
  }
  return result;
}
