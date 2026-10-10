#!/usr/bin/env bash
# xr-probe runner — builds (once) and runs the OpenXR session probe against
# Meta XR Simulator with the Meta VR Glasses device profile.
# SOT-KEYWORDS: xr-probe, xrsim, glasses
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SIM_RES="/Applications/MetaXRSimulator.app/Contents/Resources/MetaXRSimulator"

if [ ! -x "$DIR/build/xr-probe" ]; then
  cmake -S "$DIR" -B "$DIR/build" -DCMAKE_BUILD_TYPE=Release
fi
cmake --build "$DIR/build" -j >/dev/null

open -a MetaXRSimulator 2>/dev/null || true

exec env \
  XR_RUNTIME_JSON="$SIM_RES/meta_openxr_simulator.json" \
  META_XRSIM_CONFIG_JSON="$DIR/sim-glasses.json" \
  "$DIR/build/xr-probe"
