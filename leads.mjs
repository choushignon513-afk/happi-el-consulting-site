// HAPPI-EL CONSULTING — réception des leads du diagnostic /20
// Règle : score > 8/20 => contact qualifié dans HubSpot + notification WhatsApp immédiate.
//         score <= 8/20 => contact créé aussi, mais étiqueté "à nourrir", sans notification.
// Variables d'environnement requises : HUBSPOT_TOKEN (Private App, scope crm.objects.contacts.write)
// Aucune propriété personnalisée n'est nécessaire : tout est stocké dans des champs standards
// (industry, message, lifecyclestage, hs_lead_status), disponibles sur tous les comptes HubSpot.

const SEUIL_QUALIFICATION = 8;
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
// CRM interne HAPPI-EL OS (os.happi-el-consulting.com) : chaque prospect y est aussi enregistré.
// HubSpot reste alimenté pendant la transition ; il devient facultatif.
const OS_URL = "https://os.happi-el-consulting.com/api/prospects/entrant";
const OS_SECRET = process.env.PROSPECTS_INGEST_SECRET;

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const nettoie = (s, max = 500) => String(s ?? "").trim().slice(0, max);
const emailValide = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);


const DISCOVERY = new Set(["chatgpt","perplexity","autre_ia","google","linkedin","recommandation","autre","inconnu"]);
const DECISION = new Set(["recommandation_ia","video","article","temoignage","recommandation_humaine","autre"]);

function observedArrival(payload) {
  let host = "";
  try {
    const referrer = new URL(nettoie(payload.referrer, 1000));
    if (referrer.protocol === "https:" || referrer.protocol === "http:") host = referrer.hostname.toLowerCase();
  } catch { /* A referrer is not always available. */ }
  const is = (domain) => host === domain || host.endsWith("." + domain);
  const medium = nettoie(payload.utm?.utm_medium, 40).toLowerCase();
  if (["cpc", "ppc", "paid", "paid_social", "paid_search", "cpm"].includes(medium)) return "campagne_payante_declaree";
  if (is("chatgpt.com") || is("chat.openai.com")) return "chatgpt";
  if (is("perplexity.ai")) return "perplexity";
  if (["google.com", "google.cm", "google.fr", "google.co.uk"].some(is)) return "google_referent";
  if (is("linkedin.com")) return "linkedin";
  if (is("happi-el-consulting.com")) return "inconnu";
  return host ? "autre_referent" : "inconnu";
}

