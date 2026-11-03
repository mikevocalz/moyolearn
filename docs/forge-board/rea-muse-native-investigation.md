---
meta:
  contentType: Reference
  category: Forge board diagnostics
---

# Why native Muse tracking remains unresolved on Quest

This finding ledger traces the actual system stylus-pairing path and records the remaining native tracking questions. It supports the investigation of genuine Muse six-degrees-of-freedom (6DoF) input. The finite diagnostic tilt-cursor drawing proof does not establish native position or orientation tracking.

## Pairing reaches the system controller service

Static analysis establishes this call chain for the inspected headset artifacts:

| Stage | Observed behavior | REA evidence |
| --- | --- | --- |
| Settings | `X.C3Cx.onClick`, discriminator 28, launches `com.oculus.firsttimenux.FirstTimeNuxModalActivity` with `VIEW` data `/first_time_nux/STYLUS_PAIRING` | `ev_f4654d795e8979991be4b5cefd7b49be8cbaef5001bc62debb7fee6e15c61d38` |
| Nux native bridge | `ControllerModule.pair` waits for the controller-ready callback, then calls its worker dispatch | `ev_9b5ccbec22e82cd0a852c54b6ce921886d91a00889156c4761c751d986b3640e` |
| Role mapping | The shared pairing role `tertiary` maps to index 2 | `ev_71d673ef0f83697f816004080b1941461a1ddf846ca85de4d9d23a0b05f3d631` |
| Timeout | `ControllerModule.A04` equals 60,000 ms | `ev_9b4d7bd784552edb1b8c87c27a2f63778f2e83f898f52f751129fd3c2182d5ae` |
| Dispatch | `ControllerModule.A00` calls `Controllers.scanAndPairDevice(role, timeout)` | `ev_50629eac5da5d474158c846f1a5d11ad86e4695b33b9bd70fa03c9bb55ba3e59` |
| Framework | `Controllers` delegates to `IRemoteService`; unavailable service or `RemoteException` returns null | `ev_401c320160bf753327f631ecc19df8135ba4544b4e53b13121fafeb7a7b8fbb1` |
| Binder service | Service name is `OVRRemoteService`; interface is `oculus.internal.remote.IRemoteService` | `ev_bc3d714796891edde7e5bec77570d0dcd1426c7bec3291a022ecc491d5af7f90` |
| Binder request | Transaction 10 sends role 2 and timeout 60,000 ms. Role 2 is `DEVICE_NOHAND` | `ev_f18e593907531b541cb7ffe3d4802770aaea62d32f04f6e5372dec8fccba6bec` |

Nux packages its stylus UI in `assets/FirstTimeNuxBundle.js.hbc`. An offline disassembly using the installed Hermes compiler identifies the `tertiary` role and shared pairing flow. This supplemental bytecode analysis is distinct from REA Android class decompilation; it does not establish runtime execution of every branch.

The visible failure message collapses several outcomes. The interface defines 0 success, 1 timeout, 2 failed pairing, 3 already running, 4 internal error, and 5 rejection. `Controllers` translates 0 through 4 and maps other values to unknown; Nux resolves true only for success. The failure title alone cannot identify eligibility, authentication, firmware, or transport failure.

## Actual system history records scan timeouts

An initial ordinary read-only system dump showed three slot-2 pairing attempts timing out after 60 seconds, with no advertising controllers found. A later REA process capture retained the system dump independently: `ev_e9765899d5a4ecee35a723309ad79af0cda377a800c57b0b67a957216b40b2ad`.

Native analysis identifies the exact timeout branch at `scanAndPairDevice`, address `0x1b9de0`. It queries the lower `ManagementClient` advertised-controller vector. The observed message means no nonempty vector reached this branch during the scan. This occurs before the CMS role/model filter, so there is no evidence that `shouldSkipPairingAttempt` excluded Muse. Evidence: `ev_3978b667a08bdb769c5a1d053533ca27cd68dc150ea0d8e62d1492b866cda1e5`.

