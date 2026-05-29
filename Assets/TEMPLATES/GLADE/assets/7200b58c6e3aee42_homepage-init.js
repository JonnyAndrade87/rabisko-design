/* Hero headline + sub — line-by-line blur-in reveal.
   Headline split on <br>; sub uses static .hero-line spans from HTML (no layout measure). */
(function () {
  if (window.__heroSplitDone) return;
  var headline = document.querySelector('.homepage-v3 .hero-headline');
  var sub = document.querySelector('.homepage-v3 .hero-sub');
  if (!headline || !sub) return;

  function splitHeadline(el) {
    var parts = el.innerHTML.split(/<br\s*\/?>/i)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    el.innerHTML = parts.map(function (p, i) {
      return '<span class="hero-line" style="--i:' + i + '">' + p + '</span>';
    }).join('');
  }

  function run() {
    splitHeadline(headline);
    headline.classList.add('is-split');
    sub.classList.add('is-split');
    requestAnimationFrame(function () {
      var lines = document.querySelectorAll(
        '.homepage-v3 .hero-headline .hero-line, .homepage-v3 .hero-sub .hero-line'
      );
      lines.forEach(function (l) { l.classList.add('is-in'); });
      window.__heroSplitDone = true;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();

/* Hero counter — animate to 2B+ transcription minutes */
(function () {
  var el = document.getElementById('heroCounter');
  if (!el) return;
  var target = 2147000000;
  var duration = 2200;
  var started = false;

  function formatNum(n) {
    return n.toLocaleString('en-US');
  }

  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function animate(startTime) {
    var now = performance.now();
    var progress = Math.min((now - startTime) / duration, 1);
    var value = Math.floor(easeOutExpo(progress) * target);
    el.textContent = formatNum(value);
    if (progress < 1) requestAnimationFrame(function () { animate(startTime); });
  }

  var obs = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting && !started) {
      started = true;
      animate(performance.now());
      obs.disconnect();
    }
  }, { threshold: 0.5 });
  obs.observe(el);

  /* Slow tick after initial animation — adds ~1000/sec to feel alive */
  setTimeout(function tick() {
    if (!started) { setTimeout(tick, 500); return; }
    target += Math.floor(Math.random() * 800 + 600);
    el.textContent = formatNum(target);
    setTimeout(tick, 1000);
  }, duration + 400);
})();

/* Scroll reveal — reuse DS .reveal / .is-visible pattern.
   Elements inside the hero (logo-strip) are handled by a separate
   observer with a stricter trigger so they only fade in after a
   real scroll, never at page load even if partially in view. */
const heroReveals = document.querySelectorAll('.hero-section .reveal');
const heroSkip = new Set(heroReveals);
const revealEls = Array.from(document.querySelectorAll('.reveal')).filter(el => !heroSkip.has(el));
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); revealObs.unobserve(e.target); } });
}, { threshold: 0.15 });
revealEls.forEach(el => revealObs.observe(el));

/* Hero reveals — desktop: wait for a small scroll so the fade feels tied
   to scrolling (not first paint). Mobile: show as soon as in view; on narrow
   viewports the band is often already visible at scrollY=0, and the old
   global scrollY check + IO meant is-visible could never be applied. */
if (heroReveals.length) {
  const mqlDesktop = window.matchMedia('(min-width: 769px)');
  function needsScrollNudge() {
    return mqlDesktop.matches;
  }
  const heroRevealObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      if (needsScrollNudge() && window.scrollY < 40) return;
      e.target.classList.add('is-visible');
      heroRevealObs.unobserve(e.target);
    });
  }, { threshold: 0.4, rootMargin: '0px 0px -15% 0px' });
  let heroRevealScrollRaf = 0;
  function tryDesktopHeroRevealsAfterScroll() {
    if (heroRevealScrollRaf) return;
    heroRevealScrollRaf = requestAnimationFrame(function () {
      heroRevealScrollRaf = 0;
      if (!needsScrollNudge() || window.scrollY < 40) return;
      const vh = window.innerHeight;
      heroReveals.forEach((el) => {
        if (el.classList.contains('is-visible')) return;
        const r = el.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) {
          el.classList.add('is-visible');
          try { heroRevealObs.unobserve(el); } catch (_) { /* already unobserved */ }
        }
      });
    });
  }
  heroReveals.forEach((el) => heroRevealObs.observe(el));
  window.addEventListener('scroll', tryDesktopHeroRevealsAfterScroll, { passive: true });
  tryDesktopHeroRevealsAfterScroll();
}
/* ── Hero ambiance — mutable state read by canvas render ── */
window._heroAmb = {
  hR: 140, hG: 40, hB: 255,
  tR: 140, tG: 40, tB: 255,
  dotSpeed: 1, tDotSpeed: 1,
  angleOff: Math.PI / 4, tAngleOff: Math.PI / 4,
  dotAccum: 0, lastT: Date.now() / 1000
};

