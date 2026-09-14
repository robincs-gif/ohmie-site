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

