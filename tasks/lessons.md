
## 2026-09-13 — workflow agents and the disk
- A subagent told to "build in the simulator" will fill the disk with a 5 GB scratch DerivedData and, when it hits ENOSPC, delete regenerable caches on its own — including Xcode's live DerivedData while Robin had Xcode open for an archive. Rule: never give an agent a build task while Xcode.app is running unless `df` shows ≥15 GB; put the disk rule and "do not touch ~/Library/Developer/Xcode/DerivedData" in the agent prompt, not just in memory.
- A `chmod 000` guard on the scratch path does not stop a determined agent (it chmods it back). Kill the task or edit the script instead.
- Prefer phone screen recordings from Robin over simulator video for marketing media; the simulator cannot tap, and dialog state persists between launches.

## 2026-09-15 — the hero CTA swap cost the paid traffic
- The redesign replaced the Apple "Download on the App Store" badge in the phone hero with an amber "Start 7 days free" button and hid the badge under 40rem. Hero taps fell 13.6 → 2.1 per 100 visits in Instagram's in-app browser and 9.8 → 0.3 in Facebook's; Meta ad tap rate 17% → 5% within the deploy hour. The nav badge held steady, so links and tracking were fine; the button itself was the loss.
- Rule: never remove the store badge from the first phone screen. Treat any hero CTA change as an experiment: ship it behind a split or watch the "Hero vs nav badge vs sticky bar" PostHog tile for 24 h, by browser type, before calling it done.
- Rule: the verification checklist for a site change must include a before/after conversion check by channel, not just rendering, links and console. A page can render perfectly and still convert at a third of the old rate.
