/* ============================================================
   db.js — couche de données (plain JS, pas de JSX)
   Tout l'état de l'app vit ici. Les autres fichiers ne touchent
   jamais localStorage directement : ils passent par window.DB.
   ------------------------------------------------------------
   Persistance : localStorage (données structurées, texte).
   Les PHOTOS d'évolution iront en IndexedDB (phase 3), pas ici.
   ============================================================ */
(function () {
  const KEY = "recomp.state";
  const SCHEMA_VERSION = 1;

  // ---- Forme vierge de l'état (le "modèle de données" complet) ----
  // Les sections vides (meals, weighIns…) existent dès maintenant pour
  // que les phases 2-4 n'aient qu'à les remplir, sans réécrire le socle.
  function blank() {
    return {
      schemaVersion: SCHEMA_VERSION,

      // ---- Section 1 — Qui je suis (fixe) ----
      profile: null, // {age, sex, heightCm, weightKg, targetWeightKg, activity,
                     //  conditions:{hernia,knee,tendons}, equipment:[], proteinTarget_g, createdAt}

      // ---- Section 2 — Ce que j'ai fait ----
      sessions: [],   // {id,date,mode,checkin,entries:[{exerciseId,sets:[{load,reps}],pain}]}
      meals: [],      // {id,date,kcal,protein_g,source:'manual'|'scan',label}
      weighIns: [],   // {date,weightKg}
      waist: [],      // {date,cm}
      sleep: [],      // {date,bedtime,wake,feeling}
      favorites: [],  // {id,label,kcal,protein_g} — repas/sources en un tap
      config: { visionWorkerUrl: "" }, // URL du Cloudflare Worker pour le scan

      // ---- Bibliothèque & moteur (remplis en phase 2) ----
      exerciseStatus: {}, // {exerciseId: 'validated'|'adapt'|'banned'}
      progression: {},    // {exerciseId: {load,reps,...}}

      // ---- Divers ----
      habits: { current: "protein" }, // une habitude à la fois
      lastCheckin: null,              // {date, answers, mode, reason}
      nextTemplate: 0,                // rotation des séances A/B/C (0/1/2)
    };
  }

  // ---- Chargement + migration ----
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.warn("DB: état illisible, repart à vide", e);
      return blank();
    }
  }

  // Migration douce : on fusionne sur la forme vierge pour ne jamais
  // perdre de clés quand on fera évoluer le schéma plus tard.
  function migrate(d) {
    const base = blank();
    const merged = Object.assign(base, d);
    merged.schemaVersion = SCHEMA_VERSION;
    return merged;
  }

  let state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error("DB: échec sauvegarde (quota ?)", e);
    }
  }

  // ---- API publique ----
  function get() {
    return state;
  }

  // update(fn) : on mute l'état dans fn, puis sauvegarde.
  function update(fn) {
    fn(state);
    save();
    return state;
  }

  function setProfile(p) {
    state.profile = Object.assign({}, p, {
      createdAt: state.profile?.createdAt || Date.now(),
    });
    save();
    return state.profile;
  }

  function reset() {
    state = blank();
    save();
  }

  // ============================================================
  //  Valeurs CALCULÉES (Section 3 — jamais stockées brutes)
  //  Honnêteté sur l'incertitude : ce sont des estimations qui
  //  pilotent une TENDANCE, pas des vérités au gramme/kcal près.
  // ============================================================
  const ACTIVITY = { sedentaire: 1.2, leger: 1.375, modere: 1.55 };

  // Mifflin-St Jeor
  function bmr(p) {
    if (!p) return 0;
    const s = p.sex === "femme" ? -161 : 5;
    return Math.round(10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + s);
  }

  function tdee(p) {
    if (!p) return 0;
    const f = ACTIVITY[p.activity] || ACTIVITY.leger;
    return Math.round(bmr(p) * f);
  }

  // Recomp : maintenance OU déficit très léger. On renvoie une FOURCHETTE.
  function calorieRange(p) {
    const m = tdee(p);
    const round10 = (n) => Math.round(n / 10) * 10;
    return { low: round10(m - 250), high: round10(m), maintenance: m };
  }

  // Protéines : 1,6–2,0 g/kg de poids CIBLE. Défaut 1,8. Stocké comme
  // cible "dure" éditable (profile.proteinTarget_g) ; ici on calcule la
  // suggestion + la fourchette pour l'UI.
  function proteinSuggestion(p, factor = 1.8) {
    if (!p) return { target: 0, low: 0, high: 0 };
    const round5 = (n) => Math.round(n / 5) * 5;
    return {
      target: round5(p.targetWeightKg * factor),
      low: round5(p.targetWeightKg * 1.6),
      high: round5(p.targetWeightKg * 2.0),
    };
  }

  // ---- Utilitaires ----
  // ============================================================
  //  PHOTOS d'évolution — IndexedDB, STRICTEMENT local (jamais cloud)
  //  Stockées comme Blob. Affichées en côte à côte avec le départ.
  // ============================================================
  const PDB = "recomp-photos", PSTORE = "photos";
  function openPhotos() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(PDB, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains(PSTORE)) d.createObjectStore(PSTORE, { keyPath: "id" });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  function photoTx(mode, fn) {
    return openPhotos().then((d) => new Promise((res, rej) => {
      const tx = d.transaction(PSTORE, mode);
      const out = fn(tx.objectStore(PSTORE));
      tx.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      tx.onerror = () => rej(tx.error);
    }));
  }
  const photos = {
    add: (rec) => photoTx("readwrite", (st) => st.put(rec)),
    list: () => photoTx("readonly", (st) => st.getAll()),
    del: (id) => photoTx("readwrite", (st) => st.delete(id)),
  };

  function todayKey(d) {
    const x = d ? new Date(d) : new Date();
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") +
           "-" + String(x.getDate()).padStart(2, "0");
  }

  // ============================================================
  //  Moteur de progression « AU MÉRITE »
  //  Règles (dans cet ordre, la sécurité prime) :
  //   1. Douleur ("a fait mal")  → on ALLÈGE. Jamais une punition.
  //   2. Tiraillement ("a tiré") → on MAINTIENT le palier.
  //   3. Dos OK + cible atteinte → on MONTE (reps/sec, puis charge).
  //   4. Dos OK + cible ratée    → on MAINTIENT, sans culpabilité.
  //  cur   : prescription actuelle {load, target}
  //  entry : {pain:'ok'|'tire'|'mal', value:reps|sec, load}
  //  retour: {load, target, status:'up'|'hold'|'block'|'graduate', msg}
  // ============================================================
  function meritInit(exo) {
    return { load: 0, target: exo.low }; // charge 0 = poids du corps au départ
  }

  function meritNext(exo, cur, entry) {
    const out = { load: cur.load, target: cur.target, status: "hold", msg: "" };
    const unit = exo.type === "time" ? " s" : " rép";

    if (entry.pain === "mal") {
      if (exo.loadable && cur.load > 0) out.load = Math.max(0, cur.load - exo.loadStep);
      else out.target = Math.max(exo.low, cur.target - exo.step);
      out.status = "block";
      out.msg = "Douleur signalée : on allège. Ce n'est pas une contre-perf, c'est de la protection.";
      return out;
    }
    if (entry.pain === "tire") {
      out.status = "hold";
      out.msg = "Léger tiraillement : on reste à ce palier la prochaine fois.";
      return out;
    }
    // pain === 'ok'
    if (entry.value < cur.target) {
      out.status = "hold";
      out.msg = "Palier non atteint : on le reprend tel quel, sans pénalité.";
      return out;
    }
    // cible atteinte, dos OK → on monte
    if (cur.target < exo.high) {
      out.target = cur.target + exo.step;
      out.status = "up";
      out.msg = "Palier validé, dos neutre : +" + exo.step + unit + ".";
      return out;
    }
    // haut de fourchette atteint
    if (exo.loadable) {
      out.load = cur.load + exo.loadStep;
      out.target = exo.low;
      out.status = "up";
      out.msg = "Haut de fourchette + dos OK : +" + exo.loadStep + " kg, on redescend les répétitions.";
      return out;
    }
    out.status = "graduate";
    out.msg = "Tu plafonnes proprement : prochaine étape = variante plus exigeante (à valider kiné).";
    return out;
  }

  window.DB = {
    get, update, setProfile, reset, save,
    todayKey,
    ACTIVITY,
    photos,
    merit: { init: meritInit, next: meritNext },
    computed: { bmr, tdee, calorieRange, proteinSuggestion },
  };
})();
