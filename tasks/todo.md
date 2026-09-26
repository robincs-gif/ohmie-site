# ohmie.io redesign — build plan (2026-09-14)

Spec: `docs/superpowers/specs/2026-09-12-ohmie-site-brilliant-funnel-design.md` (approved). Source of truth for the page: the approved mockup `.superpowers/brainstorm/20289-1789394113/content/mockup-v6.html` (direction B, 9 sections, sticky bar, real 1.5.2 captures, no version tags per Robin 2026-09-14).

## Build
- [x] `index.html` rebuilt from mockup-v6: mock bar and `?annotate` machinery removed; head keeps title, description, canonical, OG/Twitter tags, favicon, apple-touch-icon, PostHog snippet; nav anchors → section ids; footer keeps Privacy Policy → `privacy.html`, Terms of Use → Apple standard EULA, Manage Subscription, Contact (`support@ohmie.io`), store badge `data-placement="footer"`
- [x] `styles.css` replaced with the mockup's CSS (tokens unchanged, `--amber-tint` added); reveal `opacity:0` only under `html.js`
- [x] `script.js`: existing blocks 0a (campaign `ct` token on store links) and 0b (`Site.appStoreClicked` with `data-placement`) kept verbatim; sticky bar observer, subject tabs, reveal added
- [x] `assets/`: 2x WebP captures, video posters, `battle.{webm,mp4}`, `chargeup.{webm,mp4}` copied in; nothing deleted (old files stay, listed as unused in the summary)
- [x] Subject tab counts: reverted to the mockup's 1.5.1 values on 2026-09-14 review (Electronics 82, Digital Circuits "About 30 lessons", Semiconductors 95, Embedded 103, Programming "Python and C++ tracks", PCB 48, Robotics 82) because the store lookup still returns 1.5.1; switch to 90 / 32 / 71 / 105 once 1.5.2 is live

## Verify (headless, local server)
- [ ] Screenshots 375 / 768 / 1280 + full-page desktop, compared to mockup-v6 (375 and 1280/1366/1440 hero re-shot after the review fixes; 768 and full-page not re-compared)
- [x] Console and network clean (index.html and privacy.html, 375 and 1280; 0 console messages, 0 4xx/5xx)
- [x] Store links: header, hero, hero_badge, how, subjects, reviews, pricing, pricing_monthly, final_cta, sticky, footer — each once, all `apps.apple.com/...id6779694265` (names restored to the pre-redesign `header` / `final_cta` so PostHog history lines up; new names snake_case)
- [x] Sticky bar: hidden at top on 375, visible after the hero, hidden at pricing and at the final CTA, display none at 1440
- [x] Tabs: seven tabs, seven panels, ArrowRight moves selection and panel; last tab scrolls clear of the edge fade at 375
- [x] With `html.js` absent all text visible (only the proof pill is hidden at 375, by the phone-width CSS rule, not by JS)
- [x] Every href resolves (internal files exist; external 200 on GET); `privacy.html` unchanged; CNAME unchanged
- [x] PostHog: snippet present, `ct` token appended when `?ct=` is in the URL (script.js now reads `ct` first, then utm_campaign, then utm_source; verified all 11 product links end `ct=test123&mt=8`, Manage Subscription stays bare)
- [ ] Lighthouse mobile, local server, 2026-09-14 baseline for this redesign: performance 76, FCP 2.5 s, LCP 5.7 s, TBT 0 ms, CLS 0.001, Speed Index 2.5 s (Lighthouse 12.8.2, simulated throttling). Re-run against live ohmie.io after deploy

## Ship
- [x] Commit on `main` (9a78e6e), pushed 2026-09-14; live within 30 s — /, privacy.html, styles, script, captures, video, og-card all 200; 12 placements; PostHog requests 200

## Review
2026-09-14 review fixes applied (uncommitted):
- Hero on desktop: `align-items: start` + 32px top padding on the copy; at 1280x720 the fine print now ends at y=564 (was 724, clipped)
- Tab strip: trailing 15% spacer so Robotics scrolls clear of the fade
- Sticky bar subtitle shortened to "7 days free" (no more ellipsis at 375); script.js sticky observer updated to the restored `final_cta` name
- Placement names: `nav` -> `header`, `final` -> `final_cta`, `hero-badge` -> `hero_badge`, `pricing-monthly` -> `pricing_monthly`
- Old anchors `#how`, `#why`, `#curriculum` land on the matching new sections
- Footer sticky-bar clearance scoped with `body:has(.sticky-bar)` so privacy.html no longer has 5rem of empty space on phones
- Ratings count: App Store lookup 2026-09-14 returns 89 (4.58), so the page is right; the spec's "85" note is stale (spec not edited)
- Deliberate mockup-over-spec cuts left as is: static final-CTA mascot (no Lottie), four-link nav without Support / Manage Subscription
- Open for Robin: the Ohmie World row and hero capture describe 1.5.2 content while the store is on 1.5.1 (no copy added, per the no-version-tags call) -- hold the publish or accept


# 2026-09-26 — live-app parity, iOS hero badge, performance (branch `site-update-2026-09-26`)

Six-auditor sweep (claims / lesson counts / PostHog / performance / links+a11y / conversion) against the LIVE build dcadf586 (1.5.4 b37), then two builders, then four verifiers (render before/after, claims skeptic, code review, design judge). Everything below is verified against that revision; origin/main (1.5.5 b38) changes none of it.

