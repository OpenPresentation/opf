---
type: fixed
packages: [opf]
---
RR-105: a lone short message on a narrow slide (9:16, 4:5, 1:1) now grows to the largest display step whose lines keep the minimum measure (49 px for a two-line sentence) instead of falling back to its plain 43 px, so it fills those slides as it does a 16:9 one. Lists, tables and metrics already reach their display sizes and sit in the middle on every slide size; those caps are unchanged.
