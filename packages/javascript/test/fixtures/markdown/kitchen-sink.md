---
name: Kitchen sink
# a YAML comment is fine in front matter
language: en-US
tags: [alpha, beta]
variables:
  risk: "#B42318"
---

<!-- slide: id=one layout=title section="Part 1" -->
# Title with a *styled* word ##

## Subtitle

Soft wrapped
paragraph with a hard\
break and a [link](https://example.com/a_b "ignored title").

* star bullet
  * nested star
+ plus bullet

1. numbered one
2. numbered two

---

<!-- slide: hidden -->
# Block variety

> Quoted words
> continue here
> -- Ada Lovelace, Analyst

~~~python title="a.py"
print("tilde fence")
~~~

| Item | Qty |
|:--|--:|
| Pens | 12 |
| Paper | 007 |
| Ink |  |

![Dashboard](<assets/dash board.png> "Q3")

```chart pie
Region,Share
North,40
South,"60"
```

```chart line
{"columns":["x","y"],"rows":[[1,2],[3,4]]}
```

```metric
value: 42%
label: "Uptime: 30 days"
unit: %
```

```timeline
Now — Plan
Q1 2027: Launch
  with a description
Someday
```

### A small heading

Notes: first line
second line

# not a title inside notes

---

<!-- slide: id=three -->
<!-- block: id=left-col region=left -->
Left text

<!-- block: as=bullets region=right -->
- right one
- right two

```opf-slide
extensions:
  owner: ops
```
