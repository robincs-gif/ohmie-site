/* Ohmie landing page — vanilla JS
   1. Auto-rotating feature slider (mirrors calai's carousel)
   2. Trial modal: desktop exit-intent OR (30s + 50% scroll depth),
      once per session (sessionStorage), body scroll-locked while open */

(function () {
  'use strict';

  /* ---------- feature slider ---------- */
  var slides = document.querySelectorAll('.phone-slider .slide');
  var dots = document.querySelectorAll('.slider-dots .dot');
  var cards = document.querySelectorAll('.feature-card');
  var current = 0;
  var timer = null;
  var INTERVAL = 4500;

  function goTo(index) {
    current = index % cards.length; /* cards drive rotation; phone slides hidden 2026-07-04 */
    slides.forEach(function (el, i) { el.classList.toggle('is-active', i === current); });
    dots.forEach(function (el, i) { el.classList.toggle('is-active', i === current); });
    cards.forEach(function (el, i) { el.classList.toggle('is-active', i === current); });
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(function () { goTo(current + 1); }, INTERVAL);
  }

  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  if (cards.length) {
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goTo(i); startTimer(); });
    });
    cards.forEach(function (card, i) {
      card.addEventListener('click', function () { goTo(i); startTimer(); });
    });
    var featureSection = document.querySelector('.features');
    if (featureSection) {
      featureSection.addEventListener('mouseenter', stopTimer);
      featureSection.addEventListener('mouseleave', startTimer);
    }
    startTimer();
  }

  /* ---------- trial modal ---------- */
  var MODAL_KEY = 'ohmie-trial-modal-seen';
  var TIME_GATE = 30000;  // 30s elapsed…
  var SCROLL_GATE = 0.5;  // …AND >=50% scroll depth
  var overlay = document.getElementById('trialModal');
  var closeBtn = document.getElementById('modalClose');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function hasFired() {
    try { return sessionStorage.getItem(MODAL_KEY) === '1'; } catch (e) { return false; }
  }

  function openModal() {
    if (!overlay) return;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden'; // scroll-lock, restored on close
    if (reducedMotion.matches) {
      // no spring/fade — appear instantly
      overlay.classList.add('is-open');
    } else {
      // next frame so the transition runs
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { overlay.classList.add('is-open'); });
      });
    }
    try { sessionStorage.setItem(MODAL_KEY, '1'); } catch (e) { /* private mode */ }
  }

  function closeModal() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (reducedMotion.matches) {
      overlay.hidden = true;
    } else {
      setTimeout(function () { overlay.hidden = true; }, 300);
    }
  }

  if (overlay) {
    /* trigger: desktop exit-intent OR (30s elapsed AND >=50% scroll depth),
       whichever first — at most once per session */
    var timeGatePassed = false;
    var timeGateTimer = null;

    function scrollDepth() {
      var doc = document.documentElement;
      var height = doc.scrollHeight;
      if (height <= window.innerHeight) return 1; // page fits in viewport
      return ((window.pageYOffset || doc.scrollTop) + window.innerHeight) / height;
    }

    function disarm() {
      document.documentElement.removeEventListener('mouseleave', onExitIntent);
      window.removeEventListener('scroll', onScrollCheck);
      if (timeGateTimer) { clearTimeout(timeGateTimer); timeGateTimer = null; }
    }

    function fire() {
      disarm();
      if (!hasFired()) openModal();
    }

    function onExitIntent(e) {
      // leaving the viewport toward the top (small threshold for fast exits)
      if (e.clientY <= 10) fire();
    }

    function onScrollCheck() {
      if (timeGatePassed && scrollDepth() >= SCROLL_GATE) fire();
    }

    if (!hasFired()) {
      // desktop only: exit-intent (touch devices never fire this)
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        document.documentElement.addEventListener('mouseleave', onExitIntent);
      }
      // mobile/all: time + scroll-depth gates
      timeGateTimer = setTimeout(function () {
        timeGatePassed = true;
        onScrollCheck(); // user may already be past 50%
      }, TIME_GATE);
      window.addEventListener('scroll', onScrollCheck, { passive: true });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden) closeModal();
    });
  }
})();