function pilotInfluence(payload) {
  const discovery = nettoie(payload.influenceDiscovery, 40);
  const decision = Array.isArray(payload.influenceDecision)
    ? [...new Set(payload.influenceDecision.slice(0, 12).filter((v) => DECISION.has(v)))] : [];
  return { arrival: observedArrival(payload), discovery: DISCOVERY.has(discovery) ? discovery : undefined, decision };
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "methode" });
  if (!HUBSPOT_TOKEN && !OS_SECRET) return json(500, { error: "crm_non_configure" });

  let payload;
  try { payload = await req.json(); } catch { return json(400, { error: "json" }); }

  // Piège anti-robot : ce champ est invisible et vide pour un humain. Un robot qui remplit
  // tous les champs le remplit aussi. On répond succès pour ne pas révéler la détection.
  if (nettoie(payload.websiteCheck, 200)) return json(200, { ok: true, qualifie: false });

  const fullName = nettoie(payload.fullName, 100);
  const email = nettoie(payload.email, 150);
  // "ebook" = capture depuis la ressource Freelancing IA (HAPPI-EL Academy) : pas de score,
  // simple mise en relation. Toute autre valeur (ou absence) suit le circuit diagnostic /20 existant.
  // "conformite" = liste des obligations de la loi n° 2024/017 (guide du site) : même circuit, sans score.
  const sourceRessource = nettoie(payload.source, 30);
  const estEbook = sourceRessource === "ebook" || sourceRessource === "conformite";
  const libelleRessource = sourceRessource === "conformite" ? "liste des obligations de la loi n° 2024/017 (guide conformité)" : "ressource Freelancing IA (HAPPI-EL Academy)";
  // Un score peut être absent (null) sur le circuit "diagnostic" lui-même : c'est le cas
  // du raccourci "Vous avez déjà un besoin précis ?" (contact direct sans passer par le
  // questionnaire /20). Ce n'est pas une erreur de saisie — ne pas le rejeter comme tel.
  const scoreFourni = payload.score !== null && payload.score !== undefined && payload.score !== "";
  const score = scoreFourni ? Number(payload.score) : null;

  if (!fullName || !emailValide(email)) return json(400, { error: "champs_invalides" });
  if (!payload.consent) return json(400, { error: "consentement_requis" });
  if (!estEbook && scoreFourni && (!Number.isFinite(score) || score < 0 || score > 20)) return json(400, { error: "score_invalide" });

  const qualifie = !estEbook && scoreFourni && score > SEUIL_QUALIFICATION;
  const [prenom, ...reste] = fullName.split(" ");
  const nomFamille = reste.join(" ") || prenom;

  // Aucune propriété personnalisée requise : tout tient dans des champs HubSpot
  // standards, présents sur tous les comptes quel que soit l'abonnement.
  // NB : "lifecyclestage" n'est pas utilisé ici — HubSpot le réinitialise souvent
  // automatiquement via ses propres workflows internes. "hs_lead_status" est le
  // signal fiable pour distinguer les leads qualifiés (NEW) des autres (OPEN).
  const properties = {
    firstname: prenom,
    lastname: nomFamille,
    email,
    phone: nettoie(payload.phone, 30),
    company: nettoie(payload.company, 150),
    website: nettoie(payload.website, 200),
    industry: nettoie(payload.sector, 60),
    hs_lead_status: qualifie ? "NEW" : "OPEN",
    message: estEbook
      ? [
          "Source : téléchargement/intérêt " + libelleRessource,
          "Page d'origine : " + nettoie(payload.pageUri, 200)
        ].join("\n")
      : !scoreFourni
      ? [
          "Diagnostic HAPPI-EL /20 : non réalisé (contact direct via le raccourci \"besoin précis\")",
          "Priorité indiquée : " + nettoie(payload.recommendedService, 100),
          "Enjeu exprimé : " + nettoie(payload.challenge, 400),
          "Page d'origine : " + nettoie(payload.pageUri, 200)
        ].join("\n")
      : [
          "Diagnostic HAPPI-EL /20 : " + score + "/20 — " + nettoie(payload.level, 40),
          "Offre recommandée : " + nettoie(payload.recommendedService, 100),
          "Enjeu exprimé : " + nettoie(payload.challenge, 400),
          "Page d'origine : " + nettoie(payload.pageUri, 200)
        ].join("\n")
  };

  // 1. CRM interne HAPPI-EL OS
  let osOk = false;
  if (OS_SECRET) {
    try {
      const r = await fetch(OS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-happiel-cle": OS_SECRET },
        body: JSON.stringify({
          source: estEbook ? sourceRessource : "diagnostic",
          fullName, email,
          phone: nettoie(payload.phone, 30),
          company: nettoie(payload.company, 150),
          website: nettoie(payload.website, 200),
          sector: nettoie(payload.sector, 60),
          score: estEbook || !scoreFourni ? undefined : score,
          level: nettoie(payload.level, 40),
          recommendedService: nettoie(payload.recommendedService, 100),
          challenge: nettoie(payload.challenge, 400),
          pageUri: nettoie(payload.pageUri, 200),
          influence: !estEbook && Object.hasOwn(payload, 'influenceDecision') ? pilotInfluence(payload) : undefined,
          consent: true
        }),
        signal: AbortSignal.timeout(6000)
      });
      osOk = r.ok;
    } catch { osOk = false; }
  }

  // 2. HubSpot (transition) — facultatif
  let hubspotOk = false;
  let mieAJourEchouee = false;
  if (HUBSPOT_TOKEN) {
    const hs = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + HUBSPOT_TOKEN },
      body: JSON.stringify({ properties })
    }).catch(() => ({ ok: false, status: 0 }));

    // Contact déjà existant (409) : on tente une mise à jour au lieu d'échouer
    if (hs.status === 409) {
      const patch = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/" + encodeURIComponent(email) + "?idProperty=email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + HUBSPOT_TOKEN },
        body: JSON.stringify({ properties })
      }).catch(() => null);
      if (!patch || !patch.ok) mieAJourEchouee = true;
    }
    hubspotOk = hs.ok || (hs.status === 409 && !mieAJourEchouee);
  }

  if (!osOk && !hubspotOk) return json(502, { error: "crm_echec" });
  return json(200, { ok: true, qualifie, miseAJourEchouee: mieAJourEchouee });
};

// 5 soumissions/minute/IP : large pour un vrai visiteur, dissuasif pour un script qui viserait
// l'endpoint directement en contournant le formulaire.
export const config = { path: "/api/leads", rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ["ip"] } };
