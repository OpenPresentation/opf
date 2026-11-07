import { writeFileSync } from "node:fs";
const E = px => Math.round(px * 9525);
const clr = (hex, a = 1) => a < 1 ? `<a:srgbClr val="${hex}"><a:alpha val="${Math.round(a*100000)}"/></a:srgbClr>` : `<a:srgbClr val="${hex}"/>`;
const L = s => `<a:effectLst>${s}</a:effectLst>`;
const outer = ({ blur = 0, dist = 0, dir = 0, sx, sy, kx, algn = "tl", c = "000000", a = 1 }) => `<a:outerShdw blurRad="${E(blur)}" dist="${E(dist)}" dir="${dir * 60000}"${sx != null ? ` sx="${sx*1000}"` : ""}${sy != null ? ` sy="${sy*1000}"` : ""}${kx != null ? ` kx="${kx*60000}"` : ""} algn="${algn}" rotWithShape="0">${clr(c, a)}</a:outerShdw>`;
const inner = ({ blur = 0, dist = 0, dir = 0, c = "000000", a = 1 }) => `<a:innerShdw blurRad="${E(blur)}" dist="${E(dist)}" dir="${dir * 60000}">${clr(c, a)}</a:innerShdw>`;
const glow = ({ r, c = "FF0000", a = 1 }) => `<a:glow rad="${E(r)}">${clr(c, a)}</a:glow>`;
const soft = r => `<a:softEdge rad="${E(r)}"/>`;
const blur = r => `<a:blur rad="${E(r)}" grow="1"/>`;
const refl = ({ blur = 0, stA = 100, endA = 0, endPos = 100, dist = 0 }) => `<a:reflection blurRad="${E(blur)}" stA="${stA*1000}" stPos="0" endA="${endA*1000}" endPos="${endPos*1000}" dist="${E(dist)}" dir="5400000" sy="-100000" algn="bl" rotWithShape="0"/>`;
const cell = (i, fx, label, extra = {}) => ({ x: 80 + (i % 4) * 300, y: 60 + Math.floor(i / 4) * 230, w: 200, h: 120, fill: "#4472C4", fx: fx ? L(fx) : "", label, ...extra });
const slides = [];
slides.push({ cells: [
  cell(0, outer({ blur: 4 }), "outer blur4"), cell(1, outer({ blur: 10 }), "outer blur10"), cell(2, outer({ blur: 20 }), "outer blur20"), cell(3, outer({ blur: 40 }), "outer blur40"),
  cell(4, outer({ dist: 30, dir: 0 }), "dist30 dir0"), cell(5, outer({ dist: 30, dir: 90 }), "dist30 dir90"), cell(6, outer({ dist: 30, dir: 45 }), "dist30 dir45"), cell(7, outer({ dist: 30, dir: 200, a: 0.5 }), "dist30 dir200 a50"),
  cell(8, outer({ blur: 10, dist: 10, dir: 45, c: "FF0000" }), "red blur10 dist10"), cell(9, outer({ blur: 0, dist: 15, dir: 45 }), "ellipse hard", { geom: "ellipse" }), cell(10, outer({ blur: 0, dist: 15, dir: 45 }), "noFill line hard", { fill: "none", line: "#4472C4", lineWidth: 6 }), cell(11, outer({ blur: 0, dist: 15, dir: 45 }), "fill 50% hard", { fillOpacity: 0.5 }),
]});
slides.push({ cells: [
  cell(0, glow({ r: 4 }), "glow4"), cell(1, glow({ r: 10 }), "glow10"), cell(2, glow({ r: 20 }), "glow20"), cell(3, glow({ r: 40 }), "glow40"),
  cell(4, soft(4), "soft4"), cell(5, soft(10), "soft10"), cell(6, soft(20), "soft20"), cell(7, soft(40), "soft40"),
  cell(8, blur(4), "blur4"), cell(9, blur(10), "blur10"), cell(10, blur(20), "blur20"), cell(11, glow({ r: 20, a: 0.5 }), "glow20 a50", { geom: "ellipse" }),
]});
slides.push({ cells: [
  cell(0, inner({ blur: 0, dist: 15, dir: 45 }), "inner d15 dir45"), cell(1, inner({ blur: 10, dist: 15, dir: 45 }), "inner b10 d15"), cell(2, inner({ blur: 20, dist: 0, dir: 45 }), "inner b20 d0"), cell(3, inner({ blur: 40, dist: 0 }), "inner b40 d0"),
  cell(4, inner({ blur: 0, dist: 15, dir: 225 }), "inner d15 dir225", { geom: "ellipse" }), cell(5, refl({}), "refl full"), cell(6, refl({ endPos: 50, stA: 50 }), "refl st50 end50"), cell(7, refl({ dist: 20, endPos: 50 }), "refl dist20 end50"),
  cell(8, refl({ blur: 10, endPos: 100 }), "refl blur10"), cell(9, refl({ blur: 0, endPos: 100 }), "refl ellipse", { geom: "ellipse" }), cell(10, outer({ blur: 0, dist: 30, dir: 0, sx: 120, sy: 120, algn: "tl" }), "sx120 tl"), cell(11, outer({ blur: 0, dist: 0, sx: 120, sy: 120, algn: "ctr", a: 0.5 }), "sx120 ctr a50"),
]});
slides.push({ cells: [
  cell(0, glow({ r: 20 }) + outer({ blur: 0, dist: 30, dir: 45 }), "glow+shadow"), cell(1, outer({ blur: 0, dist: 30, dir: 45 }) + soft(20), "shadow+soft"), cell(2, glow({ r: 20 }) + soft(20), "glow+soft"), cell(3, inner({ blur: 0, dist: 15, dir: 45, c: "FFFF00" }) + soft(20), "inner+soft"),
  cell(4, glow({ r: 10 }) + outer({ blur: 0, dist: 20, dir: 45 }) + refl({ endPos: 100, stA: 100 }), "glow+shadow+refl"), cell(5, blur(10) + outer({ blur: 0, dist: 30, dir: 45 }), "blur+shadow"), cell(6, blur(10) + glow({ r: 20 }), "blur+glow"), cell(7, refl({ endPos: 100 }) + soft(20), "refl+soft"),
  cell(8, inner({ blur: 0, dist: 15, dir: 45, c: "FFFF00" }) + refl({ endPos: 100 }), "inner+refl"), cell(9, outer({ blur: 0, dist: 30, dir: 45 }), "shadow rot30", { rotate: 30 }), cell(10, outer({ blur: 16, dist: 33.33, dir: 90, sx: 90, sy: -19, algn: "b", a: 0.15 }), "perspective below"), cell(11, outer({ blur: 5.33, dist: 4, dir: 90, a: 0.4, algn: "t" }), "offset bottom"),
]});
writeFileSync("calib.json", JSON.stringify({ slides }));
