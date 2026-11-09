---
type: fixed
packages: [pptx]
---
Preserve Latin words and ASCII digit order in measured body text and numbered lists on right-to-left PowerPoint slides. Explicit run languages, text, fonts, geometry and numbering retain their authored values. Bounded per-shape automatic-proofing records preserve the original source language during import; foreign, stripped or edited records retain current native proofing with a finding.
Import also retains explicit native run languages when every run is an override and no base-language vote exists, including an explicit choice equal to the slide language. Curated language aliases keep their existing native BCP-47 normalization.

Canonically equivalent Latin accents share shaping eligibility without normalizing document text. Mixed RTL paragraphs retain explicitly authored French, English and same-base Arabic proofing languages.

Plain text source-boundary recovery also preserves current native run languages when automatic-proofing ownership is missing, stale or partly edited, retaining exact current text and line boundaries without turning the generated body appearance into authored style.
