# B07 complete bad/good shape comparison

This is READ-ONLY evidence analysis after the two rejected hypotheses. No new mutant, COM query, native run or product fix was made. Full source, three complete slide XML snapshots, six byte-exact shape fragments, parsed complete shape trees and every leaf difference are retained. The compared inputs are exact original09, the one-token bullet-none fixture, and its actual PowerPoint-saved file. Input SHA identities are in comparison.json; the native outcome remains the reversed first English line.

| Whole property/group | Bad first line | Correct continuation | Finding |
| --- | --- | --- | --- |
| Entire rPr with ALL children | ar-SA/en-US,27.75pt,Aptos Latin + Arabic Typesetting CS,tx1 | Exactly identical | No hidden run-property difference found |
| Entire bodyPr and endParaRPr | Zero insets,wrap none,rtlCol0,anchor top; end ar-SA | Exactly identical | No distinguishing body/end property |
| Paragraph direction/alignment/spacing | rtl0,left,100%line spacing | Same | Native direction1 and LanguageID1025 match both |
| Remaining pPr margins | marL394654,indent-394654 | marL0,indent0 | A real remaining formatting difference |
| Remaining pPr children after buNone mutant | lnSpc,buClr(tx1),buSzPts2775,buFontAptos,buNone | lnSpc,buNone | Three bullet-style children remain only on the bad line |
| Text | 69UTF16 ASCII units; digit1,colon,comma,trailing space | 28ASCII units; no digit/colon/comma; terminal period | Different text composition remains a confound; neither has bidi controls |
| Shape identity/geometry | ID3/line0,x548640,y3430822,width11094720EMU | ID4/line1,x943294,y3860780,width10700066EMU | Expected separate text-box context; heights equal429959EMU |

These are the complete differences: IDs/names, x/y/width, paragraph marL/indent and bullet-style children, text, plus the original-only buAutoNum choice. No other child or property was omitted from the full-tree comparison. In the bullet-none input and saved output, both paragraphs have buNone. Their ENTIRE individual semantic shape trees are unchanged by PowerPoint save/reopen; empty-element spelling and attribute order normalize, but no hidden saved setting explains the difference.

The authored source is one English rich-text item explicitly lang ar-SA, numbering arabic, split into69+28measured-line text boxes. The complete original item equals the exact concatenation of the two text-node strings. Captured native whole-range Font reports are identical Aptos27.75/upright/nonbold; these API names do not establish character-level physical glyph selection. Required1025proofing metadata must not be silently changed as a workaround.

The remaining paragraph-format group is a concrete candidate to isolate, not a proven cause. A separately approved cause test could replace only the bad pPr with the good pPr while retaining bad text/rPr/body/shape transform. Improvement would implicate that paragraph group; unchanged output would leave text-composition/shaping or other context open. Such a group test would still omit numbering and would NOT qualify a product fix. **No such mutant or code fix exists here.**

Run `node docs/handoff/2026-11-10/b07-full-shape-comparison/verify.mjs` offline to check snapshot hashes and retained complete-tree/native facts. compare.mjs documents the read-only extraction and records the original input hashes; it uses the already installed pinned ZIP/XML tooling, not an exporter. comparison.json and raw XML are authoritative for this bounded report. glyphFix:false/currentRuntimeAcceptance:false; B07 remains open. NEVER MERGE the evidence branch.
