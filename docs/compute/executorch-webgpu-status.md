# ExecuTorch's WebGPU backend — investigated, closed

<!--
What it is: the answer to "should Moyo run ExecuTorch through WebGPU on the same
Dawn as Natalie", which the migration brief asks and then answers in the
negative. This records the check so nobody re-opens it from the package name.
Why it exists: the idea is attractive from the outside — one GPU abstraction for
rendering and inference — and it is closed for reasons that are structural, not
performance-related.
SOT: https://docs.pytorch.org/executorch/main/backends/webgpu/webgpu-overview.html
SOT-KEYWORDS: executorch webgpu backend vulkan dawn partitioner ios android
              closed investigation re-check trigger
-->

Checked 2026-09-17 against the upstream overview page and the backends tree. No
code depends on any of this and none should.

| Question | Answer |
|---|---|
| Maturity | Experimental, under active development. Backend test suite and x86 CI landed June 2026 on SwiftShader. |
| Operators | 100+ registered WGSL operators including quantized linear/embedding/conv (4-bit weight-only, dynamic 8-bit) and LLM kernels — SDPA, KV-cache update, RoPE, fused SwiGLU/QKV. |
| Model coverage | Whatever the **Vulkan** partitioner selects. `WebGPUPartitioner` is a thin wrapper that "does not independently validate the narrower WebGPU runtime capability set", so a Vulkan-supported / WebGPU-unsupported operator fails at graph build rather than at export. |
| React Native viability | **None today.** Target requirements list macOS native, Linux native and browser. Not built for iOS or Android, and not shipped by `react-native-executorch`. |
| Shared Dawn? | It links its own Dawn via `Dawn_DIR` at CMake time. That is a **second** Dawn unless someone builds it against `react-native-webgpu`'s exact tag — which is the one thing the Skia ↔ WebGPU build guard exists to prevent. |
| Adopt an external device? | No documented API for adopting an external `WGPUDevice`. |
| Contend with Natalie? | By construction, yes — it would run on the same GPU she renders on. |
| Benefit over Vulkan / Core ML / MLX? | None demonstrated for mobile. |

## The blocking detail

The WebGPU runtime **registers itself as `VulkanBackend`**, and the docs say not
to link the Vulkan and WebGPU runtime backends into the same application. Moyo's
Android path ships the Vulkan delegate. So this is not a trade-off to weigh: the
two cannot coexist in one binary, and the one already in use is the one that runs
on the platform we ship.

## Re-check trigger

Re-open only when upstream lists iOS or Android in the WebGPU backend's target
requirements, **or** ships an API for adopting an external `WGPUDevice`. Either
would change the answer; a faster kernel would not, because the blocker is the
backend-ID collision and the second Dawn, not throughput.
