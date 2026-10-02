---
name: Q3 Business Review
description: A quarterly review written in the OPF Markdown dialect.
author: Operations team
language: en-US
duration: 20
design:
  theme: classic
  colorScheme: forest-green
  fontScheme: aptos
variables:
  risk: "#B42318"
---

<!-- slide: id=cover layout=title section=Overview tag=Q3 -->
# Q3 Business Review

## Operations and growth

Note: Welcome everyone. Two minutes on the agenda, then straight into the numbers.

---

<!-- slide: id=highlights section=Overview -->
# Three things changed this quarter

- **Demand** moved upmarket
  : Enterprise accounts grew from 31% to 44% of bookings.
- Procurement cycles shortened
  - Median approval time fell by nine days
  - Fewer security reviews restarted
- Teams asked for operational controls

Note: Lead with demand. The other two points are consequences of it.

---

<!-- slide: id=revenue section=Results -->
# Revenue grew every quarter

```chart column
Quarter,Revenue,Costs
Q1,12,8
Q2,18,11
Q3,24,15
Q4,29,17
```

Revenue in millions of dollars. Costs include support and hosting.

---

<!-- slide: id=kpis section=Results -->
# Where the numbers landed

```metric
value: 24%
label: Revenue growth
delta: +3 pts
trend: up
```

```metric
value: 92
label: Net promoter score
delta: -2
trend: down
```

```metric
value: 4.8
label: Support rating
unit: out of 5
trend: flat
```

---

<!-- slide: id=risk section=Risks -->
# What could go wrong

Two regions run at [85% utilization]{color=var:risk} with no spare capacity.

> We would rather spend a week on capacity than a month on an outage.
> — Priya Raman, Head of Platform
> — Platform review, September

---

<!-- slide: id=decisions section=Risks -->
# Decisions we need today

| Decision | Owner | Needed by |
| --- | --- | --- |
| Approve the capacity plan | Platform | Oct 15 |
| Hire two site engineers | People | Nov 1 |
| Retire the legacy billing export | Finance | Dec 1 |

---

<!-- slide: id=roadmap section=Next -->
# The next four quarters

```timeline name="Roadmap"
2026 Q4 — Capacity plan approved
  Two regions gain headroom
2027 Q1 — Billing migration
2027 Q2 — Self-serve controls
2027 Q3 — Regional data residency
```

---

<!-- slide: id=compare section=Next -->
# Operating model

<!-- block: as=bullets region=left -->
- One on-call rotation per region
- Quarterly capacity reviews

<!-- block: region=right -->
Every change ships behind a flag, so a rollback is a configuration edit and not a deploy.

---

<!-- slide: id=gate section=Next -->
# The release gate

```python title="gate.py"
def release_allowed(risk, owner):
    return risk < 0.2 and owner is not None
```

![Dashboard showing the release gate](./assets/release-gate.png "The release gate in the dashboard")

---

<!-- slide: id=appendix section=Appendix hidden -->
# Appendix: data sources

Revenue comes from the billing ledger. Satisfaction scores come from the quarterly survey.
