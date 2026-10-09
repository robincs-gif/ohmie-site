/* Ohmie site — vanilla JS
   (index.html marks <html class="js"> with an inline <script> in <head> so styles.css
       may hide .reveal content until it scrolls in; with JS off nothing is ever hidden.)
   0.  Campaign attribution stamped onto every App Store link
   0b. App Store clicks captured to PostHog (Site.appStoreClicked)
   1.  Reveal-on-scroll (IntersectionObserver, respects prefers-reduced-motion)
   2.  Sticky bar (phones only): hidden while the hero CTA, the pricing button
       or the final badge is on screen
   3.  Subject tabs (aria-selected, arrow keys)
   4.  Videos: play when scrolled into view, pause off-screen, poster only under reduced motion
   5.  Live Rive mascots (the hero and the final call to action): hop or run in, idle loop,
       a reaction on every tap; Ohmie's Halloween costume and moves from October 1 to November 1 */

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

  /* ---------- 1. reveal-on-scroll ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in-view'); });
  } else {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 2. sticky bar (phones only; CSS hides it above 48rem) ----------
     Hidden while the hero CTA, the pricing button or the final badge is on
     screen so two store buttons never stack. */
  var bar = document.getElementById('stickyBar');
  var heroCta = document.getElementById('heroCta');
  var pricingBtn = document.querySelector('[data-placement="pricing"]');
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

  /* ---------- 3. subject tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.tab-panel'));
  if (tabs.length && tabs.length === panels.length) {
    var selectTab = function (i, focus) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[j].classList.toggle('is-active', on);
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { selectTab(i, false); });
      t.addEventListener('keydown', function (ev) {
        var n = null;
        if (ev.key === 'ArrowRight') n = (i + 1) % tabs.length;
        if (ev.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
        if (ev.key === 'Home') n = 0;
        if (ev.key === 'End') n = tabs.length - 1;
        if (n !== null) { ev.preventDefault(); selectTab(n, true); }
      });
    });
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
   220 x 260), in the hero and at the final call to action. Progressive enhancement: each WebP stays
   unless Rive loads successfully. Honors prefers-reduced-motion (static images). The runtime (~95 KB JS
   + ~360 KB wasm, gzipped) and the ~108 KB (gzipped) file are NOT in the initial load: they are injected
   after the window load event (inside requestIdleCallback when available); the final Ohmie starts when
   it scrolls into view (the file is cached by then). Each pauses while off-screen or the tab is hidden.
   Choreography: HopIn then Wave, or RunIn (which ends in its own wave), then the Idle loop; a
   LookAround every ~9 s in the hero; a tap plays one reaction and returns to Idle. The clips are
   one-shots, so each is followed by Idle after its own length (seconds below, read from the file).
   Halloween (October 1 to November 1, the app's costume window: <html class="halloween">, set in the
   head): every clip plays with the one-frame CostumeHalloween timeline, so Ohmie wears his vampire
   cape, collar and fangs and his little bat, and a tap plays Boo, Trick or treat, Jack-o'-lantern or
   Bat swarm. It switches itself off after November 1. */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var heroImg = document.getElementById('heroMascotImg');
  var heroBox = document.getElementById('heroMascotRive');
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
    if (!canvas) return;
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
        src: 'assets/rive/ohmie.riv',
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
    } catch (e) { box.hidden = true; img.hidden = false; return; }

    box.addEventListener('click', function () {
      if (!r || busy) return;
      var i;
      do { i = Math.floor(Math.random() * TAPS.length); } while (i === lastTap);
      lastTap = i;
      clip(TAPS[i]);
    });
  }

  function start() {
    if (typeof rive === 'undefined') return;
    mascot(heroBox, heroImg, true);
    /* The final Ohmie hops in when the visitor reaches the call to action. */
    if (finalImg && finalBox && 'IntersectionObserver' in window) {
      var seen = new IntersectionObserver(function (es) {
        if (!es.some(function (e) { return e.isIntersecting; })) return;
        seen.disconnect();
        mascot(finalBox, finalImg, false);
      }, { threshold: 0.3 });
      seen.observe(finalImg);
    }
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
