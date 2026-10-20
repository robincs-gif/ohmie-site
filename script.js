/* Ohmie site — vanilla JS
   (index.html marks <html class="js"> with an inline <script> in <head> so styles.css
       may hide inactive tab panels; with JS off every panel stacks and nothing is hidden.)
   0.  Campaign attribution stamped onto every App Store link
   0b. App Store clicks captured to PostHog (Site.appStoreClicked)
   1.  Sticky bar (phones only): hidden while the hero CTA, the pricing button
       or the final badge is on screen
   2.  Tab lists (How Ohmie works, Subjects): aria-selected, roving tabindex, arrow keys;
       the How panels are a scroll-snap carousel on phones
   3.  Plan picker: Yearly / Monthly swaps the button label, the fine print and the
       placement name (pricing ↔ pricing_monthly)
   3b. "New in 1.6.3" card: its notes collapse behind a <details> on phones only
   4.  Videos: play when scrolled into view, pause off-screen, poster only under reduced motion
   5.  Live Rive mascots (hero, plan picker, final call to action): hop or run in, idle loop,
       a reaction on every tap and on a plan change; Ohmie's Halloween costume from October 1 to November 1 */

(function () {
  'use strict';

  /* ---------- 0. campaign attribution on store links ----------
     Apple reads ?ct= off an App Store URL and reports those installs
     under that name in App Store Connect. Ad traffic arrives carrying a
     utm tag, so pass it straight through; organic visits fall back to
     "ohmie_site". Without this every install sourced from this page is
     unattributed, which makes paid spend unreadable.

     Runs first on purpose: if a later block throws, attribution has
     already been applied. */
  (function tagStoreLinks() {
    var qs = new URLSearchParams(window.location.search);
    var raw = qs.get('ct') || qs.get('utm_campaign') || qs.get('utm_source') || 'ohmie_site';
    var token = raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'ohmie_site';
    document.querySelectorAll('a[href*="apps.apple.com"]').forEach(function (a) {
      var href = a.getAttribute('href');
      // Product page only. The subscription-management link must stay bare.
      if (!href || href.indexOf('/app/') === -1 || href.indexOf('ct=') !== -1) return;
      a.setAttribute('href', href + (href.indexOf('?') === -1 ? '?' : '&') +
                             'ct=' + token + '&mt=8');
    });
  })();

  /* ---------- 0b. App Store click analytics ----------
     One delegated listener covers every store link. Fires
     Site.appStoreClicked with the link's data-placement; posthog-js
     queues the event and flushes it via sendBeacon on pagehide, so
     navigation is never blocked and the event is not lost. */
  document.addEventListener('click', function (e) {
    if (!window.posthog || typeof posthog.capture !== 'function') return;
    var t = e.target;
    var link = t && t.closest ? t.closest('a[href*="apps.apple.com"]') : null;
    if (!link) return;
    posthog.capture('Site.appStoreClicked', {
      placement: link.getAttribute('data-placement') || 'unknown'
    });
  });

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. sticky bar (phones only; CSS hides it above 48rem) ----------
     Hidden while the hero CTA, the pricing button or the final badge is on
     screen so two store buttons never stack. The pricing button is watched as
     an element (#planBtn, the [data-placement="pricing"] pill): block 3 swaps
     its placement attribute to pricing_monthly and back, and the observer
     keeps watching the same element through the swap. */
  var bar = document.getElementById('stickyBar');
  var heroCta = document.getElementById('heroCta');
  var pricingBtn = document.getElementById('planBtn') || document.querySelector('[data-placement="pricing"]');
  var finalBadge = document.querySelector('[data-placement="final_cta"]');
  if (bar && heroCta && pricingBtn && finalBadge && 'IntersectionObserver' in window) {
    var heroVisible = true, pricingVisible = false, finalVisible = false;
    var updateBar = function () {
      var show = !heroVisible && !pricingVisible && !finalVisible;
      bar.classList.toggle('is-visible', show);
      bar.setAttribute('aria-hidden', show ? 'false' : 'true');
    };
    new IntersectionObserver(function (es) { heroVisible = es[0].isIntersecting; updateBar(); }).observe(heroCta);
    new IntersectionObserver(function (es) { pricingVisible = es[0].isIntersecting; updateBar(); }).observe(pricingBtn);
    new IntersectionObserver(function (es) { finalVisible = es[0].isIntersecting; updateBar(); }).observe(finalBadge);
  }

  /* ---------- 2. tab lists ----------
     Every [role=tablist] on the page: click selects, ArrowLeft/ArrowRight (and Up/Down)
     wrap, Home/End jump; aria-selected + roving tabindex; the matching panels toggle
     .is-active and all stay in the DOM. On phones the How panels sit in a scroll-snap
     track, so selecting a tab scrolls its panel into view and swiping updates the tab. */
  Array.prototype.slice.call(document.querySelectorAll('[role="tablist"]')).forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    if (!tabs.length || panels.some(function (p) { return !p; })) return;
    var track = panels[0].parentNode;
    var selectTab = function (i, focus, scroll) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[j].classList.toggle('is-active', on);
      });
      if (focus) tabs[i].focus();
      if (scroll && track.scrollWidth > track.clientWidth + 4) {
        track.scrollTo({ left: panels[i].offsetLeft - track.offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
      if (list.scrollWidth > list.clientWidth + 4) {
        tabs[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { selectTab(i, false, true); });
      t.addEventListener('keydown', function (ev) {
        var n = null;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') n = (i + 1) % tabs.length;
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') n = (i - 1 + tabs.length) % tabs.length;
        if (ev.key === 'Home') n = 0;
        if (ev.key === 'End') n = tabs.length - 1;
        if (n !== null) { ev.preventDefault(); selectTab(n, true, true); }
      });
    });
    /* swipe on the phone carousel: the panel that fills most of the track becomes the tab */
    if ('IntersectionObserver' in window && track.classList.contains('how-panels')) {
      var swipe = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6 && track.scrollWidth > track.clientWidth + 4) {
            var i = panels.indexOf(e.target);
            if (i >= 0 && tabs[i].getAttribute('aria-selected') !== 'true') selectTab(i, false, false);
          }
        });
      }, { root: track, threshold: 0.6 });
      panels.forEach(function (p) { swipe.observe(p); });
    }
  });

  /* ---------- 3. plan picker ----------
     Yearly is the static default (the HTML renders it with JS off). Choosing Monthly
     flips data-selected on the card group (CSS swaps the button label and the fine
     print) and renames the placement on the pill and the badge: pricing ↔
     pricing_monthly, the attribute swapped, never a third name. */
  var plans = document.getElementById('plans');
  var planBtn = document.getElementById('planBtn');
  var planBadge = document.getElementById('planBadge');
  if (plans && planBtn && planBadge) {
    Array.prototype.slice.call(plans.querySelectorAll('input[name="plan"]')).forEach(function (input) {
      input.addEventListener('change', function () {
        if (!input.checked) return;
        var monthly = input.value === 'monthly';
        plans.setAttribute('data-selected', monthly ? 'monthly' : 'yearly');
        planBtn.setAttribute('data-placement', monthly ? 'pricing_monthly' : 'pricing');
        planBadge.setAttribute('data-placement', monthly ? 'pricing_monthly' : 'pricing');
        if (typeof window.__ohmiePlanReact === 'function') window.__ohmiePlanReact(monthly);
      });
    });
  }

  /* ---------- 3b. "New in 1.6.3" card ----------
     Its six notes sit behind a <details> ("What's new in 1.6.3") on phones, closed
     until tapped; from 60rem up the summary is hidden by CSS and the details stays
     open. The HTML ships it open, so with JS off every note is visible. */
  var newDetails = document.querySelector('.new-details');
  if (newDetails && 'matchMedia' in window) {
    var wide = window.matchMedia('(min-width: 60rem)');
    var syncNew = function () { newDetails.open = wide.matches; };
    syncNew();
    if (wide.addEventListener) wide.addEventListener('change', syncNew);
    else if (wide.addListener) wide.addListener(syncNew);
  }

  /* ---------- 4. videos ----------
     Reduced motion: poster only. Otherwise play on entry, pause off-screen;
     autoplay refusals are swallowed (the poster stays). */
  var videos = Array.prototype.slice.call(document.querySelectorAll('video[data-autoplay]'));
  if (reduceMotion) {
    videos.forEach(function (v) { v.removeAttribute('data-autoplay'); v.pause(); });
  } else if (videos.length && 'IntersectionObserver' in window) {
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          var p = v.play();
          if (p && p.catch) p.catch(function () { v.controls = false; });
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.25 });
    videos.forEach(function (v) { vo.observe(v); });
  }
})();

