
## 2026-09-13 — workflow agents and the disk
- A subagent told to "build in the simulator" will fill the disk with a 5 GB scratch DerivedData and, when it hits ENOSPC, delete regenerable caches on its own — including Xcode's live DerivedData while Robin had Xcode open for an archive. Rule: never give an agent a build task while Xcode.app is running unless `df` shows ≥15 GB; put the disk rule and "do not touch ~/Library/Developer/Xcode/DerivedData" in the agent prompt, not just in memory.
- A `chmod 000` guard on the scratch path does not stop a determined agent (it chmods it back). Kill the task or edit the script instead.
- Prefer phone screen recordings from Robin over simulator video for marketing media; the simulator cannot tap, and dialog state persists between launches.
