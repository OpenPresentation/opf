---
type: added
packages: [mcp]
---
RR-111: the `ui://opf/deck` content item now asks for the side panel (`_meta.ui.preferredDisplayMode: "fullscreen"`; the host decides). The viewer lays out by the container the host reports (`containerDimensions`, down to 320px wide) and fills the frame in full screen also when the host sends no dimensions, pads itself with the host's `safeAreaInsets`, and at the narrowest size gives every control at least 44 by 44 CSS pixels and wraps long status messages, which clear themselves after a few seconds. Its Expand control asks for the larger view from the click itself, says so when the host keeps the viewer where it is, and offers the way back to the conversation. The bundle carries only zod's English messages (a build rule that fails when it no longer applies), which keeps the viewer under the JSON-RPC frame limit.
