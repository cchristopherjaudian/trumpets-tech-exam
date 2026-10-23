# Diagram Conventions

[Purpose: opt into a styled Mermaid convention for design.md diagrams, overriding the plain-Mermaid default]

## Philosophy
- Default (no file present) is plain Mermaid: structure only, no colors
- This file exists only when a project wants diagrams to carry extra visual meaning
- Once present, apply it consistently across every diagram in design.md

## Change-Status Coloring
Distinguish new, changed, and unchanged elements at a glance:
- 🟩 Green = new
- 🟦 Blue = modified/changing
- ⬜ Gray = unchanged
- 🟨 Pale yellow = external system

Implement with `classDef`/`class` in flowchart/graph diagrams:
```
classDef new fill:#9f6,stroke:#333;
classDef changing fill:#9cf,stroke:#333;
classDef unchanged fill:#eee,stroke:#333;
classDef external fill:#ffd,stroke:#333;

class ComponentA new
class ComponentB changing
```
Mermaid has no automatic legend — include a small `Legend` subgraph or a text key near the diagram.

## Module/Ownership Grouping ("Swimlanes")
Group elements by owning system, module, or deployable boundary:
- Flowcharts: `subgraph "Label" ... end` (nest subgraphs when there's natural containment, e.g. modules inside a shared deployment artifact)
- Sequence diagrams: `box transparent "Label" ... end` (or a fill color if the box itself should carry meaning)

## Sequence Diagram Limitation
Mermaid can only color a sequence diagram's `box` group as a whole — never an individual participant's rectangle. If per-participant status needs to be visible, prefix it onto the participant's label instead, and keep boxes grouped by module/ownership only:
```
box transparent Order Service Module
participant OrderDao as 🟩 OrderRepository
participant PaymentDao as ⬜ PaymentGatewayClient
end
```

## Customize Freely
The colors, markers, and grouping rules above are a starting point, not a requirement — adjust them to match the project's own conventions. Whatever is written here is what `/sdd:spec-design` will follow.

---
_Focus on the convention itself; keep examples minimal._
