---
type: fixed
packages: [editor, mcp]
---
While the source pane's text is not a valid deck, the review no longer says the deck is valid. The slides still show the last valid version, but the review pill counts the text's errors ("1 issue", never "Valid"), the Review panel lists them first and says the findings under them describe the last valid version, and the workspace's `review` event carries the text's counts with `draft: true`; all of it clears once the text is valid again. The Review panel has `setSource(findings)` for this, and `editor.sourceState.findings` holds the text's findings. In the MCP viewer the footer's verdict follows, and the model's context and `read_deck` report the text's findings as `sourceChecks` beside the `checks` of the last valid deck.
