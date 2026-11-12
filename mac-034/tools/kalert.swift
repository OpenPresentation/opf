import CoreGraphics
// Prints the window ids of on-screen Keynote alert panels (small, untitled, layer 0).
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
for w in list where (w[kCGWindowOwnerName as String] as? String ?? "").contains("Keynote") {
  let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
  let wd = (b["Width"] as? Double) ?? 0, ht = (b["Height"] as? Double) ?? 0
  let name = (w[kCGWindowName as String] as? String) ?? ""
  if (w[kCGWindowLayer as String] as? Int ?? 0) == 0 && name.isEmpty && wd > 200 && wd < 320 && ht > 150 && ht < 300 { print(w[kCGWindowNumber as String]!) }
}
