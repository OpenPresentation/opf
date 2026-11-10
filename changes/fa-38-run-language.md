---
type: changed
packages: [opf, pptx, editor]
---

FA-38 (breaking): a text run's language is `language`, as on the deck, the slide and a code block, not `lang`: `{ "text": "Bonjour", "language": "fr-FR" }`. No alias; rename the key. The Markdown span attribute stays `lang=fr` (it writes the run's `language`, as `size` writes `fontSize`), PPTX export and import read and write the new key (the importer also reads `lang` in the OPF tags of a file exported before 0.34), and the editor's rich-text toolbar and `setRichTextFormat` take `language`. The `opf/language-tag` finding points at `/language`.
