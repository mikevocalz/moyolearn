//
// URL+sha256Hex.swift
// Streams a regular file through CryptoKit's SHA-256 in 1 MiB reads.
//
// Each read runs inside its own autoreleasepool: NSFileHandle returns
// autoreleased NSData, and a GCD block drains its pool only when it ends, so
// without the pool a multi-gigabyte file would hold every chunk until EOF.
// The descriptor is checked with fstat after opening, so a path swapped for a
// FIFO or device between validation and open still cannot block the queue.
// SOT-KEYWORDS: desktop nitro sha256 cryptokit file hash autoreleasepool
//

import CryptoKit
import Foundation
import NitroModules

extension URL {
  func sha256Hex() throws -> String {
    let handle = try FileHandle(forReadingFrom: self)
    // A read-only descriptor has nothing to flush, so a close error carries no signal.
    defer { try? handle.close() }
    var info = stat()
    guard fstat(handle.fileDescriptor, &info) == 0, (info.st_mode & S_IFMT) == S_IFREG else {
      throw RuntimeError("hashFile expects a regular file")
    }
    var hasher = SHA256()
    var readError: Error?
    var more = true
    while more {
      autoreleasepool {
        do {
          if let chunk = try handle.read(upToCount: 1 << 20), !chunk.isEmpty {
            hasher.update(data: chunk)
          } else {
            more = false
          }
        } catch {
          readError = error
          more = false
        }
      }
    }
    if let readError { throw readError }
    return hasher.finalize().map { String(format: "%02x", $0) }.joined()
  }
}
