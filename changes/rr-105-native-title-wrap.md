---
type: fixed
packages: [pptx]
---
Opt-in native wrapped titles preserve the measured line breaks with the same two-sided 1% wrap margin as native bodies, inside the allocated heading area. Balanced titles can use a narrower box; a title without a safe width retains measured lines with a `tight-wrap` diagnostic. Font size, source text, alignment and default measured output are unchanged.

Titles measured with a known visual font substitution retain measured lines and report `font-metrics`; exact and metric-compatible faces remain eligible for native wrapping. Authored native font names and sizes are preserved.

The native wrap planner measures the physical family and style-link flags actually serialized, including Office-safe remapping. If a provider cannot establish that face’s metrics, the title retains measured lines.
