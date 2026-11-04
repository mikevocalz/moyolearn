// Cut the main subject out of a photo, on this Mac, with Apple's Vision
// framework (the same model as "Lift subject" in Photos). macOS 14+.
//   swift <skill>/scripts/cutout.swift <photo.jpg> <out.png>
// Writes a PNG with transparency, cropped to the subject.
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 3 else { print("usage: swift cutout.swift <photo> <out.png>"); exit(2) }
let input = URL(fileURLWithPath: args[1]), output = URL(fileURLWithPath: args[2])
guard let ci = CIImage(contentsOf: input, options: [.applyOrientationProperty: true]) else { print("cannot read \(input.path)"); exit(1) }
let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(ciImage: ci)
do {
  try handler.perform([request])
  guard let result = request.results?.first, !result.allInstances.isEmpty else { print("No subject found. Use a photo with one clear subject, or ask the user for a cut-out."); exit(1) }
  // Harden the soft edge Vision returns (it leaves a halo of background), then
  // cut the original with it and crop to the subject.
  let maskBuffer = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
  let soft = CIImage(cvPixelBuffer: maskBuffer)
  let hard = soft.applyingFilter("CIColorMatrix", parameters: [
    "inputRVector": CIVector(x: 2.2, y: 0, z: 0, w: 0), "inputGVector": CIVector(x: 0, y: 2.2, z: 0, w: 0),
    "inputBVector": CIVector(x: 0, y: 0, z: 2.2, w: 0), "inputAVector": CIVector(x: 0, y: 0, z: 0, w: 1),
    "inputBiasVector": CIVector(x: -0.75, y: -0.75, z: -0.75, w: 0)]).applyingFilter("CIColorClamp")
    .applyingGaussianBlur(sigma: 0.6).cropped(to: ci.extent)
  let cut = ci.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: CIImage.empty(), kCIInputMaskImageKey: hard])
  // Find the subject's box from the mask itself.
  let ctx = CIContext()
  var extent = ci.extent
  if let maskCG = ctx.createCGImage(hard, from: ci.extent, format: .L8, colorSpace: CGColorSpaceCreateDeviceGray()),
     let data = maskCG.dataProvider?.data, let ptr = CFDataGetBytePtr(data) {
    let mw = maskCG.width, mh = maskCG.height, row = maskCG.bytesPerRow
    var minX = mw, minY = mh, maxX = 0, maxY = 0
    for y in 0..<mh { for x in 0..<mw where ptr[y * row + x] > 20 { minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y) } }
    if maxX > minX && maxY > minY { extent = CGRect(x: CGFloat(minX), y: CGFloat(mh - 1 - maxY), width: CGFloat(maxX - minX + 1), height: CGFloat(maxY - minY + 1)) }
  }
  let masked = cut.cropped(to: extent)
  guard let cg = ctx.createCGImage(masked, from: masked.extent),
        let dest = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else { print("cannot write"); exit(1) }
  CGImageDestinationAddImage(dest, cg, nil)
  CGImageDestinationFinalize(dest)
  print("\(output.path)  \(cg.width)x\(cg.height), \(result.allInstances.count) subject(s)")
} catch { print("Vision failed: \(error)"); exit(1) }
