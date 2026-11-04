# Storyline, structure and placeholders

Use this when you write a deck from a brief, before and while you fill slides. The rules come from good slide-design practice; each has an OPF form. The numbers in the examples are illustrative. Do not copy them into a user's deck.

## 1. Outline the titles first

Write every slide title before any slide body. Read the titles alone: they should tell the story without the slides, and they should all use one grammar.

- **Topic titles** name the subject: `Onboarding today`, `The pilot`, `Options`, `Decision`. Good for reference and briefing decks.
- **Assertion titles** state the point: `Setup hand-offs add most of the delay`. Good for a decision or a pitch, and the better default when the deck must persuade.
- Do not mix the two in one deck. Do not write drama titles in the shape "It's not X, it's Y": say what is true (`Three hand-offs add the delay`).
- Keep a title to one line: about 40 characters fit at the default size on a 16:9 slide before it wraps. Write a long "Topic: qualifier" title as the topic in `title` and the qualifier in `subtitle` (`"title": "Onboarding", "subtitle": "Pilot results"`), so the title stays short and the outline still reads as a list of topics.

An outline is a valid deck, so write it as one, share it, and fill the slides after it is agreed:

```json
{
  "language": "en",
  "slides": [
    {"id": "problem", "title": "Onboarding is slower than customers expect"},
    {"id": "cause", "title": "Setup hand-offs add most of the delay"},
    {"id": "pilot", "title": "The pilot removed two of three hand-offs"},
    {"id": "options", "title": "Building beats buying on fit, not on speed"},
    {"id": "decision", "title": "We ask for a decision on the build by March"}
  ]
}
```

A titles-only deck validates; it is a plan, not a deliverable.

## 2. One idea per slide, in the structure that shows it

A slide carries one message. Pick the structure from the content, not from habit. Layout ids are the built-in catalog's (`opf catalog layouts`).

| The content is | Use |
| --- | --- |
| Parallel entries with details (principles, workstreams, risks) | layout `pillars`, or labeled `items` (`text` plus `description`) |
| Figures that sit in a sentence | layout `metrics`, one `metric` block per figure |
| Options compared on the same criteria | layout `comparison` (two options) or a `table` (more, or more criteria) |
| A sequence of steps or dates | layout `process` or `timeline`, with a `timeline` payload |
| A flow, a system, messages between parties, states or a hierarchy | a `diagram` (Mermaid source) with an `alt`, alone on the slide or beside the text that explains it |
| One message that should stand alone | layout `statement` |
| Someone else's words | layout `quote`, with `attribution` |

A figure in a paragraph is a missed `metric`; three parallel sentences with a bold lead-in are `items` with a `description`; a sentence with "first, second, third" is a numbered list or a `process`. If a slide needs two of these, it is two slides.

```json
{
  "slides": [
    {"id": "pillars", "layout": "pillars", "title": "Three workstreams carry the rollout",
     "blocks": [
       {"items": [{"text": "People", "description": "One champion per region."}]},
       {"items": [{"text": "Process", "description": "Setup moves into the product."}]},
       {"items": [{"text": "Platform", "description": "Two legacy tools retire."}]}
     ]},
    {"id": "metrics", "layout": "metrics", "title": "The pilot shortened onboarding",
     "blocks": [
       {"metric": {"value": "[__]", "unit": " days", "label": "Median before the pilot"}},
       {"metric": {"value": "[__]", "unit": " days", "label": "Median during the pilot"}}
     ]},
    {"id": "comparison", "layout": "comparison", "title": "Build fits our process; buy ships sooner",
     "blocks": [
       {"items": [{"text": "Build", "description": "Fits our process; takes longer."}]},
       {"items": [{"text": "Buy", "description": "Ships sooner; fits less well."}]}
     ]},
    {"id": "process", "layout": "process", "title": "A new customer reaches value in three steps",
     "timeline": [{"when": "1", "what": "Sign up"}, {"when": "2", "what": "Connect data"}, {"when": "3", "what": "First report"}]},
    {"id": "statement", "layout": "statement", "title": "The recommendation",
     "text": "Move onboarding into the product."},
    {"id": "quote", "layout": "quote", "title": "A customer on the old flow",
     "quote": {"text": "[Quote from the interview notes]", "attribution": "[Customer, role]"}}
  ]
}
```

How much a slide can hold before it is too full is in the opf-layout skill's vertical budget ("Vertical budget" in its geometry reference): about 10 one-line list entries, 6 entries with descriptions, 10 table rows or 4 paragraphs at the default size. Check it before you cram; split the slide, or run `opf paginate deck.opf.json --check` to see which slides the engine would split.

## 3. Never invent a figure or a quote

Every number, date, name, quote and source in the deck comes from the user's material. When the brief lacks one, write a bracketed placeholder in its place and list every placeholder back to the user in your reply (slide id, what is missing). Do not round a guess into a plausible value, and do not paraphrase a quote you were not given.

A placeholder for a missing figure looks like `[€__]`, `[__]%`, `[month]` or `[Quote from the interview notes]`: bracketed, obviously unfinished, and named for what is missing.

**How this interacts with `opf/placeholder-text`.** That rule is a scaffolding detector. It warns on `lorem ipsum`, template prompts ("Click to add title"), a bracket that starts with `insert`, `add`, `your`, `enter`, `name`, `title`, `date`, `company`, `tbd`, `tbc`, `todo` or `placeholder` (`[Name]`, `[Date]`, `[Insert figure]`, `[TBD]`), and the capital markers `TBD`, `TBC`, `TODO`, `FIXME`, `XXX`. So:

- `[€__]`, `[__]%`, `[month]` and `[Quote from ...]` pass the rule. A deck that still has them can pass `opf validate --fail-on warning`, so a clean validation does not mean the figures are in. Keep your own list, and search the deck for the underscore form (`__`) before you hand it over.
- `[Name]`, `[Date]`, `[TBD]` and `[Insert ...]` are reported as warnings (`/slides/N/...`), and `--fail-on warning` fails while one is left. Use them when the deck must not ship until it is filled; do not use them in a draft the user asked you to deliver.
- Never silence the rule with `ignorePaths` to get a pass, and never replace a placeholder with an invented value to clear a warning. The fix for a warning is the real content, or deleting the element.

## 4. Speaker notes are a script

When the user wants speaker notes, write them as something a person says aloud: whole sentences, in the speaker's voice, with the transition into the next slide. Do not write bullets in notes (the slide already has them), and do not repeat the slide text.

```json
{
  "slides": [
    {
      "id": "pilot",
      "title": "The pilot removed two of three hand-offs",
      "bullets": ["Setup moved into the product", "Services stays for data migration"],
      "notes": "Before the pilot, a new customer waited on us three times before seeing a single report. We took out two of those waits. The one that stays is the data migration, and that is what I want to talk about next."
    }
  ]
}
```

Notes carry the same rules as the slides: no figure that is not in the source, and a bracket (`[__] days`) where one is missing. Add notes only when the user asks for them or the brief says the deck will be presented.

## 5. Ask before you add

Deliver the slides, statistics and sections the user gave you. If the story seems to need a slide, a chart, a statistic or a section that the brief does not supply, ask first (or deliver the deck as given and list what you would add). A supporting slide of invented evidence is worse than a gap. Reordering for the story, merging duplicates and splitting a slide that is too full are authoring work; new claims are not.
