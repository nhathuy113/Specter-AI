#!/usr/bin/env swift
// Read frontmost window bounds, list browser windows, or restore focus to a PID.
import Cocoa
import CoreGraphics

let browserBundleIds: Set<String> = [
    "com.google.Chrome",
    "com.brave.Browser",
    "com.apple.Safari",
    "org.mozilla.firefox",
    "com.microsoft.edgemac",
    "com.operasoftware.Opera"
]

func isBrowserApp(_ bundleId: String, _ appName: String) -> Bool {
    if browserBundleIds.contains(bundleId) { return true }
    let lower = appName.lowercased()
    return lower.contains("chrome") || lower.contains("safari") || lower.contains("firefox")
        || lower.contains("brave") || lower.contains("edge") || lower.contains("opera")
}

func emitWindow(_ bounds: [String: Double], pid: Int32, bundleId: String, appName: String, title: String) {
    let width = Int(bounds["Width"] ?? 0)
    let height = Int(bounds["Height"] ?? 0)
    if width < 200 || height < 200 { return }
    let x = Int(bounds["X"] ?? 0)
    let y = Int(bounds["Y"] ?? 0)
    print("\(x)|\(y)|\(width)|\(height)|\(pid)|\(bundleId)|\(appName)|\(title)")
}

if CommandLine.arguments.count >= 3 && CommandLine.arguments[1] == "--activate-pid" {
    if let pid = Int32(CommandLine.arguments[2]),
       let app = NSRunningApplication(processIdentifier: pid),
       app.bundleIdentifier != Bundle.main.bundleIdentifier {
        app.activate(options: [])
    }
    exit(0)
}

if CommandLine.arguments.count >= 2 && CommandLine.arguments[1] == "--list-browsers" {
    let opts = CGWindowListOption(arrayLiteral: .optionOnScreenOnly, .excludeDesktopElements)
    guard let list = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] else {
        exit(0)
    }

    var seen = Set<String>()
    for w in list {
        guard let layer = w[kCGWindowLayer as String] as? Int, layer == 0 else { continue }
        guard let ownerPid = w[kCGWindowOwnerPID as String] as? Int32 else { continue }
        guard let bounds = w[kCGWindowBounds as String] as? [String: Double] else { continue }
        let appName = (w[kCGWindowOwnerName as String] as? String) ?? ""
        let bundleId = NSRunningApplication(processIdentifier: ownerPid)?.bundleIdentifier ?? ""
        if bundleId == Bundle.main.bundleIdentifier || appName.lowercased().contains("specter") { continue }
        if !isBrowserApp(bundleId, appName) { continue }
        let title = (w[kCGWindowName as String] as? String) ?? ""
        let width = Int(bounds["Width"] ?? 0)
        let height = Int(bounds["Height"] ?? 0)
        let key = "\(ownerPid)|\(width)|\(height)|\(title)"
        if seen.contains(key) { continue }
        seen.insert(key)
        emitWindow(bounds, pid: ownerPid, bundleId: bundleId, appName: appName, title: title)
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
