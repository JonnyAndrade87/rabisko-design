/**
 * ============================================================
 * ELEPHILL — TRACKING TEMPLATE v1.0
 * Cliente: RABISKO
 * Fase 1: Instagram Insights (via Windsor.ai)
 * Fase 2: Meta Ads + conversões (quando iniciar campanhas)
 * ============================================================
 *
 * INSTRUÇÕES DE USO:
 * 1. Substitua os valores de CONFIG com os dados reais do cliente
 * 2. Ative/desative módulos conforme a fase do cliente
 * 3. Valide com Windsor.ai Event Debugger antes de ir ao ar
 * ============================================================
 */

;(function () {
  'use strict';

  // ============================================================
  // CONFIG — alterar por cliente
  // ============================================================
  const CONFIG = {
    cliente:        'RABISKO',
    fase:           1,                        // 1 = Instagram only | 2 = Meta Ads ativo

    // Meta / Facebook Pixel
    // ⚠️ Substituir pelo Pixel ID real após criar conta Business da Rabisko
    metaPixelId:    'SEU_PIXEL_ID_AQUI',
    metaPixelAtivo: false,                    // Ativar na Fase 2

    // Google Analytics 4
    // ⚠️ Substituir pelo Measurement ID do GA4
    ga4Id:          'G-XXXXXXXXXX',
    ga4Ativo:       false,                    // Ativar quando criar conta GA4

    // Windsor.ai Data Layer
    windsorAtivo:   true,                     // Sempre ativo
    windsorSiteId:  'RABISKO-001',            // ID interno Elephill

    // Debug mode — desativar em produção
    debug:          false,
  };

  // ============================================================
  // UTILS
  // ============================================================
  function log(...args) {
    if (CONFIG.debug) console.log('[Elephill Tracking]', ...args);
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function getUTMParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source:   params.get('utm_source')   || getCookie('utm_source')   || '(direct)',
      utm_medium:   params.get('utm_medium')   || getCookie('utm_medium')   || '(none)',
      utm_campaign: params.get('utm_campaign') || getCookie('utm_campaign') || '(none)',
      utm_content:  params.get('utm_content')  || getCookie('utm_content')  || '(none)',
      utm_term:     params.get('utm_term')     || getCookie('utm_term')     || '(none)',
    };
  }

  // Persiste UTMs em cookie por 30 dias (primeira sessão ganha)
  function persistUTMs() {
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    utmKeys.forEach(key => {
      if (params.get(key) && !getCookie(key)) {
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
        document.cookie = `${key}=${encodeURIComponent(params.get(key))}; expires=${expires}; path=/; SameSite=Lax`;
      }
    });
  }

  // ============================================================
  // DATA LAYER — base Windsor.ai
  // ============================================================
  window.dataLayer = window.dataLayer || [];

  function pushEvent(eventName, eventData = {}) {
    const utms = getUTMParams();
    const payload = {
      event:            eventName,
      timestamp:        new Date().toISOString(),
      cliente:          CONFIG.cliente,
      windsor_site_id:  CONFIG.windsorSiteId,
      page_url:         window.location.href,
      page_title:       document.title,
      referrer:         document.referrer || '(none)',
      ...utms,
      ...eventData,
    };

    window.dataLayer.push(payload);
    log('Event pushed:', payload);

    // Espelha para gtag se GA4 ativo
    if (CONFIG.ga4Ativo && typeof gtag === 'function') {
      gtag('event', eventName, eventData);
    }

    // Espelha para fbq se Meta Pixel ativo
    if (CONFIG.metaPixelAtivo && typeof fbq === 'function') {
      if (eventName === 'page_view')       fbq('track', 'PageView');
      if (eventName === 'lead')            fbq('track', 'Lead');
      if (eventName === 'contact')         fbq('track', 'Contact');
      if (eventName === 'initiate_checkout') fbq('track', 'InitiateCheckout');
    }
  }

  // ============================================================
  // META PIXEL — Fase 2
  // ============================================================
  function initMetaPixel() {
    if (!CONFIG.metaPixelAtivo) { log('Meta Pixel desativado (Fase 1)'); return; }

    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');

    fbq('init', CONFIG.metaPixelId);
    fbq('track', 'PageView');
    log('Meta Pixel iniciado:', CONFIG.metaPixelId);
  }

  // ============================================================
  // GA4 — Fase 2
  // ============================================================
  function initGA4() {
    if (!CONFIG.ga4Ativo) { log('GA4 desativado (Fase 1)'); return; }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${CONFIG.ga4Id}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', CONFIG.ga4Id, {
      send_page_view: true,
      cookie_domain:  'auto',
    });
    log('GA4 iniciado:', CONFIG.ga4Id);
  }

  // ============================================================
  // EVENTOS AUTOMÁTICOS
  // ============================================================

  // 1. Page View
  function trackPageView() {
    pushEvent('page_view', {
      page_path: window.location.pathname,
    });
  }

  // 2. Scroll Depth
  function trackScrollDepth() {
    const milestones = [25, 50, 75, 90];
    const reached = new Set();

    window.addEventListener('scroll', function () {
      const scrolled = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );
      milestones.forEach(m => {
        if (scrolled >= m && !reached.has(m)) {
          reached.add(m);
          pushEvent('scroll_depth', { depth_percent: m });
        }
      });
    }, { passive: true });
  }

  // 3. Cliques em WhatsApp
  function trackWhatsAppClicks() {
    document.addEventListener('click', function (e) {
      const link = e.target.closest('a[href*="wa.me"], a[href*="whatsapp"]');
      if (!link) return;
      pushEvent('click_whatsapp', {
        label:    link.innerText?.trim() || 'WhatsApp CTA',
        href:     link.href,
        section:  link.closest('[data-section]')?.dataset.section || 'unknown',
      });
    });
  }

  // 4. Cliques em CTAs (botões principais)
  function trackCTAClicks() {
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-track-cta]');
      if (!btn) return;
      pushEvent('cta_click', {
        label:   btn.dataset.trackCta,
        section: btn.closest('[data-section]')?.dataset.section || 'unknown',
      });
    });
  }

  // 5. Formulários (Lead)
  function trackFormSubmits() {
    document.addEventListener('submit', function (e) {
      const form = e.target;
      if (!form.matches('form')) return;

      pushEvent('lead', {
        form_id:   form.id || 'unknown_form',
        form_name: form.dataset.formName || form.id || 'contact_form',
      });
    });
  }

  // 6. Tempo na página
  function trackTimeOnPage() {
    const milestones = [30, 60, 120, 300]; // segundos
    milestones.forEach(seconds => {
      setTimeout(() => {
        pushEvent('time_on_page', { seconds_spent: seconds });
      }, seconds * 1000);
    });
  }

  // 7. Exit intent
  function trackExitIntent() {
    let fired = false;
    document.addEventListener('mouseleave', function (e) {
      if (e.clientY <= 0 && !fired) {
        fired = true;
        pushEvent('exit_intent', { exit_page: window.location.pathname });
      }
    });
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    persistUTMs();
    initMetaPixel();
    initGA4();
    trackPageView();
    trackScrollDepth();
    trackWhatsAppClicks();
    trackCTAClicks();
    trackFormSubmits();
    trackTimeOnPage();
    trackExitIntent();

    log('✅ Tracking iniciado — Cliente:', CONFIG.cliente, '| Fase:', CONFIG.fase);
    log('📊 Windsor.ai dataLayer disponível em window.dataLayer');
  }

  // Aguarda DOM pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
