---
type: fixed
packages: [editor]
---
Canvas: the caret of the plain-text inline input stays on the drawn glyphs of a heading whose lines are balanced. The input is a native textarea over the slide's text and wraps greedily at the box width, while the engine balances a heading's lines (WI-4), so "Scale the pilot to four / teams in January." was drawn with "teams in" on the second line and held by the input on the first: a press on "January" fell past the end of the input's second line, the caret stopped after "in", and the arrow keys, Home, End and the selection highlight were on other words than the ones under them. The input now takes the wrap width at which the browser breaks its text where the slide does (`src/input-wrap.js`, as side padding, so its box and outline do not move), measured again after each draft; where no width gives the drawn breaks it shows its own text in place of the drawn one while it is edited.
