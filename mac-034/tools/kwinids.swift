import CoreGraphics
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
for w in list where (w[kCGWindowOwnerName as String] as? String ?? "").contains("Keynote") {
  if (w[kCGWindowLayer as String] as? Int ?? 0) == 0 { print(w[kCGWindowNumber as String]!) }
}
