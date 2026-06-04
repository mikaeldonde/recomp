/* ============================================================
   library.js — Bibliothèque FERMÉE d'exercices (data, plain JS)
   ------------------------------------------------------------
   Règle d'architecture : l'app n'invente JAMAIS d'exercice. Elle
   orchestre uniquement dans cette liste. Tout est PROVISOIRE, à
   valider par un kiné (chaque exo est marquable validé/adapter/bannir).
   ------------------------------------------------------------
   Choix volontairement conservateurs pour une hernie lombaire :
   - Gainage anti-mouvement uniquement (zéro flexion répétée).
   - Chaîne postérieure SANS flexion chargée (pont, hip thrust).
   - Squat profond chargé & soulevé chargé : ABSENTS par défaut,
     reportés tant qu'un kiné n'a pas validé la charnière chargée.
   ------------------------------------------------------------
   Forme d'un exo :
   { name, pattern, role, equip:[], type:'reps'|'time'|'mobility',
     loadable, low, high, step, loadStep, std, allege, caution }
   role : 'mobility' | 'core' | 'force' | 'stretch'
     - mobility/stretch : non loggés (case "fait"), pas de progression
     - core/force       : loggés + moteur au mérite
   ============================================================ */
(function () {
  const LIB = {
    // ---------- RÉVEIL (mobilité / activation) ----------
    m_bascule: {
      name: "Bascule du bassin (4 pattes)", pattern: "mobility", role: "mobility",
      equip: ["tapis"], type: "mobility",
      std: "Dos rond / dos creux très lents, petite amplitude. Respire.",
      allege: "Amplitude minime, juste réveiller le bas du dos." },
    m_pont_act: {
      name: "Pont fessier d'activation", pattern: "mobility", role: "mobility",
      equip: ["tapis"], type: "mobility",
      std: "Monte le bassin en serrant les fessiers, sans cambrer. 8–10 lents.",
      allege: "Demi-amplitude, sens juste les fessiers se brancher." },
    m_9090: {
      name: "Rotations de hanche 90/90", pattern: "mobility", role: "mobility",
      equip: ["tapis"], type: "mobility",
      std: "Assis, bascule les genoux d'un côté à l'autre, lentement.",
      allege: "Amplitude réduite, mains en appui derrière." },
    m_psoas_dyn: {
      name: "Ouverture psoas (fente dynamique)", pattern: "mobility", role: "mobility",
      equip: ["tapis"], type: "mobility",
      std: "Demi-genou, avance doucement le bassin, sans cambrer le bas du dos.",
      allege: "Appui sur une chaise, tout petit mouvement." },

    // ---------- STABILITÉ (gainage anti-mouvement, time) ----------
    c_deadbug: {
      name: "Dead bug", pattern: "core", role: "core", equip: ["tapis"],
      type: "time", loadable: false, low: 15, high: 40, step: 5,
      std: "Sur le dos, bas du dos collé au sol. Tends bras + jambe opposés, lentement.",
      allege: "Bras seuls, jambes pliées posées au sol.",
      caution: "Le bas du dos ne doit jamais décoller du tapis." },
    c_birddog: {
      name: "Bird-dog", pattern: "core", role: "core", equip: ["tapis"],
      type: "time", loadable: false, low: 15, high: 35, step: 5,
      std: "4 pattes, tends bras + jambe opposés, bassin stable. Alterne.",
      allege: "Lève le bras OU la jambe, jamais les deux." },
    c_plank: {
      name: "Planche", pattern: "core", role: "core", equip: ["tapis"],
      type: "time", loadable: false, low: 15, high: 45, step: 5,
      std: "Avant-bras, corps gainé en ligne, fessiers serrés. Pas de creux.",
      allege: "Sur les genoux.",
      caution: "Si le bas du dos s'affaisse : stop, passe à l'allégé." },
    c_sideplank: {
      name: "Gainage latéral", pattern: "core", role: "core", equip: ["tapis"],
      type: "time", loadable: false, low: 12, high: 30, step: 5,
      std: "Sur l'avant-bras, hanches hautes, corps aligné. Par côté.",
      allege: "Genou inférieur posé au sol." },

    // ---------- POUSSÉE ----------
    p_floorpress: {
      name: "Développé haltères au sol", pattern: "push", role: "force",
      equip: ["halteres", "tapis"], type: "reps", loadable: true,
      low: 8, high: 12, step: 1, loadStep: 2,
      std: "Allongé au sol, pousse les haltères vers le haut. Le sol limite la descente.",
      allege: "Charge légère, tempo lent, descente contrôlée." },
    p_incline: {
      name: "Pompes inclinées (banc)", pattern: "push", role: "force",
      equip: ["banc"], type: "reps", loadable: false,
      low: 8, high: 15, step: 1,
      std: "Mains sur le banc, corps gainé, descente lente.",
      allege: "Mains contre un mur, plus vertical." },
    p_shoulderpress: {
      name: "Développé épaules assis", pattern: "push", role: "force",
      equip: ["halteres", "banc"], type: "reps", loadable: true,
      low: 8, high: 12, step: 1, loadStep: 1,
      std: "Assis, dos bien calé, pousse au-dessus de la tête sans cambrer.",
      allege: "Charge légère, dos calé, amplitude réduite.",
      caution: "Garde le bas du dos neutre, ne cambre pas pour pousser." },

    // ---------- TIRAGE ----------
    t_row1: {
      name: "Rowing haltère un bras (appui banc)", pattern: "pull", role: "force",
      equip: ["halteres", "banc"], type: "reps", loadable: true,
      low: 8, high: 12, step: 1, loadStep: 2,
      std: "Une main + un genou sur le banc, dos plat, tire l'haltère vers la hanche.",
      allege: "Charge légère, amplitude réduite.",
      caution: "Dos à plat, jamais arrondi. L'appui protège le bas du dos." },
    t_bandrow: {
      name: "Tirage élastique assis", pattern: "pull", role: "force",
      equip: ["elastiques"], type: "reps", loadable: false,
      low: 10, high: 15, step: 1,
      std: "Assis au sol jambes tendues, tire l'élastique vers le ventre, dos droit.",
      allege: "Élastique plus souple, amplitude réduite." },
    t_facepull: {
      name: "Face pull élastique", pattern: "pull", role: "force",
      equip: ["elastiques"], type: "reps", loadable: false,
      low: 12, high: 18, step: 1,
      std: "Élastique à hauteur visage, tire vers le front, coudes hauts.",
      allege: "Élastique souple, mouvement court." },
    t_curl: {
      name: "Curl haltères", pattern: "pull", role: "force",
      equip: ["halteres"], type: "reps", loadable: true,
      low: 8, high: 12, step: 1, loadStep: 1,
      std: "Debout dos neutre, fléchis les coudes sans balancer le buste.",
      allege: "Charge légère, assis pour caler le dos." },

    // ---------- CHARNIÈRE / JAMBES DOMINÉES HANCHE ----------
    h_bridge: {
      name: "Pont fessier", pattern: "hinge", role: "force",
      equip: ["tapis"], type: "reps", loadable: true,
      low: 10, high: 15, step: 1, loadStep: 2,
      std: "Sur le dos, monte le bassin par les fessiers. Charge = haltère sur le bassin.",
      allege: "Sans charge, demi-amplitude.",
      caution: "Pousse par les fessiers, pas par le bas du dos." },
    h_thrust: {
      name: "Hip thrust (épaules sur banc)", pattern: "hinge", role: "force",
      equip: ["banc", "halteres"], type: "reps", loadable: true,
      low: 8, high: 12, step: 1, loadStep: 2,
      std: "Haut du dos sur le banc, monte le bassin, menton rentré.",
      allege: "Au sol (pont fessier), sans charge.",
      caution: "Ne cambre pas en haut : finis par les fessiers, côtes basses." },
    h_sl_bridge: {
      name: "Pont fessier unilatéral", pattern: "hinge", role: "force",
      equip: ["tapis"], type: "reps", loadable: false,
      low: 8, high: 12, step: 1,
      std: "Une jambe tendue, monte le bassin avec l'autre. Bassin de niveau. Par côté.",
      allege: "Pied au sol des deux côtés (pont classique)." },

    // ---------- RETOUR AU CALME (étirements) ----------
    s_psoas: {
      name: "Étirement psoas", pattern: "stretch", role: "stretch",
      equip: ["tapis"], type: "mobility",
      std: "Demi-genou, avance le bassin doucement, 20–30 s par côté.",
      allege: "Tout petit étirement, sans forcer." },
    s_ischios: {
      name: "Étirement ischios", pattern: "stretch", role: "stretch",
      equip: ["tapis"], type: "mobility",
      std: "Assis ou debout, jambe tendue, va chercher sans arrondir le dos.",
      allege: "Genou légèrement fléchi, amplitude douce." },
  };

  // ============================================================
  //  3 séances qui tournent (A → B → C → A …)
  //  Chaque séance est full-body : 1 poussée + 1 tirage + 1 charnière.
  //  Les `cand` (candidats) sont ordonnés : si le 1er est banni, on
  //  prend le suivant. Couverture du corps sur la semaine garantie.
  // ============================================================
  const TEMPLATES = [
    { key: "A",
      reveil: ["m_bascule", "m_pont_act"],
      core:   ["c_deadbug", "c_plank"],
      force:  [
        { pattern: "push",  cand: ["p_floorpress", "p_incline"] },
        { pattern: "pull",  cand: ["t_row1", "t_bandrow"] },
        { pattern: "hinge", cand: ["h_bridge", "h_thrust"] },
      ],
      retour: ["s_psoas", "s_ischios"] },

    { key: "B",
      reveil: ["m_9090", "m_psoas_dyn"],
      core:   ["c_birddog", "c_sideplank"],
      force:  [
        { pattern: "push",  cand: ["p_incline", "p_floorpress"] },
        { pattern: "pull",  cand: ["t_bandrow", "t_row1"] },
        { pattern: "hinge", cand: ["h_thrust", "h_bridge"] },
      ],
      retour: ["s_psoas", "s_ischios"] },

    { key: "C",
      reveil: ["m_bascule", "m_9090"],
      core:   ["c_deadbug", "c_sideplank"],
      force:  [
        { pattern: "push",  cand: ["p_shoulderpress", "p_floorpress"] },
        { pattern: "pull",  cand: ["t_facepull", "t_curl"] },
        { pattern: "hinge", cand: ["h_sl_bridge", "h_bridge"] },
      ],
      retour: ["s_psoas", "s_ischios"] },
  ];

  window.LIB = LIB;
  window.TEMPLATES = TEMPLATES;
})();
