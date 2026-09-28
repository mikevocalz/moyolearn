# Native ink package integration

Moyo consumes the renderer built by virocore run 36354633068 from
034d3b977754c94c23fa12d3a7e8c24d26f56b41, merged through virocore PR #2.
The source fixes sampling for high-accuracy surfaces with dragTransform=none.
The release AAR passed native compilation and 16KB alignment verification.
Every member of the recompressed AAR is byte-identical to the CI artifact.

The Android root project and its Expo config plugin pin the separate vendor AAR
and verify SHA-256 before configuring dependencies. The existing Viro package
patch routes its renderer shim to that file. The rest of the current vendor
package, including its JS, Java bridge and Apple code, is preserved. No network
fetch or node_modules mutation is needed to choose the artifact.

The Nitro patch imports only the reviewed core lifecycle changes from
nitro-canvas-in-Vision PR #2 (integration merge 4c49c08e). The installed source
is exercised by sanitizer CI, covering disposal, resize invalidation, coherent
frame consumption and input sequence ordering. Apple platform prerequisites
from PR #1 remain separate.

These changes do not establish GPU buffer lifetime/fence correctness or a
bounded input queue with platform consumers. Physical Quest/Pico handwriting,
latency, tracking-loss recovery and full Android assembly remain release gates.
