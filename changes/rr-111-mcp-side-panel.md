---
type: added
packages: [mcp]
---
RR-111: the `ui://opf/deck` content item now asks for the side panel (`_meta.ui.preferredDisplayMode: "fullscreen"`; the host decides). The viewer lays out by the container the host reports (`containerDimensions`, down to 320px wide) instead of by display mode, pads itself with the host's `safeAreaInsets`, and its Expand control asks for the larger view from the click itself, says so when the host keeps the viewer where it is, and offers the way back to the conversation. The bundle carries only zod's English messages, which keeps the viewer under the JSON-RPC frame limit.
