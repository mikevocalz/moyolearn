#!/usr/bin/env bash
# SpatialSim test harness — boots Meta's Spatial Simulator, builds the
# questDebug (Horizon OS) variant of apps/mobile, installs and launches it.
# Why: Meta VR Glasses / Quest testing needs a repeatable path that does not
# depend on MQDH GUI state or a cabled headset.
# Source of truth for flavors: apps/mobile/android/app/build.gradle.
# SOT-KEYWORDS: spatialsim, horizon, quest, metavr, xr-testing
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$REPO_ROOT/apps/mobile"
SIM_SERIAL="emulator-5554"
APK_PATH="$MOBILE_DIR/android/app/build/outputs/apk/quest/debug/app-quest-debug.apk"

find_metavr() {
  if command -v metavr >/dev/null 2>&1; then
    command -v metavr
  elif [ -x "/Applications/Meta Quest Developer Hub.app/Contents/Resources/bin/metavr" ]; then
    echo "/Applications/Meta Quest Developer Hub.app/Contents/Resources/bin/metavr"
  else
    echo "metavr not found. Install Meta Quest Developer Hub: brew install --cask meta-quest-developer-hub" >&2
    exit 1
  fi
}
METAVR="$(find_metavr)"

ensure_sim() {
  if ! "$METAVR" ssim status --json | grep -q '"installed": true'; then
    echo "SpatialSim not installed — downloading…"
    "$METAVR" ssim download
  fi
  if ! "$METAVR" ssim status --json | grep -q '"running": true'; then
    "$METAVR" ssim start
  fi
  # ssim start returns before adb sees the device; poll for the serial.
  for _ in $(seq 1 60); do
    "$METAVR" device list --format plain | grep -q "$SIM_SERIAL" && break
    sleep 2
  done
  echo "SpatialSim ready on $SIM_SERIAL"
}

cmd="${1:-help}"
case "$cmd" in
  boot)
    ensure_sim
    ;;
  build)
    ensure_sim
    cd "$MOBILE_DIR"
    ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a \
      pnpm exec expo run:android --variant questDebug --device "$SIM_SERIAL"
    ;;
  install)
    APK="${2:-$APK_PATH}"
    ensure_sim
    "$METAVR" -d "$SIM_SERIAL" app install "$APK"
    ;;
  run)
    "$0" boot
    "$0" build
    ;;
  screenshot)
    ensure_sim
    OUT="${2:-spatialsim-$(date +%Y%m%d-%H%M%S).png}"
    "$METAVR" -d "$SIM_SERIAL" capture screenshot "$OUT"
    echo "$OUT"
    ;;
  logs)
    ensure_sim
    "$METAVR" -d "$SIM_SERIAL" log
    ;;
  status)
    "$METAVR" ssim status
    "$METAVR" device list
    ;;
  stop)
    "$METAVR" ssim stop
    ;;
  *)
    cat <<'EOF'
Usage: spatialsim.sh <command>

  boot                  download (if needed) and start SpatialSim
  build                 build + install questDebug (arm64) onto the sim
  install [apk]         install an APK (defaults to the questDebug output)
  run                   boot + build
  screenshot [out.png]  capture the sim display
  logs                  stream device logs
  status                sim + device status
  stop                  stop the sim
EOF
    ;;
esac
