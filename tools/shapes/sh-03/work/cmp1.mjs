const cell = (i, effects, label, extra = {}) => ({ x: 80 + (i % 4) * 300, y: 60 + Math.floor(i / 4) * 230, w: 200, h: 120, fill: "#4472C4", effects, label, ...extra });
import s4 from "./slide4.mjs";
export default { slides: [
  { cells: [
    cell(0, { shadow: { color: "#000000", opacity: 1, blur: 20, distance: 0 } }, "outer blur20"), cell(1, { shadow: { color: "#000000", opacity: 1, blur: 0, distance: 30, angle: 45 } }, "hard 30/45"),
    cell(2, { shadow: { color: "#FF0000", opacity: 1, blur: 10, distance: 10, angle: 45 } }, "red b10 d10"), cell(3, { shadow: { color: "#000000", opacity: 0.5, blur: 0, distance: 0, size: 1.2 } }, "size 1.2"),
    cell(4, { glow: { color: "#FF0000", opacity: 1, radius: 10 } }, "glow10"), cell(5, { glow: { color: "#FF0000", opacity: 1, radius: 40 } }, "glow40"),
    cell(6, { glow: { color: "#FF0000", opacity: 1, radius: 20 } }, "ellipse glow20", { geom: "ellipse" }), cell(7, { glow: { color: "#FF0000", opacity: 0.5, radius: 20 } }, "glow20 50%"),
    cell(8, { softEdge: 10 }, "soft10"), cell(9, { softEdge: 20 }, "ellipse soft20", { geom: "ellipse" }), cell(10, { blur: 10 }, "blur10"), cell(11, { blur: 10, softEdge: 20 }, "blur10+soft20"),
  ] },
  { cells: [
    cell(0, { innerShadow: { color: "#000000", opacity: 1, blur: 0, distance: 15, angle: 45 } }, "inner d15 45"), cell(1, { innerShadow: { color: "#000000", opacity: 1, blur: 20, distance: 0 } }, "inner b20"),
    cell(2, { innerShadow: { color: "#000000", opacity: 1, blur: 0, distance: 15, angle: 225 } }, "ellipse inner 225", { geom: "ellipse" }), cell(3, { innerShadow: { color: "#FFFF00", opacity: 1, blur: 0, distance: 15, angle: 45 }, softEdge: 20 }, "inner+soft"),
    cell(4, { reflection: { opacity: 1, size: 1, distance: 0, blur: 0 } }, "refl full"), cell(5, { reflection: { opacity: 0.5, size: 0.5, distance: 20, blur: 0 } }, "refl .5 .5 d20"),
    cell(6, { reflection: { opacity: 1, size: 1, blur: 10 } }, "refl blur10"), cell(7, { reflection: { opacity: 1, size: 1 }, softEdge: 20 }, "refl+soft"),
    cell(8, { glow: { color: "#FF0000", opacity: 1, radius: 20 }, shadow: { color: "#000000", opacity: 1, blur: 0, distance: 30, angle: 45 } }, "glow+shadow"),
    cell(9, { shadow: { color: "#000000", opacity: 1, blur: 0, distance: 30, angle: 45 }, softEdge: 20 }, "shadow+soft"),
    cell(10, { shadow: { color: "#000000", opacity: 1, blur: 0, distance: 30, angle: 45 } }, "shadow rot30", { rotate: 30 }),
    cell(11, { shadow: { color: "#000000", opacity: 1, blur: 0, distance: 15, angle: 45 } }, "noFill line", { fill: "none", line: "#4472C4", lineWidth: 6 }),
  ] },
  { cells: [
    cell(0, { shadow: "soft" }, "preset soft"), cell(1, { shadow: "hard" }, "preset hard"), cell(2, { shadow: "perspective" }, "preset perspective"), cell(3, { shadow: { color: "#000000", opacity: 1, distance: 10, angle: 45, blur: 0 } }, "text nofill shadow", { text: "Shadow", fill: "none", textColor: "#4472C4" }),
    cell(4, { glow: { color: "#FF0000", opacity: 1, radius: 10 }, shadow: { color: "#000000", opacity: 1, blur: 0, distance: 20, angle: 45 }, reflection: { opacity: 1, size: 1 } }, "glow+shadow+refl"),
    cell(5, { softEdge: 20 }, "text soft", { text: "Soft edge" }), cell(6, { blur: 6 }, "text blur", { text: "Blur" }), cell(7, { glow: { color: "#FFC000", opacity: 1, radius: 10 } }, "text nofill glow", { text: "Glow", fill: "none", textColor: "#4472C4" }),
    cell(8, { innerShadow: { color: "#FFFF00", opacity: 1, distance: 15, angle: 45, blur: 0 }, blur: 10 }, "inner+blur"), cell(9, { glow: { color: "#FF0000", opacity: 1, radius: 10 } }, "line roundRect glow", { geom: "roundRect", fill: "none", line: "#4472C4", lineWidth: 6 }),
    cell(10, { shadow: { color: "#000000", opacity: 1, blur: 0, distance: 15, angle: 45 } }, "fill 50%", { fillOpacity: 0.5 }), cell(11, { glow: { color: "#FF0000", opacity: 0.5, radius: 20 }, shadow: { color: "#000000", opacity: 1, distance: 30, angle: 45, blur: 0 } }, "glow50+shadow"),
  ] },
  s4,
] };
