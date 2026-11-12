/* Ohmie site: vanilla JS
   (index.html's inline <script> in <head> marks <html class="js">, and adds "scenes" when Ohmie's scenes can run:
       IntersectionObserver is there and motion is allowed. Without either class every scene is a still picture and
       the header badge simply shows.)
   0.  Campaign attribution stamped onto every App Store link
   0b. App Store clicks captured to PostHog (Site.appStoreClicked)
   1.  Header: a rule under it once the page has scrolled; its App Store badge shows only while no other
       App Store button is on screen
   2.  Subjects strip: an arrow at each end that has more, when the line is wider than the screen
   3.  "New in" card: its notes collapse behind a <details> on phones only
   4.  Motion: a row's phone plays when its row scrolls in, then idles (styles.css "motion"); the sky fades in
       behind the walk
   5.  Ohmie's scenes: Rive artboards in the page's art boxes */

(function () {
  'use strict';

  /* ---------- 0. campaign attribution on store links ----------
     Apple reads ?ct= off an App Store URL and reports those installs
     under that name in App Store Connect. Ad traffic arrives carrying a
     utm tag, so pass it straight through; organic visits fall back to
     "ohmie_site". pt= is the provider token Apple needs to credit ct=.
     Without this every install sourced from this page is
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
                             'pt=128075266&ct=' + token + '&mt=8');
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

  /* ---------- 1. header ----------
     A rule appears under the header once the page has moved. The header's App Store badge (#headerCta; styles.css
     hides it under html.js) shows only while no other App Store button is on screen: the hero's buttons, the walk's
     badge, the offer's buttons, the ending's badge. Whatever is under the header itself counts as off screen. On
     phones the name sits centred until the badge arrives (.has-cta moves it left). Without IntersectionObserver
     the badge simply shows. */
  var header = document.getElementById('siteHeader');
  var headerCta = document.getElementById('headerCta');
  if (header) {
    var ruled = false;
    var rule = function () {
      var on = window.scrollY > 4;
      if (on !== ruled) { ruled = on; header.classList.toggle('is-scrolled', on); }
    };
    window.addEventListener('scroll', rule, { passive: true });
    rule();
  }
  if (header && headerCta) {
    var others = Array.prototype.slice.call(document.querySelectorAll('#heroCta, .journey-head .store-badge, .plan-cta, [data-placement="final_cta"]'));
    var showBadge = function (show) {
      headerCta.classList.toggle('is-visible', show);
      header.classList.toggle('has-cta', show);
    };
    if (others.length && 'IntersectionObserver' in window) {
      var onScreen = others.map(function (el) { return el.id === 'heroCta'; });   /* the page opens on the hero */
      others.forEach(function (el, i) {
        new IntersectionObserver(function (es) {
          onScreen[i] = es[es.length - 1].isIntersecting;
          showBadge(onScreen.indexOf(true) === -1);
        }, { rootMargin: '-' + header.offsetHeight + 'px 0px 0px 0px' }).observe(el);
      });
    } else {
      showBadge(true);
    }
  }

  /* ---------- 2. subjects strip ----------
     If the line of subjects is wider than the screen it scrolls sideways. An arrow shows at each end that has
     more and moves the line by most of its width. */
  var strip = document.querySelector('.strip-list');
  if (strip) {
    var arrow = function (dir) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'strip-arrow ' + (dir < 0 ? 'strip-prev' : 'strip-next');
      b.hidden = true;
      b.setAttribute('aria-label', dir < 0 ? 'Earlier subjects' : 'More subjects');
      b.innerHTML = '<svg viewBox="0 0 12 18" aria-hidden="true" focusable="false"><path d="' + (dir < 0 ? 'M9.5 2 3 9l6.5 7' : 'M2.5 2 9 9l-6.5 7') + '" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      b.addEventListener('click', function () { strip.scrollBy({ left: dir * strip.clientWidth * 0.7, behavior: reduceMotion ? 'auto' : 'smooth' }); });
      strip.parentNode.appendChild(b);
      return b;
    };
    var prev = arrow(-1), next = arrow(1);
    var arrows = function () {
      prev.hidden = strip.scrollLeft < 8;
      next.hidden = strip.scrollLeft > strip.scrollWidth - strip.clientWidth - 8;
    };
    strip.addEventListener('scroll', arrows, { passive: true });
    window.addEventListener('resize', arrows);
    arrows();
  }

  /* ---------- 3. "New in" card ----------
     Its notes sit behind a <details> on phones, closed until tapped; from 60rem up the summary is hidden by CSS
     and the details stays open. The HTML ships it open, so with JS off every note is visible. */
  var newDetails = document.querySelector('.new-details');
  if (newDetails && 'matchMedia' in window) {
    var wide = window.matchMedia('(min-width: 60rem)');
    var syncNew = function () { newDetails.open = wide.matches; };
    syncNew();
    if (wide.addEventListener) wide.addEventListener('change', syncNew);
    else if (wide.addListener) wide.addListener(syncNew);
  }

  /* ---------- 4. motion ----------
     styles.css "motion". Each stage is marked .is-seen the first time a third of it is on screen, which starts its
     art and pops its icons, and .is-away while it is off screen, which pauses its idle loop. html.motion turns on
     the poses before entry, so without this block (no IntersectionObserver, reduced motion, an earlier error) every
     picture and icon simply stays where it is.
     The sky: the pale tint behind the rows and the walk goes from clear to full as the top of the walk travels up
     the screen, and back again on the way up. */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('motion');
    var stages = Array.prototype.slice.call(document.querySelectorAll('.row-art-phone, .check-col, .review-track'));
    if (stages.length) {
      var stageWatch = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && e.intersectionRatio >= 0.3) e.target.classList.add('is-seen');
          e.target.classList.toggle('is-away', !e.isIntersecting);
        });
      }, { threshold: [0, 0.3] });
      stages.forEach(function (s) { stageWatch.observe(s); });
    }
    var sky = document.querySelector('.sky');
    var walk = document.getElementById('journey');
    if (sky && walk) {
      var skyQueued = false;
      var setSky = function () {
        skyQueued = false;
        var vh = window.innerHeight;
        var p = (vh - walk.getBoundingClientRect().top) / vh;
        sky.style.setProperty('--sky', Math.max(0, Math.min(1, p)).toFixed(3));
      };
      var askSky = function () { if (!skyQueued) { skyQueued = true; requestAnimationFrame(setSky); } };
      window.addEventListener('scroll', askSky, { passive: true });
      window.addEventListener('resize', askSky);
      setSky();
    }
  }
})();

