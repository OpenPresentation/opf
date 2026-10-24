---
type: added
packages: [editor]
---
Source editor completions, phase 3 (JSON, YAML and Markdown): the document's own ids are offered as values (`asset:` ids, dataset ids and column names, `cite` ids, `beat` ids of the narrative, `region` names of the slide's layout, `var:` color and image variables, and `{{name}}` after two braces); a slide's keys rank by its layout's regions; a list of catalog records says when a catalog the document names is not registered; accepting a key of a closed set of values and then its value is one undo step; the deck's `design`, `organization` and `speaker` keys are accepted as snippets with a tab stop for each member (and `design` opens the theme, color scheme and font scheme lists); and completion works inside YAML flow collections and quoted scalars that run over several lines.