/* Stats Tabs — indicator + hero ambiance */
(function () {
  var root = document.getElementById('statsTabs');
  if (!root) return;

  var nav       = root.querySelector('.stats-tabs__nav');
  var tabs      = root.querySelectorAll('.stats-tabs__tab');
  var indicator = root.querySelector('.stats-tabs__indicator');
  var amb       = window._heroAmb;
  var MOODS = [
    { r: 140, g: 40,  b: 255, dotSpeed: 1,   angleOff: Math.PI / 4 },
    { r: 255, g: 120, b: 20,  dotSpeed: 2.5, angleOff: Math.PI / 4 + 0.35 },
    { r: 20,  g: 140, b: 255, dotSpeed: 2.0, angleOff: Math.PI / 4 + 0.7 }
  ];

  function activate(idx) {
    tabs.forEach(function (t, i) { t.classList.toggle('is-active', i === idx); });
    schedulePositionIndicator(idx);
    applyMood(idx);
  }

  function applyMood(idx) {
    var m = MOODS[idx];
    if (!m) return;
    amb.tR = m.r; amb.tG = m.g; amb.tB = m.b;
    amb.tDotSpeed = m.dotSpeed;
    amb.tAngleOff = m.angleOff;
  }

  function positionIndicator(idx) {
    var tab = tabs[idx];
    if (!tab || !indicator) return;
    var navRect = nav.getBoundingClientRect();
    var tabRect = tab.getBoundingClientRect();
    indicator.style.width     = tabRect.width + 'px';
    indicator.style.transform = 'translateX(' + (tabRect.left - navRect.left) + 'px)';
  }

  var indicatorRaf = 0;
  function schedulePositionIndicator(idx) {
    if (indicatorRaf) cancelAnimationFrame(indicatorRaf);
    indicatorRaf = requestAnimationFrame(function () {
      indicatorRaf = 0;
      positionIndicator(idx);
    });
  }

  /* --- Auto-rotate driven by canvas spin step --- */
  var current = 0;
  var paused = false;

  function restartReveal() {
    tabs.forEach(function (tab) {
      var reveal = tab.querySelector('.stats-tabs__value-reveal');
      if (!reveal) return;
      reveal.classList.remove('is-paused');
      reveal.style.animation = 'none';
      requestAnimationFrame(function () {
        reveal.style.animation = '';
      });
    });
  }

  function pauseReveal() {
    tabs.forEach(function (tab) {
      var reveal = tab.querySelector('.stats-tabs__value-reveal');
      if (reveal) reveal.classList.add('is-paused');
    });
  }

  window._onSpinStep = function () {
    if (paused) return;
    current = (current + 1) % tabs.length;
    activate(current);
    restartReveal();
  };

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () {
      current = i;
      activate(i);
      restartReveal();
    });
    tab.addEventListener('mouseenter', function () { schedulePositionIndicator(i); });
  });

  nav.addEventListener('mouseenter', function () {
    paused = true;
    pauseReveal();
  });
  nav.addEventListener('mouseleave', function () {
    paused = false;
    var a = root.querySelector('.stats-tabs__tab.is-active');
    if (a) schedulePositionIndicator(parseInt(a.dataset.tab));
    restartReveal();
  });

  schedulePositionIndicator(0);
  activate(0);
  restartReveal();
})();

/* Hero canvas — defer until fonts + idle so LCP (headline) paints first */
(function () {
  function loadHeroCanvas() {
    if (window.__heroCanvasLoaded) return;
    window.__heroCanvasLoaded = true;
    var s = document.createElement('script');
    s.src = '/js/hero-canvas.js';
    s.async = true;
    document.body.appendChild(s);
  }

  function scheduleHeroCanvas() {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadHeroCanvas, { timeout: 3000 });
    } else {
      setTimeout(loadHeroCanvas, 200);
    }
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleHeroCanvas).catch(scheduleHeroCanvas);
  } else if (document.readyState === 'complete') {
    scheduleHeroCanvas();
  } else {
    window.addEventListener('load', scheduleHeroCanvas, { once: true });
  }
})();
