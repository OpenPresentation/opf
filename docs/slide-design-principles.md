# Slide Design Principles

Precise slide design makes ideas easy to understand through clear hierarchy, deliberate proportions, and carefully controlled typography and space. A restrained slide can achieve exceptional quality through the relationships between its elements.

Use these principles to design individual slides, build reusable layouts, and review automatic composition. Judge the rendered result in its intended viewing conditions. Content, meaning, and legibility take priority over a template's preferred shape.

## Layout and space

| Criterion | Standard |
| --- | --- |
| Layout logic | Express the relationship in the arrangement. Place comparisons together, sequences in order, and evidence beside the claim it supports. |
| Grid and structure | Organize elements with a small set of repeatable alignment lines and deliberate column widths. |
| Margins | Maintain stable outer boundaries and enough breathing room around content. Allow an intentional full bleed image to use the edge. |
| Alignment | Give related elements shared edges, centers, or text baselines. Align visible content as well as its containers. |
| Optical alignment | Adjust mathematically aligned elements when their visible shapes appear uneven. Match logos and icons by apparent size and weight. |
| Spacing | Use a repeatable scale of gaps. Give comparable relationships comparable spacing. |
| Proximity and grouping | Keep related items close; separate independent groups more clearly. Make grouping apparent before the words are read. |
| Padding | Give content comfortable, consistent internal space. Account for padding when allocating the usable area of a container. |
| Proportions and sizing | Allocate space by importance and content needs. Equivalent comparisons deserve equivalent space; primary evidence often needs more room than commentary. |
| Visual balance | Balance the apparent weight of text, images, dark areas, and empty space. Both symmetrical and asymmetrical compositions can be stable. |
| Negative space | Use empty areas to establish focus, separation, and rest. Consider both broad open areas and small gaps between elements. |

## Hierarchy and typography

| Criterion | Standard |
| --- | --- |
| Hierarchy and emphasis | Make the main takeaway apparent, followed by supporting content and then references. Reserve the strongest emphasis for what matters most. |
| Reading order | Give the eye a clear route through the slide. Reinforce the intended sequence with placement, grouping, and emphasis. |
| Typeface selection | Choose readable letterforms and numerals suited to the subject, audience, language, and medium. Use a restrained font system. |
| Type scale and weight | Define stable roles for titles, body text, labels, and notes. Make role differences clear and repeat them across slides. |
| Typesetting | Control line length, line spacing, paragraph gaps, and line breaks. Keep meaningful phrases together and resolve awkward isolated words. |
| Content density | Give each slide a clear main job and sufficient space to perform it. Preserve necessary evidence while editing, reorganizing, or distributing demanding material. |
| Legibility | Keep essential text and marks readable at the actual display size and viewing distance. Verify labels as carefully as titles. |
| Color discipline | Use a limited palette with consistent roles. Give additional colors a specific meaning. |
| Contrast and accessibility | Preserve meaningful distinctions under projection, small displays, and different color perception. Reinforce color with labels, shapes, or position. |

## Visual evidence and finish

| Criterion | Standard |
| --- | --- |
| Images and cropping | Use images that contribute to the message, with adequate resolution and deliberate crops. Preserve the subject and useful contextual detail. |
| Icons, shapes, and lines | Use a coherent visual family with consistent apparent size and stroke weight. Make connectors clear and their endpoints unambiguous. |
| Charts | Support a specific comparison or finding with an appropriate chart. Use honest scales, readable labels, consistent units, and purposeful emphasis. |
| Tables | Fit column widths to their contents. Align numbers for comparison and use consistent precision and units. Keep rules and shading subordinate to the data. |
| Consistency and repetition | Retain dimensions, positions, type styles, and treatments for recurring components. Give recurring visual treatments recurring meanings. |
| Rhythm across slides | Vary layouts according to content while retaining the same design system. Provide breathing room around demanding slides. |
| Restraint and appropriateness | Require every visible element to contribute to meaning, navigation, or identity. Match the audience and subject. |
| Production finish | Deliver clean wrapping, sharp assets, correct fonts, accurate alignment, and complete content without clipping or unintended overlap. |

## Practical starting values

For an ordinary live business presentation at standard widescreen size, approximately 13.33 by 7.5 inches, begin with these values and adjust through visual review:

- Outer margins: about 5–6 percent of width on either side and 6–8 percent of height above and below.
- Type: around 36–44 pt for titles, 24–28 pt for body text, and 18–22 pt for supporting labels. Grow essential labels when the display or room requires it. A document read closely can use a different scale.
- Spacing: choose a base gap; begin with roughly one unit within a group, two units between groups, and three or four units between major regions.
- Proportions: start with equal columns for equivalent items or one third and two thirds when one region supports another. Let the content determine the final allocation.
- Typography: begin with one font family and regular and semibold weights.
- Color: begin with neutral background and text plus one accent; introduce semantic colors when the content calls for them.

These are starting values. Coordinate systems, slide sizes, font metrics, and viewing conditions change their application. Judge actual text size, wrapping, and visible balance. There is no required whitespace percentage or universal column ratio.

## Reviewing layout defaults

A strong default produces a coherent slide from content and a layout choice with very little author styling. Put durable design decisions in reusable layout definitions or shared rendering behavior.

1. Establish the baseline with realistic content, the default theme, and no optional visual overrides. Content structure, such as grouping related material, is a meaningful input.
2. Record the exact layout definition, package versions, resolved defaults, fonts, and measurement provider. Keep the input document with the rendered output.
3. Review the full slide for message, hierarchy, proportions, balance, and density. Review it close up for alignment, gaps, wrapping, cropping, and labels.
4. Exercise short and long content, empty optional regions, different item counts, and mixed payloads. A single attractive sample is insufficient evidence of a robust layout.
5. State each issue as an observation, its consequence for the reader, the likely cause, and a concrete proposed improvement.
6. Change the smallest responsible layer. Prefer a layout-definition improvement when that layout owns the relationship. Shared engine behavior needs broader evidence across affected layouts.
7. Render the same content before and after with the same fonts and settings. Demonstrate the improvement and examine any tradeoffs.
8. Verify schema validity, content preservation, geometry findings, and the final rendered result separately. Successful validation alone does not establish visual quality.

Use three review outcomes: **strong**, **usable with refinement**, and **needs correction**. Describe specific evidence for the outcome. Treat clipping, lost content, unreadable essentials, and misleading data geometry as failures regardless of aesthetic polish.

## Automatic composition

Automatic composition should preserve grouping and reading order, provide adequate space for each payload, and produce a clear hierarchy with minimal author intervention. Compare plausible arrangements by their actual content needs and visible result.

Exercise text, lists, comparisons, charts, tables, images, quotes, metrics, timelines, and mixed or nested content. Include uneven content lengths, different aspect ratios, sparse slides, and denser realistic cases. Record what the algorithm can measure and what still requires visual inspection.

Readable text alone is insufficient evidence of good composition. Look for oversized minor elements, equal allocations given to unequal content, isolated leftovers, weak grouping, uncomfortable line lengths, excessive title regions, and unbalanced empty areas. Preserve the meaning and source order when improving the arrangement.
