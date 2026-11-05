//
// URL+regularFile.swift
// Validates a JS-supplied path before work is queued: absolute, no NUL, and a
// regular file. Devices and FIFOs are refused here because /dev/zero would hash
// forever and a FIFO would block the serial hash queue for every later call.
// SOT-KEYWORDS: desktop nitro path validation url regular file
//

import Foundation
import NitroModules

extension URL {
  static func regularFile(path: String) throws -> URL {
    guard path.hasPrefix("/"), !path.contains("\0") else {
      throw RuntimeError("hashFile expects an absolute file path")
    }
    let url = URL(fileURLWithPath: path)
    let values = try url.resourceValues(forKeys: [.isRegularFileKey])
    guard values.isRegularFile == true else {
      throw RuntimeError("hashFile expects a regular file")
    }
    return url
  }
}
