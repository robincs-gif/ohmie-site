/* Ohmie site — vanilla JS
   js. Marks <html class="js"> so styles.css may hide .reveal content until it scrolls in;
       with JS off nothing is ever hidden.
   0.  Campaign attribution stamped onto every App Store link
   0b. App Store clicks captured to PostHog (Site.appStoreClicked)
   1.  Reveal-on-scroll (IntersectionObserver, respects prefers-reduced-motion)
   2.  Sticky bar (phones only): hidden while the hero CTA, the pricing button
       or the final badge is on screen
   3.  Subject tabs (aria-selected, arrow keys)
   4.  Videos: play when scrolled into view, pause off-screen, poster only under reduced motion
   5.  Live Lottie hero mascot: idle loop + tap-to-celebrate */

document.documentElement.classList.add('js');

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
  var videos = Array.prototype.slice.call(document.querySelectorAll('video[autoplay]'));
  if (reduceMotion) {
    videos.forEach(function (v) { v.removeAttribute('autoplay'); v.pause(); });
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

/* ---------- 5. live Lottie hero mascot ----------
   Progressive enhancement: the WebP stays unless Lottie loads successfully.
   Honors prefers-reduced-motion (static image). Same guard discipline as the app. */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof lottie === 'undefined') return;

  function loadInto(box, name, loop) {
    return lottie.loadAnimation({
      container: box, renderer: 'svg', loop: loop, autoplay: true,
      path: 'assets/lottie/' + name + '.json'
    });
  }

  var heroImg = document.getElementById('heroMascotImg');
  var heroBox = document.getElementById('heroMascotLottie');
  if (heroImg && heroBox) {
    var anim = loadInto(heroBox, 'idle', true);
    anim.addEventListener('DOMLoaded', function () { heroImg.hidden = true; heroBox.hidden = false; });
    anim.addEventListener('data_failed', function () { heroBox.hidden = true; heroImg.hidden = false; });

    var celebrating = false;
    heroBox.addEventListener('click', function () {
      if (celebrating) return;
      celebrating = true;
      anim.destroy();
      var c = loadInto(heroBox, 'celebrate', false);
      function backToIdle() { c.destroy(); anim = loadInto(heroBox, 'idle', true); celebrating = false; }
      c.addEventListener('complete', backToIdle);
      c.addEventListener('data_failed', backToIdle);
    });
  }
})();
