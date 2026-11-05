# Standalone public OpenXR enumeration diagnostic

This self-target Android instrumentation initializes the existing public
OpenXR loader and enumerates runtime extensions. It creates no OpenXR instance,
session or action and requests no input. It declares no application permissions,
uses no UiAutomation permission adoption, and does not target or rebuild Moyo.
The manifest contains only the two public OpenXR runtime-broker queries.

The retained source consists of `probe.cpp`, `AndroidManifest.xml`, and
`src/com/moyolearn/musexrprobe/RuntimeProbe.java`. The JNI wrapper caps extension
allocation at 4096 entries and reports actual lookup/initialization/enumeration
result codes. Java writes only its own package's private result file.

The reviewed APK was `vendors/muse-openxr-runtime-probe-6c8f6dc6.apk`
(11,027,067 bytes). It was removed from git on 2026-11-04 (PR #136) because no
build or test reads it; rebuild it from the sources here and compare against SHA256
`6c8f6dc6acba7ed03f0737f4ace0510220cbe34bba4a624533b2c44fcf5e4823`.
This is the final artifact containing the required arm64 `libc++_shared.so`,
not an earlier intermediate APK. It is a diagnostic artifact, not a product
dependency or replacement native library.

Build description: use the existing local Android SDK/JDK and NDK 28 to compile
the reviewed JNI source against public OpenXR Android headers, link the unchanged
Moyo `libopenxr_loader.so`, compile the Java instrumentation, and package with
the Android SDK tools. Include NDK `libc++_shared.so` so ELF dependencies resolve.
Signing remains a local operator step outside these retained sources. No build
script containing signing details, keystore, key, credential or password is
copied. `provenance.json` records source, APK and library hashes. The copied
loader is byte-identical to the pinned Moyo AAR member; it was not rebuilt here.

The [redacted physical enumeration](../../../../docs/forge-board/evidence/quest-openxr-runtime-extensions.json)
records 75 advertised extensions and successful result codes, including
`XR_LOGITECH_mx_ink_stylus_interaction` version 1. The instrumentation result JSON
matches the retained enumeration exactly. Extension presence alone does not
prove profile enablement, a Muse binding, tracked pose or working input.

Installation or execution is a separate, explicit operator action. Retaining
this source and artifact does not launch anything or grant Moyo permissions.
