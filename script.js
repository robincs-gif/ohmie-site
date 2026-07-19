/* Ohmie landing page — vanilla JS
   1. Reveal-on-scroll (IntersectionObserver, respects prefers-reduced-motion)
   2. Auto-rotating feature slider synced to the feature cards
   3. Live Lottie hero mascot: idle loop + tap-to-celebrate
   4. Final-CTA mascot: celebrate once when it scrolls into view */

(function () {
  'use strict';

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

  /* ---------- 2. feature slider ---------- */
  var slides = document.querySelectorAll('.phone-slider .slide');
  var dots = document.querySelectorAll('.slider-dots .dot');
  var cards = document.querySelectorAll('.feature-card');
  var current = 0;
  var timer = null;
  var INTERVAL = 4500;

  function goTo(index) {
    current = index % cards.length;
    slides.forEach(function (el, i) { el.classList.toggle('is-active', i === current); });
    dots.forEach(function (el, i) { el.classList.toggle('is-active', i === current); });
    cards.forEach(function (el, i) { el.classList.toggle('is-active', i === current); });
  }
  function startTimer() { stopTimer(); timer = setInterval(function () { goTo(current + 1); }, INTERVAL); }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  if (cards.length) {
    dots.forEach(function (dot, i) { dot.addEventListener('click', function () { goTo(i); startTimer(); }); });
    cards.forEach(function (card, i) { card.addEventListener('click', function () { goTo(i); startTimer(); }); });
    var featureSection = document.querySelector('.features');
    if (featureSection) {
      featureSection.addEventListener('mouseenter', stopTimer);
      featureSection.addEventListener('mouseleave', startTimer);
    }
    if (!reduceMotion) startTimer();
  }
})();

/* ---------- 3 + 4. live Lottie mascots ----------
   Progressive enhancement: PNG stays unless Lottie loads successfully.
   Honors prefers-reduced-motion (static PNG). Same guard discipline as the app. */
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

  /* --- hero: idle loop, tap to celebrate --- */
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

  /* --- final CTA: celebrate once on scroll-into-view --- */
  var finalImg = document.getElementById('finalMascotImg');
  var finalBox = document.getElementById('finalMascotLottie');
  if (finalImg && finalBox && 'IntersectionObserver' in window) {
    var fired = false;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || fired) return;
        fired = true;
        obs.disconnect();
        var c = loadInto(finalBox, 'celebrate', false);
        c.addEventListener('DOMLoaded', function () { finalImg.hidden = true; finalBox.hidden = false; });
        c.addEventListener('data_failed', function () { finalBox.hidden = true; finalImg.hidden = false; });
        c.addEventListener('complete', function () {
          // settle into the idle breathing loop after the one-shot celebrate
          c.destroy();
          loadInto(finalBox, 'idle', true);
        });
      });
    }, { threshold: 0.5 });
    obs.observe(finalImg);
  }
})();
