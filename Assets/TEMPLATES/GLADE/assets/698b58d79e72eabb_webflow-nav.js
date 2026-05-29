// Webflow nav injection — prod (gladia.io) + Vercel preview (*.vercel.app)
// Fetches .navbars HTML via /api/gladia-nav proxy, injects into Shadow DOM
// Shadow DOM isolates Webflow CSS from the page design system
// Add ?wf-nav=1 to force-enable anywhere (e.g. localhost without changing hostname rules)

(function () {
  const host = window.location.hostname;
  const isProduction = host === 'gladia.io' || host === 'www.gladia.io';
  const isVercelPreview = /\.vercel\.app$/i.test(host);
  const isTestMode = new URLSearchParams(window.location.search).get('wf-nav') === '1';
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!isProduction && !isVercelPreview && !isTestMode) return;

  let dompurifyPromise;

  function ensureDOMPurify() {
    if (typeof DOMPurify !== 'undefined') return Promise.resolve();
    if (!dompurifyPromise) {
      dompurifyPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/js/vendor/dompurify.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('DOMPurify failed to load'));
        document.head.appendChild(script);
      });
    }
    return dompurifyPromise;
  }

  // Hide nb-bar immediately — don't wait for fetch
  function hideNbBar() {
    const nbBar = document.querySelector('.nb-bar');
    if (nbBar) nbBar.style.display = 'none';
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideNbBar);
  } else {
    hideNbBar();
  }

  async function loadWebflowNav() {
    try {
      await ensureDOMPurify();
      console.log('[webflow-nav] fetching /api/gladia-nav...');
      const res = await fetch('/api/gladia-nav');
      if (!res.ok) { console.warn('[webflow-nav] API error:', res.status); return; }
      const { html, css = '', error } = await res.json();
      if (error) { console.warn('[webflow-nav] API returned error:', error); return; }
      if (!html) { console.warn('[webflow-nav] No HTML returned'); return; }
      console.log('[webflow-nav] nav HTML received, css:', css.length, 'chars');

      // Shadow DOM host — fixed, full-width, above everything
      const host = document.createElement('div');
      host.id = 'wf-nav-host';
      host.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;pointer-events:auto;';
      document.body.prepend(host);

      const shadow = host.attachShadow({ mode: 'open' });

      // All CSS inlined — fully isolated from the page design system
      // :root → :host: shadow DOM has no document root, CSS vars must be scoped to :host
      const shadowCss = css.replace(/:root\b/g, ':host');
      // Security: sanitize Webflow HTML with DOMPurify before injection
      const safeHtml = DOMPurify.sanitize(html, { FORCE_BODY: true, ADD_ATTR: ['style', 'class', 'href', 'target', 'rel', 'src', 'alt', 'aria-expanded', 'aria-label', 'data-wf-page', 'data-wf-site'] });
      // Use DOMParser instead of innerHTML to avoid shadow root XSS (Snyk CWE-79)
      const styleEl = document.createElement('style');
      styleEl.textContent = shadowCss;
      shadow.appendChild(styleEl);
      if (!prefersReducedMotion) {
        const motionStyleEl = document.createElement('style');
        motionStyleEl.textContent = '@keyframes wf-nav-fade-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}';
        shadow.appendChild(motionStyleEl);
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(safeHtml, 'text/html');
      doc.querySelectorAll('.navbar_shadow-dark').forEach((el) => el.remove());
      const frag = document.createDocumentFragment();
      Array.from(doc.body.childNodes).forEach((n) => frag.appendChild(document.importNode(n, true)));
      shadow.appendChild(frag);
      if (!prefersReducedMotion) {
        const navRoot = shadow.querySelector('.navbars');
        if (navRoot) navRoot.style.animation = 'wf-nav-fade-in 280ms cubic-bezier(0.16, 1, 0.3, 1) both';
      }
      console.log('[webflow-nav] Shadow DOM injected');

      // Re-implement Webflow dropdown hover (Webflow JS won't work inside Shadow DOM)
      shadow.addEventListener('DOMContentLoaded', initDropdowns);
      // CSS links may not be loaded yet — wait for them
      const links = shadow.querySelectorAll('link[rel="stylesheet"]');
      let loaded = 0;
      if (links.length === 0) {
        initDropdowns();
      } else {
        links.forEach(link => {
          link.addEventListener('load', () => { if (++loaded === links.length) initDropdowns(); });
          link.addEventListener('error', () => { if (++loaded === links.length) initDropdowns(); });
        });
      }

      function initDropdowns() {
        shadow.querySelectorAll('.w-dropdown').forEach(dropdown => {
          const toggle = dropdown.querySelector('.w-dropdown-toggle');
          const list = dropdown.querySelector('.w-dropdown-list');
          if (!toggle || !list) return;

          let closeTimer;

          dropdown.addEventListener('mouseenter', () => {
            clearTimeout(closeTimer);
            list.classList.add('w--open');
            toggle.classList.add('w--open');
            toggle.setAttribute('aria-expanded', 'true');
            if (!prefersReducedMotion) {
              list.animate(
                [
                  { opacity: 0, transform: 'translateY(-8px)' },
                  { opacity: 1, transform: 'translateY(0)' },
                ],
                {
                  duration: 180,
                  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                }
              );
            }
          });

          dropdown.addEventListener('mouseleave', () => {
            closeTimer = setTimeout(() => {
              list.classList.remove('w--open');
              toggle.classList.remove('w--open');
              toggle.setAttribute('aria-expanded', 'false');
            }, 100);
          });
        });
      }
    } catch (e) {
      console.warn('[webflow-nav] Failed to load:', e.message);
    }
  }

  function scheduleLoadWebflowNav() {
    const run = () => { loadWebflowNav(); };
    if ('requestIdleCallback' in window) {
      requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleLoadWebflowNav);
  } else {
    scheduleLoadWebflowNav();
  }
})();
