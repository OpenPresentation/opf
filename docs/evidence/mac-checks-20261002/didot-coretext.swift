// RR-17 (Didot): an independent CoreText check of the fontkit widths, and a side-by-side render of the real Didot (system font,
// read in place through CoreText) and the bundled Playfair Display with the same text.
//   swiftc -O didot-coretext.swift -o didot-coretext && ./didot-coretext <opf-render package root> <out dir>
import AppKit
import CoreText

let args = CommandLine.arguments
let renderRoot = args[1]
let outDir = args[2]
let playfairDir = "\(renderRoot)/fonts/playfair-display"

func playfair(_ file: String, _ size: CGFloat) -> CTFont {
    let url = URL(fileURLWithPath: "\(playfairDir)/\(file)") as CFURL
    let descriptors = CTFontManagerCreateFontDescriptorsFromURL(url) as! [CTFontDescriptor]
    return CTFontCreateWithFontDescriptor(descriptors[0], size, nil)
}
func didot(_ name: String, _ size: CGFloat) -> CTFont { CTFontCreateWithName(name as CFString, size, nil) }
func width(_ font: CTFont, _ text: String) -> Double {
    let attr = NSAttributedString(string: text, attributes: [.font: font])
    let line = CTLineCreateWithAttributedString(attr)
    return CTLineGetTypographicBounds(line, nil, nil, nil)
}
let samples = [
    "The quick brown fox jumps over the lazy dog",
    "Quarterly revenue grew 24% year over year",
    "Strategy, execution and measurement",
    "Customer onboarding checklist",
    "Annual General Meeting 2027 agenda",
]
var rows: [[String: Any]] = []
for (label, dName, pFile) in [("400", "Didot", "PlayfairDisplay-Regular.ttf"), ("700", "Didot-Bold", "PlayfairDisplay-Bold.ttf"), ("400i", "Didot-Italic", "PlayfairDisplay-Italic.ttf")] {
    let d = didot(dName, 1000)
    let p = playfair(pFile, 1000)
    var ratios: [Double] = []
    for s in samples { ratios.append(width(p, s) / width(d, s)) }
    let mean = ratios.reduce(0, +) / Double(ratios.count)
    rows.append(["style": label, "didotPostScript": CTFontCopyPostScriptName(d) as String, "coreTextWidthRatioPlayfairOverDidot": ratios.map { (($0 * 10000).rounded()) / 10000 }, "mean": (mean * 10000).rounded() / 10000])
}
let json = try! JSONSerialization.data(withJSONObject: ["tool": "docs/evidence/mac-checks-20261002/didot-coretext.swift", "samples": samples, "styles": rows], options: [.prettyPrinted, .sortedKeys])
try! json.write(to: URL(fileURLWithPath: "\(outDir)/didot-coretext-widths.json"))

// Side-by-side render.
let W = 1000, H = 640
let cs = CGColorSpaceCreateDeviceRGB()
let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
func draw(_ text: String, _ font: CTFont, at point: CGPoint, color: CGColor = CGColor(red: 0.1, green: 0.1, blue: 0.1, alpha: 1)) {
    let attr = NSAttributedString(string: text, attributes: [.font: font, .foregroundColor: NSColor(cgColor: color)!])
    let line = CTLineCreateWithAttributedString(attr)
    ctx.textPosition = point
    CTLineDraw(line, ctx)
}
let label = didot("Helvetica", 15)
let text = "Strategy, execution and measurement"
var y = CGFloat(H) - 50
for (name, dName, pFile) in [("Regular", "Didot", "PlayfairDisplay-Regular.ttf"), ("Bold", "Didot-Bold", "PlayfairDisplay-Bold.ttf"), ("Italic", "Didot-Italic", "PlayfairDisplay-Italic.ttf")] {
    let grey = CGColor(red: 0.45, green: 0.45, blue: 0.45, alpha: 1)
    draw("Didot \(name) (system font, 40 pt)", label, at: CGPoint(x: 20, y: y), color: grey)
    y -= 50; draw(text, didot(dName, 40), at: CGPoint(x: 20, y: y))
    y -= 40; draw("Playfair Display \(name) (bundled replacement, 40 pt)", label, at: CGPoint(x: 20, y: y), color: grey)
    y -= 50; draw(text, playfair(pFile, 40), at: CGPoint(x: 20, y: y))
    y -= 50
    ctx.setStrokeColor(CGColor(red: 0.85, green: 0.85, blue: 0.85, alpha: 1)); ctx.move(to: CGPoint(x: 20, y: y + 28)); ctx.addLine(to: CGPoint(x: CGFloat(W) - 20, y: y + 28)); ctx.strokePath()
}
let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(outDir)/didot-vs-playfair.png"))
print(String(data: json, encoding: .utf8)!)
