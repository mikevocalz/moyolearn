# Disk recovery

User authorized automatic cleanup on 2026-11-13. The standing rule is recorded in root AGENTS.md.

Removed regenerable npm download/execution caches, pnpm metadata and unused store packages, the unused pnpm v11 store, uv download cache, browser automation cache, Chrome disk cache, Homebrew download cache, Next.js cache under signaliq, and stale Android SDK installer temporary files. Source, working trees, credentials, SDK installations, device data and verification evidence were preserved.

Free space reached 4.3 GiB before retrying `pnpm install --frozen-lockfile --filter mobile...`. The command accepted the lockfile and selected 13 workspace projects but still attempted 2,058 packages. It failed with ENOSPC after 836 downloads. No successful dependency restoration, Metro startup or hands acceptance is claimed. Pruned unused downloads again after failure to recover headroom.

Independent cleanup audit found no further large disposable cache. QNX generated build directories overlap active work and were preserved. Docker reported zero build cache and only 15 MB reclaimable images; running containers and their data were preserved. CoreDevice/DeviceFS is a mounted device filesystem, not disposable host cache.
