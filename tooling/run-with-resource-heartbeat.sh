#!/usr/bin/env bash
# Keep resource evidence in the live log if a native runner disappears.
# SOT: .github/workflows/android-native.yml
# SOT-KEYWORDS: android native runner resource heartbeat diagnostics
set -u

if [[ $# -eq 0 ]]; then
  printf 'resource-heartbeat: a build command is required\n' >&2
  exit 64
fi

heartbeat() {
  local pause_pid=''
  stop_pause() {
    if [[ -n "$pause_pid" ]]; then
      kill "$pause_pid" 2>/dev/null || :
      wait "$pause_pid" 2>/dev/null || :
    fi
    exit 0
  }
  trap stop_pause TERM INT
  while :; do
    printf '\nresource-heartbeat: '
    date -u '+%Y-%m-%dT%H:%M:%SZ' || :
    free -m || :
    df -h . || :
    # Never print environment values or full command arguments.
    ps -eo comm=,rss= --sort=-rss | awk 'NR <= 20' || :
    sleep 30 &
    pause_pid=$!
    wait "$pause_pid" || :
    pause_pid=''
  done
}

# Separate process groups let cleanup reach the sampler's current sleep/utility
# and forward interruption to Gradle's descendants, without touching the runner.
set -m
heartbeat &
heartbeat_pid=$!
cleanup() {
  kill -- "-$heartbeat_pid" 2>/dev/null || :
  wait "$heartbeat_pid" 2>/dev/null || :
}
trap cleanup EXIT

"$@" &
build_pid=$!
# Disable job notifications so they cannot echo the build's command arguments.
set +m
forward_signal() {
  kill -s "$1" -- "-$build_pid" 2>/dev/null || :
  wait "$build_pid" 2>/dev/null || :
  exit "$2"
}
trap 'forward_signal TERM 143' TERM
trap 'forward_signal INT 130' INT
wait "$build_pid"
status=$?
exit "$status"
