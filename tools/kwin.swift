import CoreGraphics
import Foundation
// Lists Keynote's on-screen windows as TSV: id, layer, x, y, w, h, name ("" when untitled or not readable).
// Used by kn-run to notice alerts and sheets (Keynote 16 shows missing fonts as an in-window banner, not a window).
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
for w in list where (w[kCGWindowOwnerName as String] as? String ?? "").hasPrefix("Keynote") {
  let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
  let x = (b["X"] as? Double) ?? 0, y = (b["Y"] as? Double) ?? 0
  let wd = (b["Width"] as? Double) ?? 0, ht = (b["Height"] as? Double) ?? 0
  let name = (w[kCGWindowName as String] as? String) ?? ""
  let layer = w[kCGWindowLayer as String] as? Int ?? 0
  print("\(w[kCGWindowNumber as String]!)\t\(layer)\t\(Int(x))\t\(Int(y))\t\(Int(wd))\t\(Int(ht))\t\(name)")
}
