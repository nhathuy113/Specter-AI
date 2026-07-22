#!/usr/bin/env swift
// Read frontmost window bounds without activating System Events (no focus steal).
import Cocoa
import CoreGraphics

guard let app = NSWorkspace.shared.frontmostApplication else {
    print("")
    exit(0)
}

let pid = app.processIdentifier
let appName = app.localizedName ?? ""
let opts = CGWindowListOption(arrayLiteral: .optionOnScreenOnly, .excludeDesktopElements)
guard let list = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] else {
    print("")
    exit(0)
}

for w in list {
    guard let ownerPid = w[kCGWindowOwnerPID as String] as? Int32, ownerPid == pid else { continue }
    guard let layer = w[kCGWindowLayer as String] as? Int, layer == 0 else { continue }
    guard let bounds = w[kCGWindowBounds as String] as? [String: Double] else { continue }
    let width = Int(bounds["Width"] ?? 0)
    let height = Int(bounds["Height"] ?? 0)
    if width < 50 || height < 50 { continue }
    let x = Int(bounds["X"] ?? 0)
    let y = Int(bounds["Y"] ?? 0)
    let title = (w[kCGWindowName as String] as? String) ?? ""
    print("\(x)|\(y)|\(width)|\(height)|\(appName)|\(title)")
    exit(0)
}

print("")
