# ohmie.io redesign: Brilliant's skeleton, Ohmie's skin, built as a funnel

Date: 2026-09-12
Status: approved in brainstorm (direction B, 9-section order, sticky bar), awaiting spec review
Repo: `~/Code/ohmie-site` (static HTML/CSS/JS on GitHub Pages, no build step)

## Goal

One job for every visitor: tap through to the App Store. Everything on the page either builds the case for the tap or is the tap.

Success is measured, not guessed. PostHog already captures `Site.appStoreClicked` with a `data-placement` property on every store link. After launch, the metric is App Store clicks per site visit, compared to the 30 days before.

## What stays the same

- Stack: `index.html`, `styles.css`, `script.js`, `privacy.html`, `assets/`. No framework, no bundler. Nunito from Google Fonts.
- Palette and type: the existing `:root` tokens (`--cream #FBF9F1`, `--electric #2EA8E6`, `--amber #FFB020`, `--ink #3C3C3C`, `--stroke #E8E2D2`, etc.). Nunito 900 for headlines. This is "direction B": Brilliant's layout in Ohmie's colours.
- Copy: the current headline, sub, step text, subject blurbs, pricing and FAQ text were refreshed in 1.4.8 against the real app. Reuse them. Only the copy noted below changes.
- Analytics: cookieless PostHog, `Site.appStoreClicked` on every store link. Extended, not replaced.
- Privacy page, footer links, `Manage Subscription` link.
- The 7 framed screenshots and the two mascot images already in `assets/`.

## Page structure (12 sections become 9)

Numbers in brackets are `data-placement` values for the store links in that section.

1. **Hero.** Headline "Learn real electronics, 3 minutes a day." with "3 minutes a day." in electric blue. One sub line. Amber pill **Start free** `[hero]` and the App Store badge `[hero-badge]` side by side. Framed phone screenshot right (`site-hero-cream.webp`), mascot tucked at its base. Trial line under the buttons: "7 days free on Yearly. Then $7.99/mo or $29.99/yr."
2. **Proof band.** Three white cards on cream, directly under the hero: **4.6 ★** "App Store rating, 85 ratings" · **500+** "bite-size lessons" · **7** "subjects, no prerequisites". Numbers come from the App Store lookup on 2026-09-12 (id 6779694265) and are hard-coded; refresh them when the count moves.
3. **How it works.** Existing three steps and three phone shots, tightened to one line each. Ends on a text link **Try the first lesson free →** `[how]`.
4. **Three feature rows.** Screenshot inside a tinted rounded tile, text beside it, sides alternating. Tiles use `--electric-tint`, `--cream-deep`, and a new `--amber-tint #FFF4DC`. Rows: (a) "You don't watch electronics. You solve it." with `site-circuit-framed.webp`; (b) "Everything, one tap away" (Explore, leaderboard, review queue) with `site-home-framed.webp`; (c) "Streaks, levels, and a Daily Charge that make 3 minutes stick" with `site-leaderboard-framed.webp`. Row (c) absorbs the purple momentum band's bullets.
5. **Subjects.** Seven tabs (Electronics → Robotics) using the existing blurbs. Selecting a tab swaps the screenshot beside the list; default is Electronics. Tabs are real `<button>`s with `aria-selected`; the content is in the DOM for all seven so it works without JS. Closing line "No prerequisites. Start at 01." followed by text link **Start at 01, free →** `[subjects]`.
6. **Reviews.** Four to six real App Store reviews from the RSS feed pulled 2026-09-12: six 5-star reviews with usable text exist (Z3WhoSleeps, HarryChoppa, AsiusG3112, bird_coffin, Jigmelama21, Mechatronics Engineer). Show reviewer handle, five stars, title, and body trimmed to ~140 characters with an ellipsis. Cards in a horizontal scroll on phones, a 3-column grid on desktop. Header: "What people say on the App Store". No fabricated reviews, ever.
7. **Pricing.** Existing two-card layout. Yearly card is highlighted and carries **Start 7 days free** `[pricing]`. Monthly card's button is a plain link to the same store page `[pricing-monthly]`. Line under: "Cancel anytime in Settings."
8. **FAQ.** Five of the existing seven questions, in this order: hardware, total beginners, how far it goes, stuck on a question, cancel anytime. "Experiment without a lesson" and "design a real circuit board" are dropped (the first is answered by feature row b, the second by the PCB Design tab).
9. **Final CTA.** Unchanged: mascot, "Your first circuit is 3 minutes away.", badge `[final]`.

