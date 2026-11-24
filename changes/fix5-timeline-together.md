---
type: fixed
packages: [opf, render, pptx]
---
TLN-1 (output-changing for lone timelines): a timeline alone in its region drew as a thin strip of small dots and 22 px labels in the middle of an empty body. A lone timeline drawn as a band or with alternating labels now grows in proportion (`TimelineLayoutOptions.sizeScale`): every role by one factor, its event labels up through the type scale to 56 px, the size a short row of headings takes, as far as its box allows with every word whole, every date on one line and an event label on at most two lines. Its markers, the gaps around them and its connector grow with it (`TimelineLayout.lineWidth`, which the preview and the PPTX export draw; absent, the connector keeps 3 px), and it sits in the middle of its box. The lead and the note keep their places above and below it, and the same timeline reads at one size with or without them. Stacked bands (two or more timelines in a region) and duration rails keep their sizes.
The proportional growth never sets a date or event under the size the offset growth gives it; a smaller factor is taken instead.
