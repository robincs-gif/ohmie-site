# [Ohmie-site] Website Refresh Loop — Ledger (started 2026-07-14)

Branch: `site-refresh` (local only — Robin reviews & pushes). Rule: no pricing copy changes (blocked on price-bump decision). No fabricated numbers/testimonials. Every app-feature claim grep-verified against `~/Code/Ohmie` before it ships.

## Backlog

- [x] **T1 — Features grid + spotlight copy refresh** (2026-07-14)
- [x] **T2 — Current-app screenshot restored to spotlight** (2026-07-14)
- [x] **T3 — Real proof check** (2026-07-14) — no site change; criteria not met yet
- [x] **T4 — QA pass** (2026-07-14) — all green; LOOP COMPLETE

## Log

### T1 — Features grid + spotlight copy refresh — DONE 2026-07-14
- Commit: (see `git log site-refresh`)
- Changes (all grep-verified against app code):
  - Feature card 3: "A daily path…" → **"A streak you can bet on"** — level-up (LevelCurve + tests), Double-or-Nothing wager (50 coins → 100 back, 3 consecutive days, ContentView L6331-6335), streak freeze auto-covers missed days (L6339-6847), widget (OhmieWidgets target).
  - Spotlight: added Lottie emotes line ("fully animated now… celebrates every level-up") — OhmieLottie.swift.
  - Trial modal fine print: added "We'll remind you the day before your trial ends" — TRUE per NotificationScheduler.scheduleTrialEnd (10:00 day before real end). Mirrors the in-app paywall reassurance fix.
  - Slider dot aria-label: "Daily path" → "Streaks, levels, and wagers".
- Verified: rendered via headless browser at localhost:8377 — zero console errors, all three copy changes confirmed in DOM, full-page screenshot taken.
- NOT touched: pricing fine print ($19.99/yr ×3 locations) — waits for price bump.

### T2 — Current-app screenshot restored to spotlight — DONE 2026-07-14
- New asset: `assets/screen-7.webp` (29KB, 620×1342) — converted via PIL from `~/Code/ohmie-levelup-shots/item6-L5-milestone.png`. Shows Golden Ohmie skin + "LEVEL 5! Circuit Apprentice" modal + coin reward — skins, emotes, AND level-up in one shot.
- Un-hid `.spotlight-visual` (hidden since 2026-07-04); swapped stale `screen-2.webp` → `screen-7.webp`, accurate alt text. Existing `.phone.phone-tilt` CSS provides the device frame.
- Scope decisions: hero stays mascot-led (Robin's 2026-07-05 call — not reversed); reels/proof section stays hidden (its 6 shots are stale-version raws, no current staged renders for them); staged slider unchanged (its 4 marketing frames are still accurate).
- Verified: rendered at localhost:8377 — no console errors, image loads (`complete:true`), screenshot confirms composition.

### T3 — Real proof check — DONE 2026-07-14 (no site change)
- Live App Store page (id6779694265) checked via headless browser:
  - **Rating: 5.0 out of 5 — 3 Ratings.** Real, but below the site's own "meaningful volume" gate for the laurels/proof sections → left commented out. Robin can overrule.
  - **Written reviews: none** → review-quote cards stay commented out (verbatim-only rule).
  - Side observations for Robin: **v1.3.6 went live ~21h before this check** (release notes visible: practice queue survives restarts); IAPs still listed at $7.99 / $19.99 (price bump not yet flipped); "You Might Also Like" shows Boolearn + EE ToolKit as neighbors.
- Re-check trigger: when ratings reach ~25+ or the first written review lands, fill the proof pill + laurels with the real numbers.

### T4 — QA pass — DONE 2026-07-14 — ALL GREEN
- Console: zero errors. Network: zero failed requests (all 200/304).
- Slider: dot 2 click → slide 2 active + "A streak you can bet on" card active (JS interaction works).
- Responsive: 375/768/1280 screenshots taken — mobile stacks cleanly, new spotlight phone + feature card render correctly, no horizontal overflow.
- privacy.html loads (title + h1 correct).

## LOOP COMPLETE — handoff to Robin
- Branch `site-refresh`: 4 commits, local only. Review: `cd ~/Code/ohmie-site && git diff main..site-refresh`
- To ship: merge to main + push (GitHub Pages via CNAME picks it up).
- Left for later (deliberate): pricing copy (3 spots, waits for price bump), proof/laurels (waits for review volume), reels section (needs current-version staged renders), hero (mascot-led by Robin's call).