## Facts corrected
- Ohmie World row removed: `AppFeatures.ohmieWorld = false` in the shipped build, so Copper Town / Watt battles / live duels were unreachable. Assets `cap-07-world-town-2x.webp`, `battle.*` left in place, unreferenced.
- Ratings 95 → 133 (4.59 rounds to 4.6; iTunes lookup 2026-09-26).
- Lesson counts per subject (counted by resolver script over `Catalog.groups`, intro ids excluded like the app's own chips): Electronics **90**, Analog Electronics **12** (a live, tappable 8th subject the site omitted — added as tab 02), Digital Circuits **33** (the LP tree the topic renders; the app's Explore chip still says 8), Semiconductors 95, Embedded 103, Programming **119** = Python 67 + Arduino C++ 52, PCB 48, Robotics **105**. Proof band "500+" → "590+", "7 subjects" → "8".
- Programming blurb: the C++ track ends at "Build Your First Sensor Lamp", not an autonomous robot (`ArduinoRobotCourse.swift` exists but no catalog entry references it).
- Level bands are Spark → Circuit Apprentice → Conductor → Circuit Master (`LevelCurve.swift`). Daily Charge = up to 5 questions (hidden below 3), +15 XP. There is no per-question authored hint — `Question` has `explanation` only; the "hint" is a canned nudge by kind (`OhmieQuestionHelp.swift`) — copy now says "explanation … plus a nudge".
- Logic Lab: ten level walls, lamp → latch → clock; walking is default, flight a toggle → "walk or fly".
- New FAQ: devices (iPhone + iPad only; no Android/web; `TARGETED_DEVICE_FAMILY 1,2`), free version (none; 7-day trial on Yearly only), offline (6,128 bundled narration .m4a; leaderboard/sync/Ask Ohmie/sign-up need a connection), kids (4+; no age gate in app). Refunds via reportaproblem.apple.com. Pricing h2 now states the annual billing ("Then $29.99 a year" / "That's $2.50/mo, billed yearly"). Cancel wording unified to "in the App Store".
- Third review swapped for AsiusG3112 "My first interactions" (verbatim, `[…]` = three omitted sentences; answers the price objection). The iTunes customer-reviews RSS returns 0 entries now; verify against the App Store web page with a browser UA.

## Conversion: the phone hero badge is back
PostHog (one-off HogQL; the metric catalog scope is not granted): after the 2026-09-14 redesign the amber "Start 7 days free" pill collapsed on **iOS** — hero taps/100 loads 15.9 (badge) → 2.0, all iOS taps 21.6 → 12.8; Android flat (can't install anyway); desktop improved 15.5 → 25.2 and keeps the pill. The 09-15 "in-app browser" story was a proxy for iOS (97% of in-app loads were iOS). Change: below 40rem the hero shows only the black App Store badge; the sticky bar's pill is also the badge. Placement names unchanged → **phone hero taps now report under `hero_badge`**; the dashboard "hero" tiles need hero + hero_badge combined from 2026-09-26. Header badge kept on phones (it was the one CTA that rose on iOS).

## Performance (390×844, resources completed before load, localhost bytes)
BEFORE 19 requests / 799,526 B → AFTER 14 / 365,279 B; 1280: 22 / 1,007,055 → 16 / 469,535. LCP element unchanged (hero webp). Changes: Nunito self-hosted as one variable woff2 (`assets/fonts/nunito-latin-var.woff2`, 39,152 B, from fonts.gstatic v32; preload + @font-face, Google CSS chain gone); `html.js` set by an inline head script (no reveal flash) with `onerror` on script.js removing it (a failed script no longer blanks 20 sections); video `preload="none"` + `data-autoplay` (77 KB webm fetched only in view); Lottie (168 KB) injected after load/idle and paused off-screen or when the tab is hidden; hero re-encoded WebP q70 from the original capture (68,724 → 42,908 B); nine JPEG/PNG captures → WebP (1,160,592 → 232,818 B; originals kept); duplicate Subjects JPEG replaced by the existing webp. Not done on purpose: deferring PostHog (loses bounce signal). Lighthouse is not installed on this Mac.

## Accessibility / SEO
Selected tab uses `--electric-dk` (5.94:1); h1 accent `--electric-display: #1A97D6` (3.09:1, display text only); text-link hover underlines; focus ring `--electric-dk`; `scroll-padding-top: 5rem`; sticky bar toggles `visibility` (not focusable while hidden); stars `role="img"`; tab panels `tabindex="0"`; sr-only h2 over the feature rows; theme-color on both pages; robots.txt, sitemap.xml, favicon.ico (root, crawler fallback — the PNG link stays); Superwall privacy URL updated. 8 tabs at 60rem+: `.tabs::after` spacer disabled and tab padding tightened so all eight sit on one row.

## Open for Robin
- **Analog Electronics tab reuses the Subjects-picker capture** (its Analog tile is cropped off-screen). Wants a real capture from the phone: the Analog section home or a Signals & Waves reveal, saved as `assets/cap-analog-w.webp` at 720×1565.
- **A fourth feature row** (Projects tab: Circuit Lab bench, OhmieCAD, Logic Lab) needs a fresh capture too — the only one on disk (Aug 26) reads "Three labs" while the live app says "Four labs".
- **privacy.html** still promises chosen board names / per-subject boards (published 09-21 ahead of 1.5.5 by your call) and describes Ohmie World live play while the doors are off. Left as is.
- 768-wide iPads get the phone sticky bar and no nav links (pre-existing breakpoint at 48.01rem).
- RevenueCat's current offering also carries a $19.99 "Rescue Annual" downsell; the site's $29.99 is the standard price.
