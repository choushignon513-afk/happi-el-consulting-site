// HAPPI-EL CONSULTING — réception des leads du diagnostic /20
// Règle : score > 8/20 => contact qualifié dans HubSpot + notification WhatsApp immédiate.
//         score <= 8/20 => contact créé aussi, mais étiqueté "à nourrir", sans notification.
// Variables d'environnement requises : HUBSPOT_TOKEN (Private App, scope crm.objects.contacts.write)
// Aucune propriété personnalisée n'est nécessaire : tout est stocké dans des champs standards
// (industry, message, lifecyclestage, hs_lead_status), disponibles sur tous les comptes HubSpot.

const SEUIL_QUALIFICATION = 8;
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const nettoie = (s, max = 500) => String(s ?? "").trim().slice(0, max);
const emailValide = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "methode" });
  if (!HUBSPOT_TOKEN) return json(500, { error: "hubspot_non_configure" });

  let payload;
  try { payload = await req.json(); } catch { return json(400, { error: "json" }); }

  // Piège anti-robot : ce champ est invisible et vide pour un humain. Un robot qui remplit
  // tous les champs le remplit aussi. On répond succès pour ne pas révéler la détection.
  if (nettoie(payload.websiteCheck, 200)) return json(200, { ok: true, qualifie: false });

  const fullName = nettoie(payload.fullName, 100);
  const email = nettoie(payload.email, 150);
  // "ebook" = capture depuis la ressource Freelancing IA (HAPPI-EL Academy) : pas de score,
  // simple mise en relation. Toute autre valeur (ou absence) suit le circuit diagnostic /20 existant.
  const estEbook = nettoie(payload.source, 30) === "ebook";
  const score = Number(payload.score);

  if (!fullName || !emailValide(email)) return json(400, { error: "champs_invalides" });
  if (!payload.consent) return json(400, { error: "consentement_requis" });
  if (!estEbook && (!Number.isFinite(score) || score < 0 || score > 20)) return json(400, { error: "score_invalide" });

  const qualifie = !estEbook && score > SEUIL_QUALIFICATION;
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
          "Source : téléchargement/intérêt ressource Freelancing IA (HAPPI-EL Academy)",
          "Page d'origine : " + nettoie(payload.pageUri, 200)
        ].join("\n")
      : [
          "Diagnostic HAPPI-EL /20 : " + score + "/20 — " + nettoie(payload.level, 40),
          "Offre recommandée : " + nettoie(payload.recommendedService, 100),
          "Enjeu exprimé : " + nettoie(payload.challenge, 400),
          "Page d'origine : " + nettoie(payload.pageUri, 200)
        ].join("\n")
  };

  const hs = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + HUBSPOT_TOKEN },
    body: JSON.stringify({ properties })
  });

  if (!hs.ok && hs.status !== 409) {
    return json(502, { error: "hubspot_echec" });
  }

  // Contact déjà existant (409) : on tente une mise à jour au lieu d'échouer
  let mieAJourEchouee = false;
  if (hs.status === 409) {
    const patch = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/" + encodeURIComponent(email) + "?idProperty=email", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + HUBSPOT_TOKEN },
      body: JSON.stringify({ properties })
    }).catch(() => null);
    if (!patch || !patch.ok) mieAJourEchouee = true;
  }

  return json(200, { ok: true, qualifie, miseAJourEchouee: mieAJourEchouee });
};

// 5 soumissions/minute/IP : large pour un vrai visiteur, dissuasif pour un script qui viserait
// l'endpoint directement en contournant le formulaire.
export const config = { path: "/api/leads", rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ["ip"] } };
