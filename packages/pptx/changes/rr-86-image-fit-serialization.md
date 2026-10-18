---
type: fixed
---
RR-86: preserve an unchanged contain image when fitting in millionths of an inch and serializing to EMUs rounds its dimensions differently. Import compares the current raster and frame against those exact serialization cells; genuine native stretches and unsupported crop/fill diagnostics keep their existing behavior.