These observations do not establish explicit Muse rejection, unsupported hardware, an authentication failure, or a firmware incompatibility. Recognition in the lower sensor provider remains unresolved.

An ordinary read-only `dumpsys --pid` lookup associated the service process with `com.oculus.os.cm`. This process-owner lookup is supporting tool evidence, not a separate REA analysis claim; transient process identifiers are omitted here.

## Controller management enters native code

REA inventories all 733 classes in the controller-management APK and inspects selected classes and methods. `HeadsetApplication.<clinit>` loads `cmsservice-headset`, and the service/glue path enters native initialization. The relevant evidence is:

- Package: `ev_ab787aaf956887fd85b8381d459ca4255683fca7215904b839596ccbf1387382`
- Class inventory: `ev_2a1e8fe191c2a32107085036d8f2b0c62f87c4a3ed3cdf28178684f40ec55cce`
- Library loading: `ev_0af86bd3d7f6672548483a22ba2eab537cb01be0206a5e399c917d4f1d6ba0a7`
- Service initialization: `ev_df7c384798c19061922693a6d2ba9a3279012b29f4c0fbb67cda92acacb81a8d`
- Glue inventory: `ev_f27e709b2f99c07e1c76d9395668c8c284c5580630848ed52342de038863d282`

Native initialization calls the imported `OVR::Sensors::HidlWrapper::v1::createControllerProvider` and passes its returned provider into `ControllerGlue`. Evidence: `ev_3dc560076eb2043d886e0b688fcdb7fc0745f5bb16120b9eac76dcc3f02476ef`. The installed `libvrsensors-hidlwrapper.so` delegates to the vendor Oculus Sensors hardware abstraction layer (HAL), as traced below; the HAL advertisement parser and recognition rules remain unknown.

An initial recovered `shouldSkipPairingAttempt` function invokes `shouldAllowPairing(type)` and checks requested role and optional identifier, serial, and model filters. A special type `0xb` accepts requested role 2. This does not yet identify how the scanner classifies actual Muse advertisements. Evidence: `ev_2bb4b7490afb4eb83fcab0a77417d4bbf476670b061b716be3b0de73b102f7fc`.

## The unresolved recognition boundary is the vendor Sensors HAL

The installed HIDL wrapper obtains `vendor.oculus.hardware.sensors@1.0::IControllerProvider/default` through `getService("default", false)`. Its management client delegates `getAdvertisingControllers` to the HAL callback. The callback copies every returned record without a local vendor/name filter. These observations locate the remaining recognition question below the wrapper:

- Provider acquisition: `ev_26e0a81b56b07ad4f611561a1a9141fad4492ef83aa5cc20abad5049bf88c415`
- Advertised-controller query: `ev_ffe32d9e18e720126092930027d7390b0075379d8bbc2e27026f688711fcd6b8`
- Unconditional callback copy: `ev_bb9d5a3ded5e75b7e2ade0900a525b1c6282c37306a2d86df3d9cafa21d30341`

An ordinary process listing identifies `vendor.oculus.hardware.sensors@1.0-service`. The partial `lshal` output does not resolve the interface process identifier; that does not prove the service is dead. Both `stat` and the platform pull tool deny access to the candidate `/odm/bin/hw/vendor.oculus.hardware.sensors@1.0-service` path. A parent directory can deny traversal, so those errors do not prove that exact file exists. Process maps are also inaccessible; no bypass occurred.

The official Meta updater’s shipped JavaScript requests latest-build metadata using a device serial. Anonymous requests, including a fresh anonymous Chrome session, return error `1357012` without a build or image URL. The attempted browser REA capture is partial because target policy fails; it is not a complete REA network receipt. No matching operating-system image or HAL implementation has been acquired for offline analysis.

## Native tracking clues do not yet establish Muse pose

