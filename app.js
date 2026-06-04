/* ============================================================
   app.js — Racine de l'app
   - window.UI : primitives partagées (Seg, Pills, ModeBadge)
   - Calibration : onboarding (Section 1) + édition profil
   - Profil : lecture + édition + reset
   - App : navigation par onglets + montage
   Chargé EN DERNIER : window.UI existe avant tout render.
   ============================================================ */
(function () {
  const { useState } = React;
  const C = DB.computed;

  // ============================================================
  //  Primitives UI partagées
  // ============================================================
  function Seg({ options, value, onChange, severity }) {
    return (
      <div className={"seg" + (severity ? " sev" : "")}>
        {options.map((o, i) => (
          <button key={i} data-on={value === i} data-sev={i} onClick={() => onChange(i)}>
            {o}
          </button>
        ))}
      </div>
    );
  }

  function Pills({ options, values, onToggle }) {
    return (
      <div className="pills">
        {options.map((o) => (
          <button key={o.id} className="pill" data-on={values.includes(o.id)}
                  onClick={() => onToggle(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  function ModeBadge({ mode }) {
    if (mode === "allege")
      return <span className="badge amber"><span className="dot" />Allégé</span>;
    return <span className="badge mint"><span className="dot" />Standard</span>;
  }

  // Réglage +/- au pouce (charge, reps, secondes)
  function Stepper({ value, onChange, step = 1, min = 0, max = 999, suffix }) {
    const clamp = (v) => Math.min(max, Math.max(min, v));
    return (
      <div className="stepper">
        <button onClick={() => onChange(clamp(value - step))}>–</button>
        <span className="val mono">{value}{suffix ? <em>{suffix}</em> : null}</span>
        <button onClick={() => onChange(clamp(value + step))}>+</button>
      </div>
    );
  }

  window.UI = { Seg, Pills, ModeBadge, Stepper };

  // ============================================================
  //  Calibration (onboarding + édition)
  // ============================================================
  const EQUIP = [
    { id: "tapis", label: "Tapis" },
    { id: "halteres", label: "Haltères" },
    { id: "banc", label: "Banc" },
    { id: "elastiques", label: "Élastiques" },
  ];
  const COND = [
    { id: "hernia", label: "Hernie lombaire" },
    { id: "knee", label: "Douleur genou" },
    { id: "tendons", label: "Tendons fragiles" },
  ];
  const SEX = ["Homme", "Femme"];
  const ACT = ["Sédentaire", "Léger", "Modéré"];
  const ACT_KEYS = ["sedentaire", "leger", "modere"];

  function num(v) { const n = Number(v); return isFinite(n) && n > 0 ? n : 0; }

  function Calibration({ initial, onSave, onCancel }) {
    const isEdit = !!initial;
    const [f, setF] = useState(() => ({
      age: initial?.age ?? "",
      sexIdx: initial ? (initial.sex === "femme" ? 1 : 0) : 0,
      heightCm: initial?.heightCm ?? "",
      weightKg: initial?.weightKg ?? "",
      targetWeightKg: initial?.targetWeightKg ?? "",
      actIdx: initial ? Math.max(0, ACT_KEYS.indexOf(initial.activity)) : 1,
      equipment: initial?.equipment ?? ["tapis", "halteres", "banc", "elastiques"],
      conditions: initial?.conditions ?? { hernia: true, knee: true, tendons: true },
      proteinTarget: initial?.proteinTarget_g ?? "",
    }));

    const set = (k, v) => setF({ ...f, [k]: v });
    const toggleEquip = (id) =>
      set("equipment", f.equipment.includes(id)
        ? f.equipment.filter((x) => x !== id) : [...f.equipment, id]);
    const toggleCond = (id) =>
      set("conditions", { ...f.conditions, [id]: !f.conditions[id] });

    // Profil temporaire pour les calculs live
    const temp = {
      age: num(f.age), sex: f.sexIdx === 1 ? "femme" : "homme",
      heightCm: num(f.heightCm), weightKg: num(f.weightKg),
      targetWeightKg: num(f.targetWeightKg), activity: ACT_KEYS[f.actIdx],
    };
    const ready = temp.age && temp.heightCm && temp.weightKg && temp.targetWeightKg;
    const prot = C.proteinSuggestion(temp);
    const cal = ready ? C.calorieRange(temp) : null;

    const save = () => {
      onSave({
        age: temp.age, sex: temp.sex, heightCm: temp.heightCm,
        weightKg: temp.weightKg, targetWeightKg: temp.targetWeightKg,
        activity: temp.activity,
        equipment: f.equipment, conditions: f.conditions,
        proteinTarget_g: num(f.proteinTarget) || prot.target,
      });
    };

    return (
      <div className="stack">
        <div className="rise">
          {!isEdit && <div className="kicker">Étape unique</div>}
          <h1 className="title">{isEdit ? "Modifier le profil" : "Calibration"}</h1>
          {!isEdit && (
            <p className="muted small" style={{ marginTop: 6 }}>
              Qui tu es, ce dont tu disposes. Ça calibre les cibles — et ça reste
              modifiable à tout moment.
            </p>
          )}
        </div>

        {/* Corps */}
        <div className="panel rise" style={{ animationDelay: ".05s" }}>
          <h2 className="section" style={{ marginBottom: 14 }}>Le corps</h2>
          <div className="field"><label>Âge</label>
            <input type="number" value={f.age} placeholder="43"
                   onChange={(e) => set("age", e.target.value)} /></div>
          <div className="field"><label>Sexe (pour l'estimation calorique)</label>
            <Seg options={SEX} value={f.sexIdx} onChange={(i) => set("sexIdx", i)} /></div>
          <div className="field"><label>Taille (cm)</label>
            <input type="number" value={f.heightCm} placeholder="178"
                   onChange={(e) => set("heightCm", e.target.value)} /></div>
          <div className="field"><label>Poids actuel (kg)</label>
            <input type="number" value={f.weightKg} placeholder="88"
                   onChange={(e) => set("weightKg", e.target.value)} /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>Poids cible (kg)</label>
            <input type="number" value={f.targetWeightKg} placeholder="80"
                   onChange={(e) => set("targetWeightKg", e.target.value)} />
            <div className="hint">Sert de base aux protéines, pas d'objectif de balance.</div>
          </div>
        </div>

        {/* Activité */}
        <div className="panel rise" style={{ animationDelay: ".08s" }}>
          <h2 className="section" style={{ marginBottom: 14 }}>Activité quotidienne</h2>
          <Seg options={ACT} value={f.actIdx} onChange={(i) => set("actIdx", i)} />
          <div className="hint" style={{ marginTop: 8, fontSize: 12, color: "var(--ink-3)" }}>
            Hors séances. Travail surtout assis → Sédentaire.
          </div>
        </div>

        {/* Contraintes */}
        <div className="panel rise" style={{ animationDelay: ".11s" }}>
          <h2 className="section" style={{ marginBottom: 6 }}>Contraintes</h2>
          <p className="muted small" style={{ marginBottom: 12 }}>
            Pilotent les variantes « dos en vrac » et les exos bannis.
          </p>
          <Pills options={COND}
                 values={Object.keys(f.conditions).filter((k) => f.conditions[k])}
                 onToggle={toggleCond} />
        </div>

        {/* Matériel */}
        <div className="panel rise" style={{ animationDelay: ".14s" }}>
          <h2 className="section" style={{ marginBottom: 12 }}>Matériel</h2>
          <Pills options={EQUIP} values={f.equipment} onToggle={toggleEquip} />
        </div>

        {/* Cibles calculées */}
        <div className="panel rise" style={{ animationDelay: ".17s" }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <h2 className="section">Cibles calculées</h2>
            <span className="kicker">estimations</span>
          </div>

          <div className="field">
            <label>Protéines · cible quotidienne dure</label>
            <input type="number" value={f.proteinTarget} placeholder={prot.target || "—"}
                   onChange={(e) => set("proteinTarget", e.target.value)} />
            <div className="hint">
              Suggéré <b>{prot.target} g</b> (1,8 g/kg de poids cible). Plage saine{" "}
              {prot.low}–{prot.high} g. Modifiable.
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat">
              <div className="lbl">Calories · fourchette</div>
              <div className="val">{cal ? `${cal.low}–${cal.high}` : "—"}</div>
            </div>
            <div className="stat">
              <div className="lbl">Maintenance ≈</div>
              <div className="val">{cal ? cal.maintenance : "—"}</div>
            </div>
          </div>
          <p className="muted small" style={{ marginTop: 10 }}>
            Recomp : maintenance ou déficit très léger. Jamais un chiffre unique —
            une fourchette, recalculée quand le poids bouge.
          </p>
        </div>

        <button className="btn primary" disabled={!ready}
                style={{ opacity: ready ? 1 : 0.4 }} onClick={save}>
          {isEdit ? "Enregistrer" : "Calibrer & démarrer"}
        </button>
        {isEdit && <button className="btn ghost" onClick={onCancel}>Annuler</button>}
      </div>
    );
  }

  // ============================================================
  //  Onglet Profil
  // ============================================================
  function Profil({ data, commit, refresh }) {
    const [edit, setEdit] = useState(false);
    const p = data.profile;

    if (edit) {
      return (
        <Calibration initial={p}
          onSave={(np) => { DB.setProfile(np); refresh(); setEdit(false); }}
          onCancel={() => setEdit(false)} />
      );
    }

    const cal = C.calorieRange(p);
    const condLabels = COND.filter((c) => p.conditions[c.id]).map((c) => c.label);
    const reset = () => {
      if (confirm("Tout effacer et repartir de zéro ? Cette action est définitive.")) {
        DB.reset(); refresh();
      }
    };

    return (
      <div className="stack">
        <div className="rise">
          <div className="kicker">Section 1 · fixe</div>
          <h1 className="title">Profil</h1>
        </div>

        <div className="panel rise" style={{ animationDelay: ".05s" }}>
          <div className="stat-grid">
            <div className="stat"><div className="lbl">Âge</div><div className="val">{p.age}</div></div>
            <div className="stat"><div className="lbl">Activité</div>
              <div className="val" style={{ fontSize: 16 }}>{ACT[ACT_KEYS.indexOf(p.activity)]}</div></div>
            <div className="stat"><div className="lbl">Poids</div>
              <div className="val">{p.weightKg}<span style={{ fontSize: 13, color: "var(--ink-3)" }}> kg</span></div></div>
            <div className="stat"><div className="lbl">Cible</div>
              <div className="val">{p.targetWeightKg}<span style={{ fontSize: 13, color: "var(--ink-3)" }}> kg</span></div></div>
          </div>
        </div>

        <div className="panel rise" style={{ animationDelay: ".08s" }}>
          <div className="row">
            <span className="kicker">Protéines / jour</span>
            <span className="readout mid" style={{ color: "var(--mint)" }}>
              {p.proteinTarget_g}<span className="unit">g</span></span>
          </div>
          <div className="divider" />
          <div className="row">
            <span className="kicker">Calories · fourchette</span>
            <span className="readout mid">{cal.low}–{cal.high}</span>
          </div>
        </div>

        <div className="panel rise" style={{ animationDelay: ".11s" }}>
          <div className="kicker" style={{ marginBottom: 10 }}>Contraintes</div>
          <div className="pills">
            {condLabels.length
              ? condLabels.map((l) => <span key={l} className="pill" data-on="true">{l}</span>)
              : <span className="muted small">Aucune</span>}
          </div>
          <div className="kicker" style={{ margin: "16px 0 10px" }}>Matériel</div>
          <div className="pills">
            {EQUIP.filter((e) => p.equipment.includes(e.id))
              .map((e) => <span key={e.id} className="pill" data-on="true">{e.label}</span>)}
          </div>
        </div>

        <button className="btn" onClick={() => setEdit(true)}>Modifier le profil</button>
        <button className="btn danger" onClick={reset}>Réinitialiser l'app</button>
      </div>
    );
  }

  // ============================================================
  //  Placeholder pour les onglets à venir
  // ============================================================
  function Soon({ title, phase, lines }) {
    return (
      <div className="stack">
        <div className="rise"><div className="kicker">{phase}</div>
          <h1 className="title">{title}</h1></div>
        <div className="panel placeholder rise" style={{ animationDelay: ".05s" }}>
          <div className="big">Bientôt</div>
          <p className="muted small">{lines}</p>
        </div>
      </div>
    );
  }

  // ============================================================
  //  Navigation
  // ============================================================
  const TABS = [
    { id: "seance", label: "Séance", icon:
      <path d="M3 12h3l2 6 4-14 2 8 2-4h3" /> },
    { id: "nutrition", label: "Nutrition", icon:
      <path d="M12 3c4 4 4 9 0 13M12 3c-4 4-4 9 0 13M6 16a6 6 0 0 0 12 0" /> },
    { id: "progres", label: "Progrès", icon:
      <path d="M4 19V5M4 19h16M8 16l3-4 3 2 4-6" /> },
    { id: "profil", label: "Profil", icon:
      <g><circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" /></g> },
  ];

  function Tabbar({ tab, setTab }) {
    return (
      <nav className="tabbar"><div className="inner">
        {TABS.map((t) => (
          <button key={t.id} className="tab" data-on={tab === t.id} onClick={() => setTab(t.id)}>
            <svg viewBox="0 0 24 24">{t.icon}</svg>
            <span>{t.label}</span>
          </button>
        ))}
      </div></nav>
    );
  }

  // ============================================================
  //  App
  // ============================================================
  function App() {
    const [data, setData] = useState(DB.get());
    const [tab, setTab] = useState("seance");
    const refresh = () => setData({ ...DB.get() });
    const commit = (fn) => { DB.update(fn); refresh(); };

    // Onboarding : pas de profil → calibration plein écran, sans onglets
    if (!data.profile) {
      return (
        <div className="app">
          <Calibration onSave={(p) => { DB.setProfile(p); refresh(); }} />
        </div>
      );
    }

    let view;
    if (tab === "seance") view = <Session data={data} commit={commit} />;
    else if (tab === "nutrition") view = <Nutrition data={data} commit={commit} />;
    else if (tab === "progres") view = <Progress data={data} commit={commit} />;
    else view = <Profil data={data} commit={commit} refresh={refresh} />;

    return (
      <>
        <div className="app">{view}</div>
        <Tabbar tab={tab} setTab={setTab} />
      </>
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
