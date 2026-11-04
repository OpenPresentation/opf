---
name: Diagrams in Markdown
description: A deck written in the OPF Markdown dialect with Mermaid diagrams.
language: en-US
design:
  theme: classic
  colorScheme: forest-green
  fontScheme: aptos
---

<!-- slide: id=flow -->
# Every request is reviewed before it ships

```mermaid
flowchart LR
  A[Request] --> B{Approved?}
  B -->|yes| C[Build]
  B -->|no| D[Revise]
  D --> A
  C --> E[Release]
```

---

<!-- slide: id=api -->
# The client talks to one API

- The client creates a deck with one call
- The API validates it before it answers

```mermaid alt="The client posts a deck; the API validates it and answers 201 Created."
sequenceDiagram
  Client->>API: POST /decks
  API->>API: Validate
  API-->>Client: 201 Created
```

---

<!-- slide: id=ideas -->
# Strategy rests on three themes

```mermaid
mindmap
  root((Strategy))
    Growth
    Efficiency
    People
```
