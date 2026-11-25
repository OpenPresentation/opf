# Which font Keynote 16.0 used for each language tag (OPF 0.36.0, default export)

Written 2026-11-25. Evidence: `probe.json` of `$W/keynote/036/languages/<deck>~default/` (font of each text paragraph: **saw**), `back.pptx` (**saw**), pictures in `slides/` (**saw**), `$W/decks/languages/expected-fonts.json` and `installed-check.json` (**saw**).

**Read this first.** `probe.json` reports the font a run *asks for*. For text the requested font cannot draw, macOS draws the missing glyphs with a fallback font and the probe still says the requested one (here `Helvetica`). The column "Drawn with (inferred)" is the font CoreText's default cascade picks for the script text when the requested font is Helvetica (a Swift `CTFontCreateForString` run on this Mac over the UDHR text of each tag). It is **inferred**, not read from Keynote: Keynote itself does not say. Where the picture and the cascade disagree I say so (none seen).

`back.pptx` (Keynote's own export, **saw**): for Indic, Southeast Asian, CJK and Arabic/Hebrew text Keynote wrote the **per-slide theme's script font back on the run** (`a:latin`/`a:ea`/`a:cs` all = e.g. Nirmala UI), so it understood the expected font; for Latin, Cyrillic, Greek, Amharic, Armenian and Georgian it wrote no typeface (theme minor font, Helvetica). Keynote writes **no `lang`** on any run, and for the Arabic-script slides 3 to 6 and the other script paragraphs no `rtl`/`algn` (slides 1 and 2 keep `rtl=1 algn=r` on table cells and bullets only): Keynote lays the paragraphs out by script direction (natural), which draws right.

Grade = default mode slide grade against OPF's preview (see grades.json). Latin line (Aptos, `+mn-lt`): not installed here, Keynote asks for Helvetica on every slide.

| tag | deck/slide | script | dir | expected for the script text (theme) | on this Mac | Keynote reports (script text) | Latin line | drawn with (inferred) | real glyphs / shaping (picture vs preview) | direction | grade | group |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| af | lang-latin-1 1 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | wrong (LG-01) | c |
| sq | lang-latin-1 2 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| ay | lang-latin-1 3 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| az | lang-latin-1 4 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs, accents and special letters present | ltr | small | b |
| ber-Latn | lang-latin-1 5 | Latn | ltr | Aptos | no | Helvetica | Helvetica | Helvetica | real glyphs; ɛ ɣ ḍ ṭ ẓ present | ltr | small | b |
| bs-Latn | lang-latin-1 6 | Latn | ltr | Aptos | no | Helvetica | Helvetica | Helvetica (covers the script) | real glyphs; U+0111 drawn as a proper d with bar (preview draws a barred b) | ltr | small | b |
| ca | lang-latin-1 7 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | wrong (LG-01) | c |
| ceb | lang-latin-1 8 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| hr | lang-latin-1 9 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs; U+0111 drawn as a proper d with bar (preview draws a barred b) | ltr | small | b |
| cs | lang-latin-1 10 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | wrong (LG-01) | c |
| da | lang-latin-1 11 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| nl | lang-latin-1 12 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| en | lang-latin-1 13 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| en-AU | lang-latin-1 14 | Latn | ltr | Aptos | no | Helvetica | Helvetica | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| en-CA | lang-latin-1 15 | Latn | ltr | Aptos | no | Helvetica | Helvetica | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| en-GB | lang-latin-1 16 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| en-IN | lang-latin-1 17 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| en-US | lang-latin-1 18 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| et | lang-latin-1 19 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| fil | lang-latin-1 20 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | wrong (LG-01) | c |
| fi | lang-latin-1 21 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| fr | lang-latin-1 22 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| ff | lang-latin-1 23 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs; hooked letters (ɓ ɗ ƴ) present | ltr | small | b |
| gl | lang-latin-1 24 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| de | lang-latin-2 1 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| ha | lang-latin-2 2 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs, accents and special letters present | ltr | small | b |
| hu | lang-latin-2 3 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| ig | lang-latin-2 4 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs; ụ ọ ṅ present | ltr | small | b |
| id | lang-latin-2 5 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| it | lang-latin-2 6 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| rw | lang-latin-2 7 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| kmr | lang-latin-2 8 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| lv | lang-latin-2 9 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| lt | lang-latin-2 10 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| mg | lang-latin-2 11 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| zsm | lang-latin-2 12 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| mi | lang-latin-2 13 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| no | lang-latin-2 14 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| om | lang-latin-2 15 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| pl | lang-latin-2 16 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| pt | lang-latin-2 17 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | wrong (LG-01) | c |
| ro | lang-latin-2 18 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| sr-Latn | lang-latin-2 19 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs; U+0111 drawn as a proper d with bar (preview draws a barred b) | ltr | small | b |
| sn | lang-latin-2 20 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| sk | lang-latin-2 21 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| sl | lang-latin-2 22 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| so | lang-latin-2 23 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| es | lang-latin-2 24 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | wrong (LG-01) | c |
| sw | lang-latin-3 1 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | wrong (LG-01) | c |
| sv | lang-latin-3 2 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| tl | lang-latin-3 3 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | wrong (LG-01) | c |
| tr | lang-latin-3 4 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| uz-Latn | lang-latin-3 5 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs, accents and special letters present | ltr | small | b |
| vi-Latn | lang-latin-3 6 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs; U+0111 drawn as a proper d with bar (preview draws a barred b) | ltr | wrong (LG-01) | c |
| xh | lang-latin-3 7 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| yo | lang-latin-3 8 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs; tone marks and dot-below present | ltr | small | b |
| zu | lang-latin-3 9 | Latn | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica (covers the script) | real glyphs, accents and special letters present | ltr | small | b |
| bg | lang-cyrillic-greek 1 | Cyrl | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs | ltr | wrong (LG-01) | c |
| el | lang-cyrillic-greek 2 | Grek | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs, tonos correct | ltr | wrong (LG-01) | c |
| kk | lang-cyrillic-greek 3 | Cyrl | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs; ә at normal height (preview draws it small and raised) | ltr | small | b |
| mk | lang-cyrillic-greek 4 | Cyrl | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs | ltr | wrong (LG-01) | c |
| mn | lang-cyrillic-greek 5 | Cyrl | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs | ltr | small | b |
| ru | lang-cyrillic-greek 6 | Cyrl | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs | ltr | wrong (LG-01) | c |
| sr-Cyrl | lang-cyrillic-greek 7 | Cyrl | ltr | Aptos | no | Helvetica | Helvetica | Helvetica | real glyphs | ltr | small | b |
| tg | lang-cyrillic-greek 8 | Cyrl | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs | ltr | small | b |
| uk | lang-cyrillic-greek 9 | Cyrl | ltr | Aptos | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs | ltr | wrong (LG-01) | c |
| ar | lang-rtl 1 | Arab | rtl | Arial | yes | ArialMT | Helvetica, Helvetica-Bold | GeezaPro | real glyphs, joined | rtl, right-aligned, bullets on the right, Latin line in place (same as preview) | wrong (LG-02) | a |
| he | lang-rtl 2 | Hebr | rtl | Segoe UI | no | Verdana | Helvetica, Helvetica-Bold | LucidaGrande | real Hebrew glyphs | rtl, right-aligned, bullets right (same as preview) | wrong (LG-02) | b |
| ps | lang-rtl 3 | Arab | rtl | Arial | yes | ArialMT | Helvetica, Helvetica-Bold | GeezaPro | real glyphs, joined, ټ ړ ڼ present | rtl, right-aligned, bullets right | small | a |
| fa | lang-rtl 4 | Arab | rtl | Arial | yes | ArialMT | Helvetica, Helvetica-Bold | GeezaPro,Helvetica | real glyphs, joined, ZWNJ intact | rtl, right-aligned, bullets right | small | a |
| pa-Arab | lang-rtl 5 | Arab | rtl | Arial | yes | ArialMT | Helvetica, Helvetica-Bold | GeezaPro | real glyphs, joined | rtl, right-aligned, bullets right | small | a |
| ur | lang-rtl 6 | Arab | rtl | Arial | yes | ArialMT | Helvetica, Helvetica-Bold | GeezaPro | real glyphs, joined (Naskh) | rtl, right-aligned, bullets right | small | a |
| zh-Hans | lang-cjk 1 | Hans | ltr | Microsoft YaHei | no | Helvetica | Helvetica | PingFangSC-Regular | real glyphs | ltr | small | b |
| zh-Hant | lang-cjk 2 | Hant | ltr | Microsoft JhengHei | no | Helvetica | Helvetica | PingFangSC-Regular | real glyphs (regional forms: cannot judge) | ltr | small | b |
| ja | lang-cjk 3 | Jpan | ltr | Yu Gothic | no under that name; macOS ships it as "YuGothic" (Keynote mapped it, saw probe YuGo-Medium) | YuGo-Medium | Helvetica, Helvetica-Bold | HiraginoSans-W3,PingFangSC-Regular | real glyphs | ltr | small | a |
| ko | lang-cjk 4 | Kore | ltr | Malgun Gothic | no | Helvetica | Helvetica, Helvetica-Bold | AppleSDGothicNeo-Regular | real glyphs | ltr | small | b |
| bn | lang-indic 1 | Beng | ltr | Nirmala UI | no | Helvetica | Helvetica, Helvetica-Bold | KohinoorBangla-Regular,KohinoorDevanagari-Regular | real glyphs, conjuncts and vowel signs formed | ltr | small | b |
| gu | lang-indic 2 | Gujr | ltr | Nirmala UI | no | Helvetica | Helvetica, Helvetica-Bold | KohinoorGujarati-Regular | real glyphs, conjuncts formed | ltr | small | b |
| hi | lang-indic 3 | Deva | ltr | Nirmala UI | no | Helvetica | Helvetica, Helvetica-Bold | KohinoorDevanagari-Regular | real glyphs, conjuncts and matras formed | ltr | small | b |
| kn | lang-indic 4 | Knda | ltr | Nirmala UI | no | Helvetica | Helvetica, Helvetica-Bold | NotoSansKannada-Regular | real glyphs | ltr | small | b |
| ml | lang-indic 5 | Mlym | ltr | Nirmala UI | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica,MalayalamSangamMN | real glyphs; the conjunct at "ഭ്രാതൃ" is right (preview draws a stray mark: preview fault) | ltr | small | b |
| mr | lang-indic 6 | Deva | ltr | Nirmala UI | no | Helvetica | Helvetica, Helvetica-Bold | KohinoorDevanagari-Regular | real glyphs | ltr | small | b |
| ne | lang-indic 7 | Deva | ltr | Nirmala UI | no | Helvetica | Helvetica, Helvetica-Bold | KohinoorDevanagari-Regular | real glyphs | ltr | small | b |
| pa-Guru | lang-indic 8 | Guru | ltr | Nirmala UI | no | Helvetica | Helvetica, Helvetica-Bold | KohinoorDevanagari-Regular,MuktaMahee-Regular | real glyphs | ltr | small | b |
| ta | lang-indic 9 | Taml | ltr | Nirmala UI | no | Helvetica | Helvetica, Helvetica-Bold | TamilSangamMN | real glyphs, vowel signs attached | ltr | small | b |
| te | lang-indic 10 | Telu | ltr | Nirmala UI | no | Helvetica | Helvetica, Helvetica-Bold | KohinoorTelugu-Regular | real glyphs | ltr | small | b |
| km | lang-southeast-asia 1 | Khmr | ltr | Leelawadee UI | no | Helvetica | Helvetica, Helvetica-Bold | KhmerSangamMN | real glyphs, subscripts attached (word breaks: cannot judge) | ltr | small | b |
| th | lang-southeast-asia 2 | Thai | ltr | Leelawadee UI | no | Helvetica | Helvetica, Helvetica-Bold | Thonburi | real glyphs, tone marks and vowels attached (word breaks: cannot judge) | ltr | small | b |
| am | lang-other 1 | Ethi | ltr | Ebrima | no | Helvetica | Helvetica, Helvetica-Bold | KefaIII-Regular | real glyphs (Kefa; wider than the preview face) | ltr | wrong (LG-01, LG-03) | c |
| hy | lang-other 2 | Armn | ltr | Sylfaen | no | Helvetica | Helvetica, Helvetica-Bold | NotoSansArmenian-Regular | real glyphs | ltr | small | b |
| ka | lang-other 3 | Geor | ltr | Sylfaen | no | Helvetica | Helvetica, Helvetica-Bold | Helvetica | real glyphs | ltr | small | b |

Not run (no text could be sourced, so no slide): **ctg** (Chittagonian, Bengali script) and **or** (Odia).

## Outcome groups (default mode)

**(a) expected font installed and used for the script text (6 tags):** ar, ps, fa, pa-Arab, ur, ja. Arabic, Pashto, Persian, Punjabi (Shahmukhi), Urdu: Arial is installed, probe says ArialMT, joined letters drawn (saw). Japanese: the file names Yu Gothic, `installed-check.json` says missing because macOS names it `YuGothic`; Keynote mapped it (probe `YuGo-Medium`, back.pptx writes `游ゴシック体 ミディアム`). The Latin line of every slide is still Helvetica for Aptos.

**(b) expected font missing, Keynote picked a font that covers the script, slide reads fine (70 tags):** sq, ay, az, ber-Latn, bs-Latn, ceb, hr, da, nl, en, en-AU, en-CA, en-GB, en-IN, en-US, et, fi, fr, ff, gl, de, ha, hu, ig, id, it, rw, kmr, lv, lt, mg, zsm, mi, no, om, pl, ro, sr-Latn, sn, sk, sl, so, sv, tr, uz-Latn, xh, yo, zu, kk, mn, sr-Cyrl, tg, he, zh-Hans, zh-Hant, ko, bn, gu, hi, kn, ml, mr, ne, pa-Guru, ta, te, km, th, hy, ka.

Substitutes (requested font as reported; drawn font inferred from the cascade): Latin, Cyrillic, Greek: Aptos asked as Helvetica, Helvetica draws all of them (Helvetica covers Georgian, Cyrillic, Greek on this Mac per the cascade run). Hebrew: Segoe UI replaced by Verdana at request, Hebrew drawn by a fallback (Lucida Grande in the cascade run). Chinese: Microsoft YaHei/JhengHei asked as Helvetica, drawn with PingFang SC (inferred; Traditional text shows the same font). Korean: Malgun Gothic asked as Helvetica, Apple SD Gothic Neo. Bengali: Kohinoor Bangla; Gujarati: Kohinoor Gujarati; Devanagari (hi, mr, ne): Kohinoor Devanagari; Kannada: Noto Sans Kannada; Malayalam: Malayalam Sangam MN; Gurmukhi: Gurmukhi MN or Mukta Mahee; Tamil: Tamil Sangam MN; Telugu: Kohinoor Telugu; Khmer: Khmer Sangam MN; Thai: Thonburi (heavier than the preview); Armenian: Noto Sans Armenian.

**(c) expected font missing and the result is wrong (15 tags):** af, ca, cs, fil, pt, es, sw, tl, vi-Latn, bg, el, mk, ru, uk, am. All are the same fault: the substitute is wider than Aptos (Helvetica) or Ebrima (Kefa), and in default mode every wrapped line is its own box with `wrap=none`, so the first column's lines run into the "Latin line" block beside them (LG-01; `am`: LG-03). No boxes, no broken shaping, no wrong direction in any tag. Also wrong in default mode for another reason: **ar, he** (table over the chart, LG-02; script text itself fine).

## Improvements (what OPF could name so a Mac resolves it without Windows fonts)

Coverage was checked with CoreText on this Mac (`CTFontGetGlyphsForCharacters` over the UDHR text): Arial covers he ar fa ur el ru (not Thai, Indic, Armenian, Georgian); Tahoma covers th he ar fa ur el ru; Arial Unicode MS covers th he ar hi bn ta te kn ml gu pa hy ka zh ja ko (ships with macOS, but on Windows only with some Office installs); Verdana covers only el ru; Helvetica covers ka el ru. The Mac's own script faces (Kohinoor, Sangam, Thonburi, PingFang, Apple SD Gothic Neo) are not on Windows.

- **Latin, Cyrillic, Greek line fit (all of LG-01):** write Arial instead of Aptos so a Mac and Windows measure and draw the same. Already available: `--typefaces safe` (Arial for the Latin text, lines laid out with Arial; script fonts keep their names). Cost to PowerPoint: the deck shows Arial instead of Aptos. Not run in Keynote (needs a re-export and a Keynote pass: experiment in `experiments.md`).
- **Hebrew:** name Arial (or Tahoma) instead of Segoe UI: both ship with Windows and macOS and cover Hebrew (CoreText run). Today Keynote swaps Segoe UI for Verdana and draws Hebrew by fallback, which reads fine. Cost: PowerPoint on Windows draws Arial Hebrew instead of Segoe UI.
- **Thai:** name Tahoma instead of Leelawadee UI: Windows ships Tahoma with Thai and this Mac's Tahoma covers Thai (CoreText run), so Keynote would use the named face instead of Thonburi. Cost: Tahoma is older and plainer than Leelawadee UI in PowerPoint; Windows 7 and later have both.
- **Chinese, Japanese, Korean, Indic, Khmer, Ethiopic, Armenian, Georgian:** no family exists on both Windows and macOS; Keynote already gets real glyphs from macOS faces, so keep the Windows names (changing them to Mac names would cost Windows: "Windows lacks that family"). The only gap is width: Kefa for Ebrima is wider (am overflow in default mode). Nothing to name; the overflow is a layout-measure matter (LG-01).
- Japanese needs no change: `Yu Gothic` already resolves to macOS `YuGothic`.

## Right-to-left (lang-rtl)

- Direction and alignment (default; native is the same file, `native-body-fallback` for all 18 blocks, so no separate native file was opened): all six slides draw right-to-left paragraphs starting at the right, bullets on the right of the text, the Latin line left-aligned inside its right-hand box, digits in place (saw `lang-rtl~default/slides/slide-01..06.png` against the previews). Same as the preview.
- Table on ar and he: opf#1298 point 2 (only the first column) does **not** reproduce in 0.36.0 / Keynote 16.0: all three columns and all nine cells are present (probe, cell text intact), in the right visual order. New problem instead: the table is drawn left of where the file puts it (probe position x 61 pt; file x 489 pt; back.pptx says 489 pt), over the chart: LG-02.
- Bulleted list: bullets on the right, text right-aligned (saw).
- Chart category names: in the script on all RTL charts. Keynote reversed the data order to honor the reversed category axis (file `جميع, الناس, أحرارًا` with `orientation maxMin`; back.pptx `أحرارًا, الناس, جميع` with `minMax`): picture equals the preview, data sheet order differs (from back.pptx; UI check in `ui-checks.md`).
- Mixed-script wrapping: Arabic and Latin line in one block: each wrapped line is its own box; the Latin paragraph begins at the box's left edge, the Arabic lines at its right edge, as in the preview (saw ar, ps, fa, pa-Arab, ur).

## The six slides with a table and a chart

ar, he, hi, th, ja, zh-Hans: each table is a Keynote table (probe class `table`, 3 x 3, cell text intact, header row on), each chart a Keynote chart whose back.pptx categories are in the script (saw). Only ar and he have the layout fault (LG-02).

## OPF's own preview problems: which side is wrong

- U+0111 (hr, bs-Latn, sr-Latn, vi-Latn, opf#1472): Keynote draws a proper d with bar (saw hr slide 9 and vi slide 6 crops). The preview font (Intos) is wrong, the file is fine.
- Malayalam at "ഭ്രാതൃ": Keynote draws the conjunct, the aa sign and the vowel sign correctly; the preview's stray open-parenthesis mark is a preview fault (saw lang-indic slide 5).
- Amharic line starting with "፡": Keynote default shows the same line start, because the break is in the exported file (OPF's own line break after "።" in the measured lines, LG-03). Native mode lets Keynote re-wrap and the separator stays inline.
- Kazakh ә: Keynote draws it at normal height; the small raised ә is the preview font's.
- Thai and Khmer breaks: cannot judge.
