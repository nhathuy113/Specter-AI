#!/usr/bin/env swift
// Read frontmost window bounds, or restore focus to a PID (background capture).
import Cocoa
import CoreGraphics

if CommandLine.arguments.count >= 3 && CommandLine.arguments[1] == "--activate-pid" {
    if let pid = Int32(CommandLine.arguments[2]),
       let app = NSRunningApplication(processIdentifier: pid),
       app.bundleIdentifier != Bundle.main.bundleIdentifier {
        app.activate(options: [])
    }
    exit(0)
}

guard let app = NSWorkspace.shared.frontmostApplication else {
    print("")
    exit(0)
}

let pid = app.processIdentifier
let appName = app.localizedName ?? ""
let bundleId = app.bundleIdentifier ?? ""
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
    print("\(x)|\(y)|\(width)|\(height)|\(pid)|\(bundleId)|\(appName)|\(title)")
    exit(0)
}

print("")
