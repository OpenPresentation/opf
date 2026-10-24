---
type: added
packages: [editor]
---
Source editor Markdown quick fixes (phase 4): "Remove `id` from the fence" for a slide property set both in Markdown and in an `opf-slide` fence (the key goes from the fence with its nested lines and comments; a fence left empty goes too), "Remove the empty quote", "Remove the options comment" for a block options comment with no block, "Move the text to its own line" for text after `-->`, "Insert closing quote" and "Remove `layout=`" for a malformed options comment, "Remove `layout`" and "Use as=bullets / as=video" for an option with a bad value, "Remove `foo`" for an attribute a chart or timeline fence does not take, and "Remove the second `value`" / "Remove `label:`" for a metric key given twice or with no value. Findings with no mechanical, unambiguous repair (an image with no source, a chart with no data, a timeline with no events, a malformed `opf-slide`) offer none.
