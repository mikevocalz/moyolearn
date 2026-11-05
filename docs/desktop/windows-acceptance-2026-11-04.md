# Windows acceptance: 2026-11-04

Moyo Learn for Mac is macOS-only (`desktop.config.json` `platforms: ["macos"]`).
Spark 0.0.2 supports Windows development builds only; production packaging and
native acceptance are pending upstream (`node_modules/@legendapp/spark/skills/spark/SKILL.md`,
"Windows currently supports development builds; production packaging and native
acceptance remain pending").

No Windows 11 machine, ARM64 or x64, physical or Parallels, was available to
this run. Nothing below was executed. This file is the report the pack asks
for, and every category is "untested".

SOT-KEYWORDS: desktop windows acceptance report untested spark

| Category | Windows 11 ARM64 | Windows 11 x64 | Notes |
| --- | --- | --- | --- |
| `spark dev --platform windows` | untested | untested | |
| `spark build --dev --platform windows` | untested | untested | |
| Menus (`@legendapp/spark/menus`) | untested | untested | Spark composes Windows menus separately (`spark-native-menu/src/windows-menus.ts`); menu lifecycle callbacks are macOS-only |
| Context menus, dialogs, shortcuts | untested | untested | |
| Secure storage (sign-in session) | untested | untested | `spark-secure-storage` has a Windows backend (`src/index.windows.ts`) |
| `moyo-desktop-core` (Nitro) | not applicable | not applicable | Swift-only HybridObject; a Windows implementation needs a C++ HybridObject and the Windows Nitro loader, which is out of scope |
| `npm run test:windows`, `test:platform --platform windows` | not available | not available | These are scripts in the legend-spark repository, not commands of the installed CLI |

To produce real results: add `"windows"` to `platforms`, run Spark's
`docs/windows-slice.md` workflow on each machine, and replace this table with
the observed outcomes, one row per command.
