/* HAPPI-EL CONSULTING — mesure publicitaire (Meta Pixel, Google Ads, LinkedIn Insight Tag).
   Chargée sur toutes les pages. Règles :
   1. Rien n'est exécuté sans l'accord explicite du visiteur (même clé que la bannière de la page d'accueil).
   2. Chaque page sans bannière en reçoit une (première visite), plus un lien « Gérer la mesure publicitaire »
      en bas de page pour changer d'avis à tout moment.
   3. Pages liées aux cliniques et à la santé : ni Meta ni Google Ads (règles de ces plateformes sur la santé) ;
      seule la balise LinkedIn (mesure professionnelle) peut s'y charger, après accord. */
(function () {
  'use strict';
  var KEY = 'hec_meta_tracking_consent';
  var PIXEL_ID = '1072898865555552';
  var GOOGLE_ADS_ID = 'AW-18421055573';
  var LINKEDIN_PARTNER_ID = '11122153';
  var HEALTH_PAGE = /(careflow|clinique|sante|medical|patient)/i.test(location.pathname);

  function choice() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function saveChoice(v) {
    try { localStorage.setItem(KEY, v); } catch (e) { /* navigation privée stricte : choix non mémorisé */ }
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

  // Page d'accueil : ses chargeurs Meta et Google Ads (scripts intégrés) sont conservés ; on les prolonge
  // pour que l'acceptation de la bannière charge aussi LinkedIn. Ailleurs, on fournit les nôtres.
  var baseLoadMeta = typeof window.hecLoadMetaPixel === 'function' ? window.hecLoadMetaPixel : loadMeta;
  window.hecLoadMetaPixel = function () {
    if (!HEALTH_PAGE) baseLoadMeta.apply(this, arguments);
    loadLinkedIn();
  };
  if (typeof window.hecLoadGoogleAds !== 'function') window.hecLoadGoogleAds = loadGoogleAds;
  window.hecLoadLinkedIn = loadLinkedIn;

  function loadAll() {
    window.hecLoadMetaPixel();
    window.hecLoadGoogleAds();
  }

  if (choice() === 'accepted') loadAll();

  // La page d'accueil a déjà sa bannière, son bouton et le suivi des clics WhatsApp : rien à ajouter.
  if (document.getElementById('tracking-consent')) return;

  function buildBanner() {
    var who = HEALTH_PAGE
      ? 'Avec votre accord, LinkedIn peut mesurer les visites liées à nos campagnes. Sur cette page consacrée aux cliniques, Meta et Google Ads ne sont jamais chargés.'
      : 'Avec votre accord, Meta, Google Ads et LinkedIn peuvent mesurer les visites et actions liées à nos campagnes.';
    var box = document.createElement('aside');
    box.id = 'hec-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-labelledby', 'hec-consent-title');
    box.setAttribute('aria-describedby', 'hec-consent-copy');
    box.style.cssText = 'position:fixed;z-index:9999;left:12px;right:12px;bottom:12px;max-width:720px;margin:0 auto;' +
      'background:#071a18;color:#f9f6ef;border:1px solid #52665e;box-shadow:0 18px 50px rgba(0,0,0,.3);padding:18px 20px;' +
      'font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-height:80vh;overflow:auto;display:none';
    box.innerHTML =
      '<p id="hec-consent-title" style="margin:0 0 6px;font-weight:700;font-size:17px">Mesure publicitaire</p>' +
      '<p id="hec-consent-copy" style="margin:0;color:#c7d1cc;font-size:14px">' + who +
      ' Refuser ne bloque aucune fonction du site. Vous pouvez modifier votre choix à tout moment ' +
      '(<a href="/politique-confidentialite" style="color:#f9f6ef">politique de confidentialité</a>).</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px">' +
      '<button type="button" id="hec-consent-accept" style="cursor:pointer;padding:10px 16px;border:0;background:#f9f6ef;color:#071a18;font:inherit;font-weight:700">Accepter la mesure</button>' +
      '<button type="button" id="hec-consent-refuse" style="cursor:pointer;padding:10px 16px;border:1px solid #8d9d96;background:transparent;color:#f9f6ef;font:inherit">Continuer sans mesure</button>' +
      '</div>';
    document.body.appendChild(box);
    document.getElementById('hec-consent-accept').addEventListener('click', function () {
      saveChoice('accepted'); loadAll(); box.style.display = 'none';
    });
    document.getElementById('hec-consent-refuse').addEventListener('click', function () {
      saveChoice('refused'); box.style.display = 'none';
      // Des scripts déjà chargés ne se déchargent pas : on recharge la page pour les retirer.
      if (window.__hecMetaLoaded || window.__hecGoogleLoaded || window.__hecLinkedInLoaded) location.reload();
    });
    return box;
  }

  function init() {
    var box = buildBanner();
    var open = function () { box.style.display = 'block'; document.getElementById('hec-consent-accept').focus(); };
    // Lien discret en bas de page pour changer d'avis.
    var p = document.createElement('p');
    p.style.cssText = 'text-align:center;margin:12px 0 18px;font-size:13px';
    var link = document.createElement('button');
    link.type = 'button';
    link.textContent = 'Gérer la mesure publicitaire';
    link.style.cssText = 'cursor:pointer;background:none;border:0;padding:0;color:inherit;text-decoration:underline;font:inherit';
    link.addEventListener('click', open);
    p.appendChild(link);
    document.body.appendChild(p);
    if (!choice()) open();
    // Clic sur WhatsApp = « Contact » pour Meta (jamais sur les pages santé, où Meta n'est pas chargé).
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="https://wa.me/237693207431"]');
      if (a && !HEALTH_PAGE && choice() === 'accepted' && typeof window.fbq === 'function') window.fbq('track', 'Contact');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
