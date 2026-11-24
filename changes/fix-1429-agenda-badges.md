---
type: fixed
packages: [pptx]
---
opf#1429: an `agenda` slide of seven or more entries exported to PowerPoint no longer stops with "Duplicate generated step badge shape.". A list that flows into columns composes one sequence of step badges per column, all named for the list's path; the second and later columns now carry their position in their shape names (`OPF steps <path> part 1 badge 0`), so every column keeps its numbered badges, as the preview draws them. A single column keeps the names it had, so decks that exported before export the same bytes.
