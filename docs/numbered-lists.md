# Numbered lists

`numbering` on an `items` or `bullets` payload draws numbers instead of bullets. The preview draws the numbers at the bullet geometry core composes, and the PowerPoint export writes native auto-numbers (`a:buAutoNum`), so a numbered list is a real numbered list in PowerPoint and the two agree. Without `numbering` nothing changes: a deck that does not use the field composes, renders and exports exactly as before.

```json
{
  "title": "Rollout",
  "items": [
    "Freeze the schema",
    { "text": "Migrate the data", "level": 1 },
    { "text": "Verify the counts", "level": 1 },
    "Switch traffic",
    "Retire the old service"
  ],
  "numbering": ["arabic", { "style": "alpha-lower", "suffix": "paren" }]
}
```

draws `1.`, `a)`, `b)`, `2.`, `3.`. The fixture [numbered-lists.opf.json](fixtures/numbered-lists.opf.json) covers every style, start numbers, per-level styles and nesting.

## The field

`numbering` is optional on a slide root payload and on a content payload (a block or a promoted region). It is valid only beside `items` or `bullets`; on any other payload, or on a group of `blocks`, validation reports an error. A payload that has both `items` and `bullets` numbers both lists.

```text
numbering: NumberingStyle | Numbering | (NumberingStyle | Numbering)[]
NumberingStyle = "arabic" | "roman-upper" | "roman-lower" | "alpha-upper" | "alpha-lower"
Numbering = { style?: NumberingStyle (default "arabic"),
              start?: integer 1..32767 (default 1),
              suffix?: "period" | "paren" | "paren-both" (default "period") }
```

- A style name is shorthand for `{ "style": name }`. A style name or an object applies to every list level; an array has one entry per level (index = `level`) and its last entry repeats for deeper levels (at most 9 entries, the depth a native paragraph can carry).
- Styles draw `1.`, `I.`, `i.`, `A.`, `a.`; the suffix draws `1.` (`period`), `1)` (`paren`) or `(1)` (`paren-both`).
- `start` is the first number counted at that level. It is limited to 32767, the largest value `a:buAutoNum@startAt` holds; validation reports a list that would count past it.
- An object item (`ListItem` or `BulletItem`) may carry its own `start`: the count restarts at that number for that entry, and the entries after it continue from it. Pagination uses this to keep the numbers of the whole list on continuation pages (see below); it is also the way to author "continue from 5" in a second list. `start` on an entry without `numbering` on the payload has no effect and validation warns.

## Counting

Counting follows PowerPoint, level by level:

- Consecutive entries of one level count up from that level's `start`.
- An entry of a shallower level restarts every deeper level.
- Deeper entries between two entries of one level do not interrupt that level (`1.`, `a)`, `2.` and not `1.`, `a)`, `1.`).
- The first entry of a level counts from that level's `start`, wherever it first appears.

Alphabetic numbering past 26 repeats the letter as PowerPoint does (`z`, `aa`, `bb`, ..., `zz`, `aaa`). Roman numerals stop at 3999: a larger value is drawn in arabic (PowerPoint draws it that way too, and the export writes it as an arabic auto-number) and composition reports `numbering-adapted`; the notice never fails a strict (`composition.overflow: "error"`) slide.

## Geometry (shared by the preview and the export)

Core composes the marker, the preview draws it and the exporter writes it; none of them measures the number again.

- `ListEntryLayout.marker.text` is the formatted number (`iv.`), at the marker position of the bullet it replaces: left edge at the entry's level offset, baseline of the entry's first line. `marker.number` carries the counted value, the style actually drawn, the suffix and an `adapted` flag, and `marker.width` is the measured advance.
- The marker's `style` is the list style with the first run's weight and slant. PowerPoint draws an auto-number with the character formatting of the paragraph's first run, so an entry that starts with a bold run draws a bold number; the marker is measured the same way.
- The hanging indent is one value for the whole list: the larger of 1.1 em (the bullet indent) and the widest marker in the list plus 0.3 em. Wide markers (`viii.`, `10.`, `(iv)`) therefore never reach their text, and every level steps by that same indent. An unnumbered list keeps 1.1 em.
- A numbered list draws numbers even when `design.listBullet` is `image`; the picture bullet is for bulleted lists.

`formatListNumber(value, style, suffix)`, `listNumbers(items, numbering)`, `resolveNumbering` and `numberingAtLevel` are exported (`@openpresentation/opf` and the `composition` subpath) so hosts, the exporter and tests compute the same numbers.

## PowerPoint

The exporter writes, per entry marker line, `a:buAutoNum` with the scheme that matches the style and suffix and `startAt` set to the counted number whenever it is not 1, with `marL` and `indent` from the hanging indent above:

| style | `period` | `paren` | `paren-both` |
| --- | --- | --- | --- |
| `arabic` | `arabicPeriod` | `arabicParenR` | `arabicParenBoth` |
| `roman-upper` | `romanUcPeriod` | `romanUcParenR` | `romanUcParenBoth` |
| `roman-lower` | `romanLcPeriod` | `romanLcParenR` | `romanLcParenBoth` |
| `alpha-upper` | `alphaUcPeriod` | `alphaUcParenR` | `alphaUcParenBoth` |
| `alpha-lower` | `alphaLcPeriod` | `alphaLcParenR` | `alphaLcParenBoth` |

Import maps `a:buAutoNum` back to `numbering` (`type` to style and suffix, `startAt` to `start`, per level to an array, uniform to a single object or a style name) and a list whose counted numbers differ from the plain count to per-entry `start`. A scheme OPF has no equivalent for (for example the East Asian, Hebrew or Arabic numbering schemes) imports as `arabic` with a specific diagnostic.

## Pagination

`paginateSlide` splits a numbered list between whole entries and keeps the numbers of the whole list: an entry on a continuation page whose number would differ from its number in the whole list carries `start`, so page two of a fifteen item list starts at 9 and a nested list continues its letters. Pages of an unnumbered list are unchanged.

## Not covered

Vetoable boundaries of this design: no `numbering` default in `design` (set it on the payload); no per-entry style (only per-level); no RTL-specific number placement (the list code places markers at the left edge for every direction); the East Asian, Hebrew and Arabic native numbering schemes; and numbering of descriptions or of table rows. Table cells and text paragraphs have no list structure to number.