**Sticky bar (phones only, ≤ 768px).** Fixed to the bottom: app icon, "Ohmie · Free to start, 7-day trial", amber **Get** button `[sticky]`. Hidden while the hero's own button is on screen (IntersectionObserver on the hero CTA), shown once it scrolls off, hidden again inside the final CTA section. Respects `env(safe-area-inset-bottom)`. Never shown on desktop.

**Cut:** "Dress up Ohmie" (spotlight), the purple momentum band as a separate section, and the "What does Ohmie include?" grid. Their images stay in `assets/` for the App Store listing.

**Nav.** Logo, Features, Why, Support, Manage Subscription, badge `[nav]`. Unchanged.

## Behaviour and accessibility

- Reveal-on-scroll animation stays, but content must be readable with JS off: the initial `opacity: 0` is applied only when `<html>` has a `js` class that `script.js` adds. Crawlers, screenshot tools and no-JS visitors see the full page.
- Every store link is `<a href="https://apps.apple.com/us/app/ohmie-learn-electronics/id6779694265" data-placement="…">`. `script.js` keeps capturing `Site.appStoreClicked` with that placement.
- Tabs and FAQ `<details>` work with keyboard. Focus rings use `--electric`.
- Images have alt text describing the screen, not "screenshot". Mascot images are decorative (`alt=""`).
- No horizontal scroll at 375px. Type never below 14px on phones.
- `prefers-reduced-motion` disables the reveal transitions and the sticky bar's slide.

## Files touched

- `index.html`: restructured to the nine sections above. Roughly the same length as today.
- `styles.css`: new rules for `.proof`, `.tile`, `.tabs`, `.reviews`, `.sticky-bar`; removal of `.spotlight`, `.momentum`, `.features` grid rules. `--amber-tint` added to `:root`.
- `script.js`: sticky bar observer, tab switching, `js` class on `<html>`. Existing analytics block untouched.
- `.gitignore`: add `.superpowers/`.

No new dependencies. No new images required; if the reviews section wants avatars, use the mascot, not stock photos.

## Testing

Done in the headless browser before anything is pushed:

1. Screenshots at 375×812, 768×1024, 1280×720 and a full-page desktop capture, with reveals forced on. Compared by eye against the approved mockups.
2. Console has no errors; no failed network requests.
3. Every store link carries a `data-placement`, and each of these ten values appears exactly once: nav, hero, hero-badge, how, subjects, reviews, pricing, pricing-monthly, final, sticky. Checked with a DOM query.
4. Sticky bar: hidden at scroll 0 on 375px, visible after scrolling past the hero, hidden again at the final CTA. Not present in the DOM's rendered layout at 1280px.
5. Tabs: each of the seven shows its screenshot; keyboard arrows move between them.
6. With JS disabled (`js` class absent), all text is visible and all seven subject blurbs render.
7. `privacy.html` and the four footer links still resolve.
8. Lighthouse performance stays at or above today's score on mobile (baseline captured before the change with `/benchmark`).

## Out of scope

Copywriting beyond the lines named above, a blog, localisation, Android, a web signup flow, and any change to the app itself. The App Store product page is a separate task.

## Open decisions (none blocking)

- Whether to show the 85-ratings count next to 4.6 or just the star. Spec says show it; it reads as honest at this size. Revisit when it passes 100.
- Whether the reviews section needs a "See all on the App Store" link. Spec says yes, `[reviews]` placement, as a small text link under the cards.
