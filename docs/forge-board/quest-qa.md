# Quest validation contract

App: Moyo debug Quest variant, `com.moyolearn.app`, Quest 3S. The engineering
`moyo://forge-board-probe` route owns isolated MMKV `moyo-forge-validation`, not
learner capture storage. The initial app/account state is preserved. Development
client and deep-link steps are fixture setup, not a test of product navigation.

| Contract | Action | Executable evidence | Data effect |
| --- | --- | --- | --- |
| Debug app starts | Launch with Argent after update install | Foreground app and first real screen | Existing app data retained |
| Isolated board ready | Open engineering deep link | Probe title and ready state, then idle | Fixture read only |
| Deterministic baseline | Reset test board | Zero marks, no undo | Isolated test data only |
| Real drawing pipeline | Add synthetic test stroke | One mark and undo available | Fixture document changes |
| Single document history | Production Undo then probe Redo | Zero then one mark; settled history | Same Yjs document |
| Local persistence | Save, restart app and reopen probe | Restored mark | Isolated MMKV bytes |
| Light-paper export | Export test PNG | Actual PNG result | No tutor request or learner attachment |
| Reusable end state | Reset test board | Zero marks | Isolated fixture restored |

The synthetic stroke is not hardware pen tracking, pressure calibration or palm
rejection evidence. It exercises the installed WebView input/export fallback
with the same document owner and toolbar components. The native Forge renderer
remains gated until the required Viro capability is installed and verified.

A saved QA test is complete only after the unchanged recording passes twice,
including destination identity and readiness gates. Failed or unavailable
hierarchy/launch checks remain failures or blockers. Screenshots alone are human
visual evidence. Results will be appended after device execution.
