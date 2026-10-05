// RR-17 (Mac checks): are the qlmanage thumbnails real renderings? Prints, per PNG, its size and the number of distinct colours
// (a generic file icon or a blank page has very few). Headless: reads PNGs with ImageIO only.
//   swiftc -O thumbstat.swift -o thumbstat && ./thumbstat <png>... 
import Foundation
import ImageIO
for path in CommandLine.arguments.dropFirst() {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil), let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("\(path)\tunreadable"); continue }
    let w = img.width, h = img.height
    var data = [UInt8](repeating: 0, count: w * h * 4)
    let ctx = CGContext(data: &data, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    var colours = Set<UInt32>()
    var i = 0
    while i < data.count { colours.insert(UInt32(data[i]) << 16 | UInt32(data[i + 1]) << 8 | UInt32(data[i + 2])); i += 4 }
    print("\((path as NSString).lastPathComponent)\t\(w)x\(h)\t\(colours.count) colours")
}
