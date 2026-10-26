# WI-4: type roles

Core changes the type roles; the renderer draws what core composes. No gallery record changes, and no move is about colour, fonts or drawing code. Every move comes from one of five engine rules.

1. **Body scale (D2).** Prose and the subtitle ask for 28 px (21 pt), up from 25 px. Lists stay at 32 px and tables at 25 px. A paragraph or list column that does not fit at its role size shrinks together with its stacked neighbours to one size.
2. **Balanced headings.** A wrapped title or subtitle keeps its size and line count and balances its breaks ("A smaller pilot. / A clearer decision.").
3. **Quotes.** The body asks for 40 px (it fits down through the former 28 px) and is wrapped in the typographic marks of the deck language (curly quotes for English); the source follows an en dash.
4. **Code.** The body asks for 22 px, falls back to 18 px where 22 px would wrap lines that 18 px keeps whole, and a panel shorter than its cell hugs its content.
5. **Sparse auto slides.** A paragraph that wraps in an auto region takes a reading measure of about 70 characters, and a lone block of up to two lines uses a 32 px lead size.

## Template baseline (`layout-templates-rr96-color-variants.json`)

Rebased on WI-1 and WI-5, then `node test/layout-template-goldens.mjs --update`, reviewed, and `--promote`d. 410 of 491 slides changed against main's baseline. The source digest is unchanged. Almost every template slide has prose, a subtitle or a list column sharing a size, so most of the corpus moves; the slides that did not move are the title-only and picture-only ones.

Core's composition goldens of the same samples (`packages/javascript/test/fixtures/template-goldens-0.19.json`):

- 182 of 336 cases changed;
- 393 composed text sizes went up and 30 went down. The downs are all `long` stress samples where stacked lists and prose now share one size;
- text-overflow diagnostics went from 210 to 222: three overfull samples (`comparison 6 long`, `timeline 4 long`, `timeline 5 long`) gain an overflow at the minimum size, because their numeric row keeps the larger need of 28 px prose.
