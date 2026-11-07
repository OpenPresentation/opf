const cell = (i, effects, label, extra = {}) => ({ x: 80 + (i % 4) * 300, y: 60 + Math.floor(i / 4) * 230, w: 200, h: 120, fill: "#4472C4", effects, label, ...extra });
export default { cells: [
  cell(0, { shadow: "soft" }, "soft on ellipse", { geom: "ellipse" }), cell(1, { shadow: "hard" }, "hard on roundRect", { geom: "roundRect" }),
  cell(2, { shadow: "perspective" }, "perspective on ellipse", { geom: "ellipse" }), cell(3, { shadow: { color: "accent", size: 1.05, blur: 12, distance: 0 } }, "accent halo size 1.05"),
  cell(4, { innerShadow: {} }, "innerShadow defaults"), cell(5, { glow: {} }, "glow defaults"),
  cell(6, { reflection: {} }, "reflection defaults"), cell(7, { softEdge: 6 }, "softEdge 6"),
  cell(8, { blur: 3 }, "blur 3", { text: "Blur 3" }), cell(9, { glow: { color: "#FFC000", radius: 12, opacity: 0.6 }, shadow: "soft" }, "glow 12 + soft", { geom: "ellipse" }),
  cell(10, { innerShadow: { opacity: 0.6, blur: 12, distance: 6, angle: 270 }, reflection: { opacity: 0.35, size: 0.5, distance: 6, blur: 3 } }, "inner 270 + reflection", { geom: "roundRect" }),
  cell(11, { shadow: { opacity: 0.5, blur: 8, distance: 10, angle: 135 } }, "shadow 135, ellipse turned 20", { geom: "ellipse", rotate: 20 }),
] };

