#!/bin/bash
set -euo pipefail
export PROJECT_ROOT="$PROJECT_DIR/.."
export NODE_BINARY="${NODE_BINARY:-$(command -v node)}"
# Match Expo's Debug policy; the headset loads from Metro.
if [[ "$CONFIGURATION" = *Debug* ]]; then export SKIP_BUNDLING=1; fi
cd "$PROJECT_ROOT"
export REACT_NATIVE_PATH
REACT_NATIVE_PATH="$("$NODE_BINARY" -p 'require("path").dirname(require.resolve("@reactvision/react-native-visionos/package.json"))')"
export ENTRY_FILE="$("$NODE_BINARY" -e "require('expo/scripts/resolveAppEntry')" "$PROJECT_ROOT" ios absolute | tail -n 1)"
/bin/bash "$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh" "$REACT_NATIVE_PATH/scripts/react-native-xcode.sh"