/* ---------- 5. live Rive mascots ----------
   Ohmie from the Rive file (assets/rive/ohmie.riv: the app's ohmie_lesson.riv, the "Ohmie" artboard,
   220 x 260), in the hero, beside the plan cards and at the final call to action. Progressive
   enhancement: each WebP stays unless Rive loads successfully. Honors prefers-reduced-motion (static
   images). The runtime (~95 KB JS + ~360 KB wasm, gzipped) and the ~108 KB (gzipped) file are NOT in
   the initial load: they are injected after the window load event (inside requestIdleCallback when
   available); the plan and final Ohmies start when they scroll into view (the file is cached by then).
   Each pauses while off-screen or the tab is hidden.
   Choreography: HopIn then Wave, or RunIn (which ends in its own wave), then the Idle loop; a
   LookAround every ~9 s in the hero; a tap plays one reaction and returns to Idle; the plan Ohmie
   cheers when the plan changes. The clips are one-shots, so each is followed by Idle after its own
   length (seconds below, read from the file).
   Halloween (October 1 to November 1, the app's costume window: <html class="halloween">, set in the
   head): every clip plays with the one-frame CostumeHalloween timeline, so Ohmie wears his vampire
   cape, collar and fangs and his little bat, and a tap plays Boo, Trick or treat, Jack-o'-lantern or
   Bat swarm. It switches itself off after November 1. */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var heroImg = document.getElementById('heroMascotImg');
  var heroBox = document.getElementById('heroMascotRive');
  var planImg = document.getElementById('planMascotImg');
  var planBox = document.getElementById('planMascotRive');
  var finalImg = document.getElementById('finalMascotImg');
  var finalBox = document.getElementById('finalMascotRive');
  if (!heroImg || !heroBox) return;

  var HALLOWEEN = document.documentElement.classList.contains('halloween');
  var LENGTH = { HopIn: 0.8, RunIn: 1.2, Wave: 1.2, LookAround: 2, Celebrate: 1.5, JumpForJoy: 1.4, Cheer: 0.83, Giggle: 0.8, ScreenSquish: 2.0, Tumble: 2.2,
                 Boo: 1.5, TrickOrTreat: 1.6, JackOLantern: 2.2, BatSwarm: 2.4 };
  var TAPS = HALLOWEEN ? ['Boo', 'TrickOrTreat', 'JackOLantern', 'BatSwarm']
                       : ['Celebrate', 'JumpForJoy', 'Cheer', 'Giggle', 'ScreenSquish', 'Tumble'];
  /* The costume is a one-frame timeline that keys only the costume's gates: played with a move, it dresses him. */
  function dressed(name) { return HALLOWEEN ? [name, 'CostumeHalloween'] : name; }

  function mascot(box, img, lookAround) {
    var canvas = box.querySelector('canvas');
    if (!canvas) return null;
    var r, busy = true, inView = true, next = null, lastTap = -1;
    var running = function () { return inView && !document.hidden; };

    function clip(name, then) {
      busy = true;
      r.stop(); r.play(dressed(name));
      clearTimeout(next);
      next = setTimeout(then || idle, LENGTH[name] * 1000 + 60);
    }
    function idle() {
      busy = false;
      r.stop(); r.play(dressed('Idle'));
      if (!running()) r.pause();
    }
    function sync() {
      if (!r) return;
      if (running()) r.play(); else r.pause();
    }

    try {
      r = new rive.Rive({
        src: 'assets/rive/ohmie.riv?v=20261009e',
        canvas: canvas,
        artboard: 'Ohmie',
        animations: dressed('Idle'),
        autoplay: false,
        layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.BottomCenter }),
        onLoad: function () {
          r.resizeDrawingSurfaceToCanvas();
          img.hidden = true; box.hidden = false;
          r.resizeDrawingSurfaceToCanvas();
          if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (es) {
              es.forEach(function (e) { inView = e.isIntersecting; });
              sync();
            }, { threshold: 0 }).observe(box);
          }
          document.addEventListener('visibilitychange', sync);
          window.addEventListener('resize', function () { r.resizeDrawingSurfaceToCanvas(); });
          if (Math.random() < 0.5) clip('HopIn', function () { clip('Wave'); });
          else clip('RunIn');
          if (lookAround) setInterval(function () { if (!busy && running()) clip('LookAround'); }, 9000);
        },
        onLoadError: function () { box.hidden = true; img.hidden = false; }
      });
    } catch (e) { box.hidden = true; img.hidden = false; return null; }

    box.addEventListener('click', function () {
      if (!r || busy) return;
      var i;
      do { i = Math.floor(Math.random() * TAPS.length); } while (i === lastTap);
      lastTap = i;
      clip(TAPS[i]);
    });
    return { react: function (name) { if (r && !busy) clip(name); } };
  }

  function whenSeen(img, box, then) {
    if (!img || !box) return;
    if (!('IntersectionObserver' in window)) { then(); return; }
    var seen = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      seen.disconnect();
      then();
    }, { threshold: 0.3 });
    seen.observe(img);
  }

  function start() {
    if (typeof rive === 'undefined') return;
    mascot(heroBox, heroImg, true);
    /* The plan Ohmie hops in beside the cards and reacts to the choice. */
    whenSeen(planImg, planBox, function () {
      var m = mascot(planBox, planImg, false);
      if (m) window.__ohmiePlanReact = function (monthly) { m.react(HALLOWEEN ? 'Boo' : (monthly ? 'Giggle' : 'Cheer')); };
    });
    /* The final Ohmie hops in when the visitor reaches the call to action. */
    whenSeen(finalImg, finalBox, function () { mascot(finalBox, finalImg, false); });
  }

  function inject() {
    var s = document.createElement('script');
    s.src = 'assets/vendor/rive/rive.js';
    s.async = true;
    s.addEventListener('load', function () {
      if (typeof rive !== 'undefined' && rive.RuntimeLoader) rive.RuntimeLoader.setWasmUrl('assets/vendor/rive/rive.wasm');
      /* Timelines by name, two at once for the costume: deprecated in the next major runtime, fine in
         the vendored one. Moving to a newer runtime means moving to the "Ohmie" state machine and its
         view model's costume switch. */
      if (typeof rive !== 'undefined' && rive.Rive) rive.Rive.suppressDeprecationWarnings = ['names-array', 'animation-names', 'animations-param'];
      start();
    });
    document.head.appendChild(s);
  }

  function schedule() {
    if ('requestIdleCallback' in window) window.requestIdleCallback(inject, { timeout: 2000 });
    else window.setTimeout(inject, 500);
  }

  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule);
})();
