# [Ohmie-site] Website Refresh Loop — Ledger (started 2026-07-14)

Branch: `site-refresh` (local only — Robin reviews & pushes). Rule: no pricing copy changes (blocked on price-bump decision). No fabricated numbers/testimonials. Every app-feature claim grep-verified against `~/Code/Ohmie` before it ships.

## Backlog

- [x] **T1 — Features grid + spotlight copy refresh** (2026-07-14)
- [ ] **T2 — Restore screenshot slider** with staged shots from `~/Code/ohmie-levelup-shots` + `~/Code/ohmie-emote-shots` (convert to webp, match `assets/staged/` format, re-enable hidden sections where material exists)
- [ ] **T3 — Real proof**: check live App Store page for ratings/reviews; fill commented-out proof slots with verbatim quotes ONLY if real ones exist
- [ ] **T4 — QA pass**: /browse full check (responsive 375/768/1280, console, network, links, slider interaction)

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
