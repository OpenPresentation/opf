import Foundation
import Vision
import AppKit
// Prints the text Vision recognizes in a picture, one line per observation, top to bottom (offline; no permission needed).
// Used for Keynote's "Warnings – <document>" panel captures. Usage: kocr <image.png>
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let img = NSImage(contentsOf: url), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { exit(1) }
let req = VNRecognizeTextRequest()
req.recognitionLevel = .accurate
req.usesLanguageCorrection = false
try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
let obs = (req.results ?? []).sorted { $0.boundingBox.minY > $1.boundingBox.minY }
for o in obs { if let t = o.topCandidates(1).first { print(t.string) } }