/* ---------- 5. Ohmie's scenes ----------
   Every .scene[data-artboard] is one artboard of the Rive file drawn into the scene's canvas. With scenes on
   (html.scenes) a scene's box is empty until it starts and then plays itself in (.is-live); its still picture is
   what shows instead without scripts, under reduced motion, if the runtime or the file fails, or if the file
   lacks that artboard (.is-still). data-start says what starts a scene:
     load    the hero: with the page, at the moment its phone squashes (styles.css html.rv-burst)
     view    a third of it on screen. What plays is either data-machine, a state machine that runs an intro once
             and then loops, or data-replay, a timeline that is started again each time it ends (one that loops
             by itself simply loops), with data-loop, if given, as a second timeline that keeps playing on top.
             Either way Ohmie never stands still.
     scroll  it follows the scroll bar: data-scrub names the timeline moved by the scene's place on the screen,
             from its top entering to its bottom leaving (eased, about 0.4 s to settle, and back again on the way
             up), data-loop the one that keeps playing on top
   Scenes never take pointer events, and each pauses while it is off screen or the tab is hidden. The runtime
   (about 95 KB of JS and 360 KB of wasm, gzipped) and the file are not in the first load: they are fetched after
   the window load event, when the browser is idle. */
(function () {
  'use strict';
  var root = document.documentElement;
  var els = Array.prototype.slice.call(document.querySelectorAll('.scene[data-artboard]'));
  if (!els.length || !root.classList.contains('scenes')) return;
  var FILE = 'assets/rive/ohmie-site.riv?v=20261111';

  var scenes = els.map(function (el) {
    var sc = { el: el, canvas: el.querySelector('canvas'), artboard: el.getAttribute('data-artboard'),
               machine: el.getAttribute('data-machine'), replay: el.getAttribute('data-replay'),
               start: el.getAttribute('data-start') || 'view',
               scrub: el.getAttribute('data-scrub'), loop: el.getAttribute('data-loop'),
               r: null, video: null, made: false, loaded: false, started: false, inView: false, p: 0, len: 0 };
    sc.scrolled = sc.start === 'scroll';
    /* the timelines this script plays by name: a scroll scene's loop, or a replayed timeline with its loop on top */
    sc.names = sc.scrolled ? [sc.loop] : (sc.replay ? [sc.replay, sc.loop] : []);
    sc.names = sc.names.filter(Boolean);
    return sc;
  });

  /* ---- the file: fetched once, shared by every scene ---- */
  var file = null, low = null, fileState = 'waiting', queue = [];   /* waiting | ready | failed */
  function whenFile(fn) { if (fileState === 'waiting') queue.push(fn); else fn(); }
  function settle(state) {
    if (fileState !== 'waiting') return;
    fileState = state;
    queue.splice(0).forEach(function (fn) { fn(); });
  }
  /* A timeline's length in seconds, or 0 if the file has no such artboard or timeline. */
  function lengthOf(artboard, timeline) {
    var ab = null, len = 0;
    try {
      ab = low.artboardByName(artboard);
      if (ab && timeline) { var a = ab.animationByName(timeline); len = a ? a.duration / a.fps : 0; }
      else if (ab) len = 1;
    } catch (e) { len = 0; }
    if (ab && ab.delete) ab.delete();
    return len;
  }

  /* A scene that cannot play shows its still picture (and whatever it was going to replace). */
  function still(sc) {
    sc.el.classList.add('is-still');
    var hide = sc.el.getAttribute('data-hide'), target = hide && document.querySelector(hide);
    if (target) target.style.visibility = 'visible';
  }

  function make(sc) {
    whenFile(function () {
      var ok = fileState === 'ready' && lengthOf(sc.artboard, sc.scrolled ? sc.scrub : sc.replay) > 0;
      if (!ok) { if (!standin(sc)) still(sc); return; }
      if (sc.scrolled) sc.len = lengthOf(sc.artboard, sc.scrub);
      try {
        sc.r = new rive.Rive({
          riveFile: file, canvas: sc.canvas, artboard: sc.artboard, autoplay: false,
          stateMachine: sc.names.length ? undefined : sc.machine,
          animations: sc.names.length ? (sc.scrolled ? [sc.scrub] : []).concat(sc.names) : undefined,
          layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
          onLoad: function () {
            sc.r.resizeDrawingSurfaceToCanvas();
            sc.loaded = true;
            if (sc.scrolled) { sc.started = true; sc.p = progressOf(sc); sc.r.scrub(sc.scrub, sc.p * sc.len); }
            if (sc.burst) sc.burst();
            /* a timeline with no loop of its own stops when it ends: start it again (sync plays it from the top) */
            if (sc.replay) sc.r.on(rive.EventType.Stop, function () { sync(sc); });
            sync(sc);
          },
          onLoadError: function () { sc.r = null; if (!standin(sc)) still(sc); }
        });
      } catch (e) { sc.r = null; if (!standin(sc)) still(sc); }
    });
  }

  /* Play or pause a scene to match what the visitor can see. A scene shows from the moment it first plays. */
  function sync(sc) {
    if (!sc.loaded) return;
    var run = sc.inView && !document.hidden && sc.started;
    if (run) sc.el.classList.add(sc.video ? 'is-standin' : 'is-live');
    if (sc.video) { syncStandin(sc, run); return; }
    var what = sc.names.length ? sc.names : sc.machine;
    if (what) { if (run) sc.r.play(what); else sc.r.pause(what); }
    if (run && sc.scrolled) wake();
  }

  /* ---- the scroll scenes: 0 to 1 from where the scene sits on the screen, eased ---- */
  function progressOf(sc) {
    var r = sc.el.getBoundingClientRect(), vh = window.innerHeight;
    return Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
  }
  var ticking = false, last = 0;
  function wake() { if (!ticking) { ticking = true; last = 0; requestAnimationFrame(tick); } }
  function tick(now) {
    var dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    var k = 1 - Math.exp(-dt / 0.13), busy = false;
    scenes.forEach(function (sc) {
      if (!sc.scrolled || !sc.loaded || !sc.inView || document.hidden) return;
      busy = true;
      var target = progressOf(sc), was = sc.p;
      sc.p += (target - sc.p) * k;
      if (Math.abs(target - sc.p) < 0.0005) sc.p = target;
      if (sc.video) scrubStandin(sc);
      else if (sc.p !== was) sc.r.scrub(sc.scrub, sc.p * sc.len);
    });
    if (busy) requestAnimationFrame(tick); else ticking = false;
  }

  /* ---- clips that stand in (assets/standin/) ----
     A scene whose artboard the file does not hold yet plays its <video data-standin> instead, started and driven the
     same way. A "view" scene's clip plays while it is on screen: a clip marked loop simply loops; one with
     data-loop-from plays its opening once and then everything after that many seconds on a loop. A "scroll" scene's
     clip is moved to the moment that matches the scene's place, over its first data-scrub-end seconds. If the
     browser will not play a clip (an iPhone in Low Power Mode), the scene's still picture shows instead.
     This part, the calls to it above, and the <video data-standin> elements go when the file holds those scenes. */
  function standin(sc) {
    var v = sc.el.querySelector('video[data-standin]');
    if (!v) return false;
    sc.video = v;
    sc.scrubEnd = parseFloat(v.getAttribute('data-scrub-end')) || 0;
    var src = v.querySelector('source');
    if (src && window.fetch) {   /* held in memory, so it can be moved to any moment whatever the server */
      fetch(src.src).then(function (res) { return res.blob(); }).then(function (blob) { v.src = URL.createObjectURL(blob); v.load(); sync(sc); }).catch(function () {});
    } else { v.preload = 'auto'; v.load(); }
    var loopFrom = parseFloat(v.getAttribute('data-loop-from')) || 0;
    if (!sc.scrolled && !v.loop) {
      /* the opening plays once; from then on the clip goes back to data-loop-from each time it reaches its end */
      v.addEventListener('timeupdate', function () { if (v.duration && v.currentTime > v.duration - 0.06 && !v.paused) v.currentTime = loopFrom; });
      v.addEventListener('ended', function () {
        if (!sc.inView || document.hidden) return;
        v.currentTime = loopFrom;
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      });
    }
    sc.loaded = true;
    if (sc.scrolled) { sc.started = true; sc.p = progressOf(sc); }
    sync(sc);
    return true;
  }
  function syncStandin(sc, run) {
    if (sc.scrolled) { if (run) wake(); else sc.video.pause(); return; }
    if (!run) { sc.video.pause(); return; }
    var p = sc.video.play();
    if (p && p.catch) p.catch(function (err) {
      /* refused, not merely interrupted by a pause: the still takes the clip's place */
      if (err && err.name === 'NotAllowedError') { sc.el.classList.remove('is-standin'); sc.el.classList.add('is-still'); sc.video = null; sc.loaded = false; }
    });
  }
  function scrubStandin(sc) {
    var v = sc.video, t = sc.p * sc.scrubEnd;
    if (v.readyState >= 1 && !v.seeking && Math.abs(v.currentTime - t) > 0.016) v.currentTime = t;
  }

  /* ---- watching ---- */
  scenes.forEach(function (sc) {
    /* made a little before it is needed */
    new IntersectionObserver(function (es) {
      if (es[es.length - 1].isIntersecting && !sc.made) { sc.made = true; make(sc); }
    }, { rootMargin: '400px 0px' }).observe(sc.el);
    new IntersectionObserver(function (es) {
      var e = es[es.length - 1];
      sc.inView = e.isIntersecting;
      if (e.intersectionRatio >= 0.34 && sc.start === 'view') sc.started = true;
      sync(sc);
    }, { threshold: [0, 0.34] }).observe(sc.el);
    if (sc.start === 'load') {
      /* the hero: about a second and a half into the page, or as soon after that as the scene is ready, the phone
         squashes and Ohmie comes out of it */
      sc.burst = function () {
        if (sc.bursting || !sc.due || !sc.loaded) return;
        sc.bursting = true;
        root.classList.add('rv-burst');
        setTimeout(function () { sc.started = true; sync(sc); }, 180);
      };
      setTimeout(function () { sc.due = true; sc.burst(); }, Math.max(0, 1500 - performance.now()));
    }
    if ('ResizeObserver' in window) new ResizeObserver(function () { if (sc.r && sc.loaded) sc.r.resizeDrawingSurfaceToCanvas(); }).observe(sc.el);
  });
  document.addEventListener('visibilitychange', function () { scenes.forEach(sync); });
  window.addEventListener('scroll', function () { if (!ticking && scenes.some(function (sc) { return sc.scrolled && sc.inView && sc.loaded; })) wake(); }, { passive: true });

  /* ---- loading: the runtime, then the file ---- */
  function fail() { settle('failed'); }
  function load() {
    if (typeof rive === 'undefined' || !rive.RiveFile) { fail(); return; }
    if (rive.RuntimeLoader) rive.RuntimeLoader.setWasmUrl('assets/vendor/rive/rive.wasm');
    /* Some scenes play timelines by name: deprecated in the next major runtime, fine in the vendored one. */
    if (rive.Rive) rive.Rive.suppressDeprecationWarnings = ['names-array', 'animation-names', 'animations-param'];
    try {
      file = new rive.RiveFile({ src: FILE,
        onLoad: function () { low = file.getInstance(); settle(low ? 'ready' : 'failed'); },
        onLoadError: fail });
      var p = file.init();
      if (p && p.catch) p.catch(fail);
    } catch (e) { fail(); }
  }
  function inject() {
    var s = document.createElement('script');
    s.src = 'assets/vendor/rive/rive.js';
    s.async = true;
    s.addEventListener('load', load);
    s.addEventListener('error', fail);
    document.head.appendChild(s);
    setTimeout(fail, 15000);   /* neither loaded nor failed after 15 s: the stills take over (settle ignores a late answer) */
  }
  function schedule() {
    if ('requestIdleCallback' in window) window.requestIdleCallback(inject, { timeout: 2000 });
    else window.setTimeout(inject, 500);
  }
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule);
})();
