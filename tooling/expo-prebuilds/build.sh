#!/usr/bin/env bash
# Builds the Expo XCFrameworks that the iOS SwiftPM build links and npm does not ship.
#
# Expo's SwiftPM autolinking plugin (expo/scripts/spm) links every Expo module that
# mixes Swift and Objective-C as a prebuilt XCFramework pair (Debug + Release). On
# npm only expo-modules-core, expo-file-system, expo-font, expo-image and
# expo-image-manipulator carry them. This script builds the rest with Expo's own
# pipeline (`et prebuild`, tools/src/prebuilds in expo/expo) from the expo commit
# the installed packages were published from.
#
# The plugin refuses to mix precompiled modules from different places with the
# ExpoModulesCore they compile against, so ExpoModulesCore and every precompiled
# module the app links are built here together, into one directory. Point
# EXPO_PRECOMPILED_MODULES_PATH at "$OUT" when running `react-native spm`.
#
# Usage: tooling/expo-prebuilds/build.sh <work-dir> <out-dir>
# Needs: Xcode 27.1+, node 24, git, network. Takes ~30 min on an M-series Mac.
set -euo pipefail

WORK=${1:?work dir}
OUT=${2:?out dir}
REPO_ROOT=$(cd "$(dirname "$0")/../.." && pwd -P)
HERE="$REPO_ROOT/tooling/expo-prebuilds"

# expo@58.0.19 and expo-modules-core@58.0.26 were both published from this commit
# (tags `expo@58.0.19`, `expo-modules-core@58.0.26`). Every package built below has
# the same version in its package.json at this commit as on npm.
EXPO_COMMIT=$(tr -d '[:space:]' < "$HERE/expo-commit.txt")
RN_VERSION=$(node -p "require('$REPO_ROOT/node_modules/react-native/package.json').version")

# The modules the app links precompiled. Keep in step with the plugin's
# "paired runtime frameworks" line in `react-native spm` output.
PACKAGES=(
  unimodules-app-loader
  expo-task-manager
  expo-background-task
  @expo/ui
  expo-file-system
  expo-font
  expo-image
  expo-image-manipulator
)

EXPO="$WORK/expo"
mkdir -p "$WORK"
if [ ! -d "$EXPO/.git" ]; then
  git init -q "$EXPO"
  git -C "$EXPO" remote add origin https://github.com/expo/expo.git
fi
git -C "$EXPO" sparse-checkout init --cone
git -C "$EXPO" sparse-checkout set \
  tools bin apps/bare-expo patches scripts \
  packages/expo packages/precompile packages/expo-modules-core packages/expo-modules-jsi \
  packages/expo-modules-autolinking \
  packages/@expo/json-file packages/@expo/osascript packages/@expo/plist \
  packages/@expo/internal-scripts packages/@expo/require-utils \
  packages/unimodules-app-loader packages/expo-task-manager packages/expo-background-task \
  packages/expo-ui packages/expo-file-system packages/expo-font packages/expo-image \
  packages/expo-image-manipulator
git -C "$EXPO" fetch -q --depth 1 --filter=blob:none origin "$EXPO_COMMIT"
git -C "$EXPO" checkout -q --force FETCH_HEAD

# Upstream fix pending: `et prebuild` passes the package name as the xcodebuild
# scheme, and Xcode names no scheme "@expo/ui".
git -C "$EXPO" apply "$HERE/expotools-scoped-package-scheme.patch"

# expo-task-manager ships no spm.config.json; ours comes from the pnpm patch.
cp "$REPO_ROOT/node_modules/expo-task-manager/spm.config.json" "$EXPO/packages/expo-task-manager/spm.config.json"

# The pipeline resolves react-native (and Hermes' version) from apps/bare-expo.
# Lend it the app's own copy so the artifacts match what the app links.
mkdir -p "$EXPO/apps/bare-expo/node_modules"
ln -sfn "$REPO_ROOT/node_modules/react-native" "$EXPO/apps/bare-expo/node_modules/react-native"

cd "$EXPO"
npx -y pnpm@12.2.1 install --filter 'expotools...' --filter 'expo-modules-core...' --ignore-scripts
for pkg in json-file osascript plist; do
  (cd "packages/@expo/$pkg" && npx -y pnpm@12.2.1 run build)
done

CI=1 node tools/bin/expotools.js prebuild --react-native-version "$RN_VERSION" "${PACKAGES[@]}"
node tools/bin/expotools.js prebuild prune all

# Keep only the composed artifacts, in the layout the plugin reads:
# <package>/output/<debug|release|headers>/xcframeworks/*
rm -rf "$OUT"
mkdir -p "$OUT"
rsync -a --prune-empty-dirs \
  --include='*/' --include='*/output/*/xcframeworks/**' --include='@expo/*/output/*/xcframeworks/**' \
  --exclude='*' \
  "$EXPO/packages/precompile/.build/" "$OUT/"
echo "Expo XCFrameworks written to $OUT"
