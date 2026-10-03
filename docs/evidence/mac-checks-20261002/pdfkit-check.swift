// RR-17 (Mac checks): reads vector PDFs with PDFKit and CoreGraphics (headless; no window, no app is opened).
// For each <name>.pdf with a <name>.expected.json ({ pages: [text drawn by the SVG of each slide] }): page count, selectable text
// per page compared with the SVG text (character multiset after NFKC; plus how many text lines of the SVG appear verbatim, in logical order, in the extracted text, whitespace, zero-width and bidi controls removed: the same
// comparison as opf-render's PDF evidence), the embedded fonts (Type0 fonts whose descendant has a FontFile2 program), and a
// PDFKit thumbnail with the share of non-white pixels.
//   swiftc -O pdfkit-check.swift -o pdfkit-check && ./pdfkit-check <dir with .pdf and .expected.json> > pdfkit-report.json
import AppKit
import PDFKit

struct Expected: Decodable { let slides: Int; let pages: [String]; let lines: [[String]] }
let dir = CommandLine.arguments[1]
let files = try! FileManager.default.contentsOfDirectory(atPath: dir).filter { $0.hasSuffix(".pdf") }.sorted()

func canonical(_ text: String, sorted: Bool = true) -> String {
    let nfkc = text.precomposedStringWithCompatibilityMapping
    let drop = CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: "\u{200b}\u{200c}\u{200d}\u{200e}\u{200f}\u{2066}\u{2067}\u{2068}\u{2069}\u{202a}\u{202b}\u{202c}\u{202d}\u{202e}\u{061c}\u{feff}"))
    var out: [String] = []
    for scalar in nfkc.unicodeScalars where !drop.contains(scalar) { out.append(String(scalar)) }
    return sorted ? out.sorted().joined() : out.joined()
}
func name(_ obj: CGPDFDictionaryRef, _ key: String) -> String? {
    var p: UnsafePointer<CChar>?
    return CGPDFDictionaryGetName(obj, key, &p) ? String(cString: p!) : nil
}
func dict(_ obj: CGPDFDictionaryRef, _ key: String) -> CGPDFDictionaryRef? {
    var d: CGPDFDictionaryRef?
    return CGPDFDictionaryGetDictionary(obj, key, &d) ? d : nil
}
func array(_ obj: CGPDFDictionaryRef, _ key: String) -> CGPDFArrayRef? {
    var a: CGPDFArrayRef?
    return CGPDFDictionaryGetArray(obj, key, &a) ? a : nil
}
func hasToUnicode(_ f: CGPDFDictionaryRef) -> Bool {
    var s: CGPDFStreamRef?
    return CGPDFDictionaryGetStream(f, "ToUnicode", &s)
}
func fontsOf(page: CGPDFPage) -> [[String: Any]] {
    guard let pageDict = page.dictionary, let res = dict(pageDict, "Resources"), let fonts = dict(res, "Font") else { return [] }
    var out: [[String: Any]] = []
    var items: [(String, CGPDFDictionaryRef)] = []
    CGPDFDictionaryApplyBlock(fonts, { key, value, _ in
        var d: CGPDFDictionaryRef?
        if CGPDFObjectGetValue(value, .dictionary, &d), let d = d { items.append((String(cString: key), d)) }
        return true
    }, nil)
    for (_, f) in items {
        let base = name(f, "BaseFont") ?? "?"
        let subtype = name(f, "Subtype") ?? "?"
        var embedded = false
        var descendant: CGPDFDictionaryRef? = nil
        if let arr = array(f, "DescendantFonts") {
            var d: CGPDFDictionaryRef?
            if CGPDFArrayGetDictionary(arr, 0, &d) { descendant = d }
        }
        if let fd = dict(descendant ?? f, "FontDescriptor") {
            var s: CGPDFStreamRef?
            embedded = CGPDFDictionaryGetStream(fd, "FontFile2", &s) || CGPDFDictionaryGetStream(fd, "FontFile3", &s) || CGPDFDictionaryGetStream(fd, "FontFile", &s)
        }
        let subsetTag = base.count > 7 && base[base.index(base.startIndex, offsetBy: 6)] == "+"
        out.append(["baseFont": base, "subtype": subtype, "embedded": embedded, "subsetTag": subsetTag, "hasToUnicode": hasToUnicode(f)])
    }
    return out
}
func inkShare(_ image: NSImage) -> Double {
    guard let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) else { return -1 }
    var ink = 0
    let w = rep.pixelsWide, h = rep.pixelsHigh
    for y in 0..<h { for x in 0..<w {
        guard let c = rep.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB) else { continue }
        if c.redComponent < 0.97 || c.greenComponent < 0.97 || c.blueComponent < 0.97 { ink += 1 }
    } }
    return (Double(ink) / Double(w * h) * 10000).rounded() / 10000
}

var report: [[String: Any]] = []
for file in files {
    let url = URL(fileURLWithPath: "\(dir)/\(file)")
    let stem = String(file.dropLast(4))
    guard let doc = PDFDocument(url: url) else { report.append(["pdf": stem, "opens": false]); continue }
    let expected = try! JSONDecoder().decode(Expected.self, from: Data(contentsOf: URL(fileURLWithPath: "\(dir)/\(stem).expected.json")))
    var pages: [[String: Any]] = []
    var allFonts: [String: [String: Any]] = [:]
    let cg = CGPDFDocument(url as CFURL)!
    for i in 0..<doc.pageCount {
        let page = doc.page(at: i)!
        let extracted = page.string ?? ""
        let bounds = page.bounds(for: .mediaBox)
        let selection = page.selection(for: bounds)?.string ?? ""
        let extractedOrdered = canonical(extracted, sorted: false)
        let lines = (i < expected.lines.count ? expected.lines[i] : []).map { canonical($0, sorted: false) }.filter { !$0.isEmpty }
        let want = i < expected.pages.count ? canonical(expected.pages[i]) : ""
        let got = canonical(extracted)
        let thumb = page.thumbnail(of: CGSize(width: 640, height: 360), for: .mediaBox)
        pages.append(["page": i + 1, "extractedMatchesSvgText": got == want, "selectionMatchesSvgText": canonical(selection) == want, "textLines": lines.count, "textLinesInLogicalOrder": lines.filter { extractedOrdered.contains($0) }.count, "svgCharacters": want.count, "extractedCharacters": got.count, "thumbnailInkShare": inkShare(thumb)])
        if let cgPage = cg.page(at: i + 1) { for f in fontsOf(page: cgPage) { allFonts[f["baseFont"] as! String] = f } }
    }
    let fonts = allFonts.values.sorted { ($0["baseFont"] as! String) < ($1["baseFont"] as! String) }
    report.append(["pdf": stem, "opens": true, "locked": doc.isLocked, "pageCount": doc.pageCount, "expectedPages": expected.slides, "pages": pages, "fontCount": fonts.count, "allFontsEmbedded": fonts.allSatisfy { $0["embedded"] as! Bool }, "allFontsSubsetTagged": fonts.allSatisfy { $0["subsetTag"] as! Bool }, "fonts": fonts, "version": "\(doc.majorVersion).\(doc.minorVersion)"])
}
let json = try! JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
print(String(data: json, encoding: .utf8)!)
