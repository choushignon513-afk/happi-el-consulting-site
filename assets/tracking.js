/* HAPPI-EL CONSULTING — mesure d'audience et publicitaire (Google Analytics 4, Meta Pixel, Google Ads, LinkedIn Insight Tag).
   Chargée sur toutes les pages. Règles :
   1. Rien n'est exécuté sans l'accord explicite du visiteur (même clé que la bannière de la page d'accueil).
   2. Chaque page sans bannière en reçoit une (première visite), plus un lien « Gérer la mesure publicitaire »
      en bas de page pour changer d'avis à tout moment.
   3. Pages liées aux cliniques et à la santé : ni Meta, ni Google Ads, ni Google Analytics (règles de ces plateformes sur la santé) ;
      seule la balise LinkedIn (mesure professionnelle) peut s'y charger, après accord. */
(function () {
  'use strict';
  var KEY = 'hec_meta_tracking_consent';
  var PIXEL_ID = '1072898865555552';
  var GOOGLE_ADS_ID = 'AW-18421055573';
  var GA4_ID = 'G-9GGM64PFHM'; // propriété « www.happi-el-consulting.com », flux web du site
  var LINKEDIN_PARTNER_ID = '11122153';
  var HEALTH_PAGE = /(careflow|clinique|sante|medical|patient)/i.test(location.pathname);

  var sessionChoice;
  function choice() {
    if (sessionChoice) return sessionChoice;
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function saveChoice(v) {
    sessionChoice = v;
    try { localStorage.setItem(KEY, v); return true; } catch (e) { return false; }
  }

  function loadMeta() {
    if (HEALTH_PAGE || window.__hecMetaLoaded) return;
    window.__hecMetaLoaded = true;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/fr_FR/fbevents.js');
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
  }

  function loadGoogleAds() {
    if (HEALTH_PAGE || window.__hecGoogleLoaded) return;
    window.__hecGoogleLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    var tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + GOOGLE_ADS_ID;
    document.head.appendChild(tag);
    window.gtag('js', new Date());
    window.gtag('config', GOOGLE_ADS_ID);
    // Google Analytics 4 : IP non conservée par GA4 ; pas de signaux Google (publicité personnalisée).
    window.gtag('config', GA4_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  }

  function loadLinkedIn() {
    if (window.__hecLinkedInLoaded) return;
    window.__hecLinkedInLoaded = true;
    window._linkedin_partner_id = LINKEDIN_PARTNER_ID;
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(window._linkedin_partner_id);
    (function (l) {
      if (!l) {
        window.lintrk = function (a, b) { window.lintrk.q.push([a, b]); };
        window.lintrk.q = [];
      }
      var s = document.getElementsByTagName('script')[0];
      var b = document.createElement('script');
      b.type = 'text/javascript'; b.async = true;
      b.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
      s.parentNode.insertBefore(b, s);
    })(window.lintrk);
  }

  function loadAll() {
    loadMeta();
    loadGoogleAds();
    loadLinkedIn();
  }

  // Conversions Google Ads (jamais sur les pages santé, jamais sans accord).
  var GOOGLE_CONVERSIONS = {
    lead: 'AW-18421055573/KxXWCKXB36IdENWA7M9E',      // Diagnostic envoyé (site)
    whatsapp: 'AW-18421055573/EsO0COT-4KIdENWA7M9E'   // Clic WhatsApp (site)
  };
  // Meta : évènement standard « Lead » pour une vraie demande enregistrée (mêmes garde-fous que Google).
  function metaLead() {
    if (HEALTH_PAGE || choice() !== 'accepted' || typeof window.fbq !== 'function') return;
    window.fbq('track', 'Lead');
  }

  // Google Analytics 4 : évènements sans donnée personnelle (ni nom, ni e-mail, ni téléphone).
  function gaEvent(name, params) {
    if (HEALTH_PAGE || choice() !== 'accepted' || typeof window.gtag !== 'function') return;
    window.gtag('event', name, params || {});
  }

  function googleConversion(sendTo) {
    if (HEALTH_PAGE || choice() !== 'accepted' || typeof window.gtag !== 'function') return;
    window.gtag('event', 'conversion', { send_to: sendTo, transport_type: 'beacon' });
  }

  // Formulaires : la conversion n'est comptée que si le serveur confirme l'enregistrement ({ ok: true }).
  if (typeof window.fetch === 'function' && !window.__hecFetchWrapped) {
    window.__hecFetchWrapped = true;
    var nativeFetch = window.fetch;
    window.fetch = function (input, init) {
      var request = nativeFetch.apply(this, arguments);
      try {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        if (method === 'POST' && /\/api\/leads(?:[?#]|$)/.test(url)) {
          request.then(function (response) {
            if (!response || !response.ok) return;
            return response.clone().json().then(function (body) {
              // Un reçu CRM confirmé contient une référence. Le piège anti-robots n'en renvoie pas.
              if (body && body.ok === true && typeof body.reference === 'string' &&
                  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.reference)) {
                googleConversion(GOOGLE_CONVERSIONS.lead);
                gaEvent('generate_lead', { lead_source: 'formulaire_site' });
                metaLead();
              }
            }, function () {});
          }).catch(function () {});
        }
      } catch (e) { /* ne jamais bloquer l'envoi du formulaire */ }
      return request;
    };
  }

  // Un seul écouteur par clic, sur toutes les pages.
  document.addEventListener('click', function (e) {
    var link = e.target && e.target.closest && e.target.closest('a[href^="https://wa.me/237693207431"]');
    if (!link) return;
    googleConversion(GOOGLE_CONVERSIONS.whatsapp);
    gaEvent('contact_whatsapp', { link_location: location.pathname });
    if (!HEALTH_PAGE && choice() === 'accepted' && typeof window.fbq === 'function') window.fbq('track', 'Contact');
  });

  // Google Analytics 4 : clic vers la démonstration transit (angles A/B des messages, distingués par utm_content).
  document.addEventListener('click', function (e) {
    var demo = e.target && e.target.closest && e.target.closest('a[href*="#demonstration"]');
    if (demo) gaEvent('clic_demo', { link_location: location.pathname });
  });

  // Google Analytics 4 : premier contact avec le score /20 (début du diagnostic), une seule fois par page.
  var diagStarted = false;
  document.addEventListener('change', function (e) {
    if (diagStarted || !e.target || !e.target.closest || !e.target.closest('#qualification-form')) return;
    diagStarted = true;
    gaEvent('debut_diagnostic', { link_location: location.pathname });
  });

  function buildBanner() {
    var who = HEALTH_PAGE
      ? 'Avec votre accord, LinkedIn peut mesurer les visites liées à nos campagnes. Sur cette page consacrée aux cliniques, Meta, Google Ads et Google Analytics ne sont jamais chargés.'
      : 'Avec votre accord, Google Analytics mesure la fréquentation du site, et Meta, Google Ads et LinkedIn mesurent les visites et actions liées à nos campagnes.';
    var box = document.createElement('aside');
    box.id = 'hec-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-labelledby', 'hec-consent-title');
    box.setAttribute('aria-describedby', 'hec-consent-copy');
    box.style.cssText = 'position:fixed;z-index:9999;left:12px;right:12px;bottom:12px;max-width:720px;margin:0 auto;' +
      'background:#071a18;color:#f9f6ef;border:1px solid #52665e;box-shadow:0 18px 50px rgba(0,0,0,.3);padding:18px 20px;' +
      'font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-height:80vh;overflow:auto;display:none';
    box.innerHTML =
      '<p id="hec-consent-title" style="margin:0 0 6px;font-weight:700;font-size:17px">Mesure d\'audience et publicitaire</p>' +
      '<p id="hec-consent-copy" style="margin:0;color:#c7d1cc;font-size:14px">' + who +
      ' Refuser ne bloque aucune fonction du site. Vous pouvez modifier votre choix à tout moment ' +
      '(<a href="/politique-confidentialite" style="color:#f9f6ef">politique de confidentialité</a>).</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px">' +
      '<button type="button" id="hec-consent-accept" style="cursor:pointer;padding:10px 16px;border:0;background:#f9f6ef;color:#071a18;font:inherit;font-weight:700">Accepter la mesure</button>' +
      '<button type="button" id="hec-consent-refuse" style="cursor:pointer;padding:10px 16px;border:1px solid #8d9d96;background:transparent;color:#f9f6ef;font:inherit">Continuer sans mesure</button>' +
      '</div>';
    document.body.appendChild(box);
    return box;
  }

  function init() {
    var homePanel = document.getElementById('tracking-consent');
    var box = homePanel || buildBanner();
    var accept = document.getElementById(homePanel ? 'tracking-accept' : 'hec-consent-accept');
    var refuse = document.getElementById(homePanel ? 'tracking-refuse' : 'hec-consent-refuse');
    var trigger;
    function show(visible) {
      if (homePanel) box.classList.toggle('visible', visible);
      else box.style.display = visible ? 'block' : 'none';
    }
    function open(event) {
      trigger = event.currentTarget;
      show(true);
      accept.focus({ preventScroll: true });
    }
    function close() {
      show(false);
      if (trigger) trigger.focus({ preventScroll: true });
      trigger = null;
    }
    accept.addEventListener('click', function () {
      saveChoice('accepted');
      loadAll();
      close();
    });
    refuse.addEventListener('click', function () {
      var persisted = saveChoice('refused');
      close();
      // Recharger retire les scripts qui ont été chargés avant le retrait.
      if (persisted && (window.__hecMetaLoaded || window.__hecGoogleLoaded || window.__hecLinkedInLoaded)) location.reload();
    });

    if (homePanel) {
      document.querySelectorAll('#tracking-settings, #footer-tracking-settings').forEach(function (button) {
        button.addEventListener('click', open);
      });
    } else {
      var p = document.createElement('p');
      p.style.cssText = 'text-align:center;margin:12px 0 18px;font-size:13px';
      var link = document.createElement('button');
      link.type = 'button';
      link.textContent = 'Gérer la mesure d\'audience et publicitaire';
      link.style.cssText = 'cursor:pointer;background:none;border:0;padding:0;color:inherit;text-decoration:underline;font:inherit';
      link.addEventListener('click', open);
      p.appendChild(link);
      document.body.appendChild(p);
    }
    if (choice() === 'accepted') loadAll();
    else if (choice() !== 'refused') show(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
