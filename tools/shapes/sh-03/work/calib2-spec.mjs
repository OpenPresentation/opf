import { writeFileSync } from "node:fs";
const E = px => Math.round(px * 9525);
const clr = (hex, a = 1) => a < 1 ? `<a:srgbClr val="${hex}"><a:alpha val="${Math.round(a*100000)}"/></a:srgbClr>` : `<a:srgbClr val="${hex}"/>`;
const L = s => `<a:effectLst>${s}</a:effectLst>`;
const outer = ({ blur = 0, dist = 0, dir = 0, c = "000000", a = 1 }) => `<a:outerShdw blurRad="${E(blur)}" dist="${E(dist)}" dir="${dir * 60000}" algn="tl" rotWithShape="0">${clr(c, a)}</a:outerShdw>`;
const inner = ({ blur = 0, dist = 0, dir = 0, c = "000000", a = 1 }) => `<a:innerShdw blurRad="${E(blur)}" dist="${E(dist)}" dir="${dir * 60000}">${clr(c, a)}</a:innerShdw>`;
const glow = ({ r, c = "FF0000", a = 1 }) => `<a:glow rad="${E(r)}">${clr(c, a)}</a:glow>`;
const soft = r => `<a:softEdge rad="${E(r)}"/>`;
const blur = r => `<a:blur rad="${E(r)}" grow="1"/>`;
const refl = ({ blur = 0, stA = 100, endA = 0, endPos = 100, dist = 0 }) => `<a:reflection blurRad="${E(blur)}" stA="${stA*1000}" stPos="0" endA="${endA*1000}" endPos="${endPos*1000}" dist="${E(dist)}" dir="5400000" sy="-100000" algn="bl" rotWithShape="0"/>`;
const cell = (i, fx, label, extra = {}) => ({ x: 80 + (i % 4) * 300, y: 60 + Math.floor(i / 4) * 230, w: 200, h: 120, fill: "#4472C4", fx: fx ? L(fx) : "", label, ...extra });
const slides = [{ cells: [
  cell(0, blur(10) + soft(20), "blur10+soft20"), cell(1, blur(10) + inner({ dist: 15, dir: 45, c: "FFFF00" }), "blur+inner"), cell(2, glow({ r: 20, a: 0.5 }) + outer({ dist: 30, dir: 45 }), "glow50+shadow"), cell(3, outer({ dist: 10, dir: 45 }), "text filled shadow", { text: "Shadow" }),
  cell(4, outer({ dist: 10, dir: 45 }), "text nofill shadow", { text: "Shadow", fill: "none", textColor: "#4472C4" }), cell(5, soft(20), "text soft20", { text: "Soft edge" }), cell(6, blur(6), "text blur6", { text: "Blur" }), cell(7, glow({ r: 10 }), "text glow", { text: "Glow" }),
  cell(8, glow({ r: 20 }), "ellipse glow20", { geom: "ellipse" }), cell(9, glow({ r: 10 }), "line roundRect glow", { geom: "roundRect", fill: "none", line: "#4472C4", lineWidth: 6 }), cell(10, soft(20), "ellipse soft20", { geom: "ellipse" }), cell(11, glow({ r: 10, c: "FFC000" }), "text nofill glow", { text: "Glow", fill: "none", textColor: "#4472C4" }),
]}];
writeFileSync("calib2.json", JSON.stringify({ slides }));
