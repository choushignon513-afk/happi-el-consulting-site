/* HAPPI-EL CONSULTING — mesure publicitaire (Meta Pixel + LinkedIn Insight Tag).
   Chargée sur toutes les pages. Rien n'est exécuté sans l'accord explicite du visiteur
   (clé de consentement partagée avec la bannière de la page d'accueil). */
(function () {
  'use strict';
  var KEY = 'hec_meta_tracking_consent';
  var PIXEL_ID = '1072898865555552';
  var LINKEDIN_PARTNER_ID = '11122153';

  function consented() {
    try { return localStorage.getItem(KEY) === 'accepted'; } catch (e) { return false; }
  }

  function loadMeta() {
    if (window.__hecMetaLoaded) return;
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

  // Sur la page d'accueil, le chargeur Meta existe déjà (script inline) : on le prolonge
  // pour que l'acceptation de la bannière charge aussi LinkedIn. Ailleurs, on fournit le nôtre.
  var baseLoadMeta = typeof window.hecLoadMetaPixel === 'function' ? window.hecLoadMetaPixel : loadMeta;
  window.hecLoadMetaPixel = function () {
    baseLoadMeta.apply(this, arguments);
    loadLinkedIn();
  };
  window.hecLoadLinkedIn = loadLinkedIn;

  if (consented()) window.hecLoadMetaPixel();
})();
