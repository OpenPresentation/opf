---
type: fixed
packages: [pptx]
---

The PowerPoint export no longer reports `numbering-unsupported-core` ("the installed @openpresentation/opf does not compose numbered lists") for numbered steps drawn as a stepper (LH-168): their numbers are on the step badges, which the export writes, so the warning was false. A numbered list without badges still writes native auto-numbers. Found by the v0.33 PowerPoint qualification.