Two recovered runtime functions narrow the interpretation of existing code. The handedness heuristic consumes stored orientation and translation; it does not generate a pen pose. Evidence: `ev_e5155e503de64f1bd1a27871184ca524afbcd260714f09e0b85403e945cb7859`, selector `FUN_00db6ca0`.

A separate classification treats SDK model values 9000 through 9999 as a Coulee consumer category. These are SDK model identifiers, not USB vendor/product identifiers. Evidence: `ev_773bb7353033e369be7d3591af9b13184ad1c190a4518a82fdc69e1a8f559bd3`, selector `FUN_006227b8`.

The CMS model table separately names internal values 3 `STYLUS_PROTO`, 8 `COULEE`, and 11 `COBALT`. These names do not identify an observed Muse advertisement or USB identifier. Evidence: `ev_079000e34b6ebb64286679fc60de7e741077bd23565d8841e6dbb1db44b96ba5`, `ev_7f85cbbf5bd804734b9250c39c8f498a2660b8c4eec09903a7d40d78956348e0`, and type/model mapping `ev_fb6c9bf55b841a64aa9f4a1765be2f213940a3854f6877a7c34ab93085c30801`.

Offline analysis of the report’s vendor-defined 64-bit fields suggests a timestamp-related layout. That remains a hypothesis because the actual usage differs from the referenced documented usage. It does not establish position, orientation, or a pose decoder. Evidence: `ev_db98c89805da23c86a8ee65744b4431a6af5d49bf5186a62282b2d0d56c2632a`.

## Artifact identity and analysis boundaries

The hashes identify the inspected bytes, not broader device compatibility:

| Artifact | SHA-256 |
| --- | --- |
| Settings APK | `5066003b8c118a30d2e3a27ca3d7dad4cf2db590bebc7413f0feea552f7b58c4` |
| First Time Nux APK | `6433e746fbbb7101af60f7da2cca179ef47a5cf49bc2910ca238e6abdf11f4b6` |
| Nux Hermes bytecode | `b6fb35d1aa16c04e4a9d6e1949f71cf4da26b466307d60b0441a98dde34d14c5` |
| Oculus platform framework JAR | `073b1d0aa0567858d0d4f160b0d6f1b646c8f5e1dca96d70b9377c5e460362f6` |
| Controller-management APK | `5fb413c394af13756f8f04c5c3e82910a294a15e4fcca352f26d080d8644ade3` |
| Controller-management native ELF | `83421ed2006344548ed0d2856fda3c270e6fdf726cd07562fdd7b99d14c6886d` |
| Installed HIDL wrapper ELF | `f81a1ec775c142524588ae38df83676cd778677c40fd08f36697433e53b96f2c` |
| Inspected native runtime ELF | `84c53fa5236cb0d2b0379a0bce538a8c61a7e7d5622c03f2f6bcc5818bd72986` |

APK analysis uses REA’s JADX 0.7.1 Android provider. The framework JAR uses legitimate REA process capture of an owned Java 17 source-file analysis through the JADX API. No file renaming or APK-format guard bypass occurred. Ghidra supplies the native function observations.

Proprietary APKs, recovered vendor bodies, complete private dumps, device identifiers, addresses, and signing material remain outside the repository. This ledger retains factual selectors, hashes, evidence identifiers, and bounded findings. These investigation steps perform no device writes or pairing calls.

## Questions still requiring evidence

The remaining work concerns actual native Muse support:

- Obtain and inspect the matching vendor Sensors HAL advertisement-recognition implementation
- Identify why no advertised-controller vector reached the CMS pairing loop
- Determine whether the observed Muse advertisement reaches the accepted accessory type and role filters
- Identify the exact initialization and tracking-provider path after successful system pairing
- Demonstrate genuine Muse native pose and corresponding application input with measured runtime evidence

No exact radio filter, Muse initialization sequence, or safe native Muse fix has been recovered from the accessible artifacts. Neither the scan timeouts nor static model strings answer these questions. The [finite diagnostic drawing evidence](evidence/quest-muse-motion-cursor.json) remains a separate 2D tilt-cursor result.
