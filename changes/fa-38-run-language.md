---
type: changed
packages: [opf, pptx, editor]
---
FA-38 (breaking): a text run's language is `language`, as on the deck, slide and code block, not `lang`: `{ "text": "Bonjour", "language": "fr-FR" }`. No alias; rename the key ([0.34 migration](../docs/migrations/0.34.md)). The Markdown span attribute stays `lang=fr`; PPTX export and import use the new key (import still reads `lang` in OPF tags of files exported before 0.34), and the editor's rich-text toolbar and `setRichTextFormat` take `language`. `opf/language-tag` points at `/language`.
