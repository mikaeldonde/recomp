/* ============================================================
   nutrition.js — Onglet Nutrition (phase 4)
   Recomposition : 2 cibles SEULEMENT
     • Protéines = cible quotidienne DURE (profile.proteinTarget_g)
     • Calories  = FOURCHETTE (jamais un chiffre unique)
   Retour quotidien : un seul indicateur → protéines atteintes oui/non.
   Logging anti-friction : sources protéines & favoris en un tap,
   + scan photo de l'assiette via Claude Vision (Cloudflare Worker).
   Honnêteté sur l'incertitude : le scan pilote une TENDANCE, pas un
   comptage au gramme. L'adéquation protéines est plus fiable.
   Dépend de : window.DB, window.UI.
   ============================================================ */
(function () {
  const { useState } = React;

  // Sources de protéines courantes (estimations par portion — à ajuster)
  const SOURCES = [
    { label: "Œuf", kcal: 78, protein_g: 6 },
    { label: "Blanc de poulet 100 g", kcal: 165, protein_g: 31 },
    { label: "Yaourt grec 150 g", kcal: 130, protein_g: 15 },
    { label: "Fromage blanc 0% 100 g", kcal: 50, protein_g: 8 },
    { label: "Thon au naturel (boîte)", kcal: 130, protein_g: 26 },
    { label: "Whey (dose 30 g)", kcal: 120, protein_g: 24 },
    { label: "Steak haché 5% 100 g", kcal: 150, protein_g: 21 },
    { label: "Lentilles cuites 100 g", kcal: 116, protein_g: 9 },
  ];

  const r0 = (n) => Math.round(n);

  // ---------- Scan via Cloudflare Worker (clé API jamais exposée) ----------
  function fileToB64(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(",")[1]);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(file);
    });
  }

  function ScanBlock({ workerUrl, onResult }) {
    const [state, setState] = useState({ loading: false, err: null });
    const onPick = async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      setState({ loading: true, err: null });
      try {
        const image = await fileToB64(file);
        const r = await fetch(workerUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image, mediaType: file.type || "image/jpeg" }),
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const data = await r.json();
        setState({ loading: false, err: null });
        onResult(data);
      } catch (err) {
        setState({ loading: false, err: "Échec du scan (" + err.message + "). Réessaie ou saisis à la main." });
      }
    };
    return (
      <div>
        <label className="btn primary" style={{ display: "block", textAlign: "center", opacity: state.loading ? 0.6 : 1 }}>
          <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                 disabled={state.loading} onChange={onPick} />
          {state.loading ? "Analyse de l'assiette…" : "📷 Scanner mon assiette"}
        </label>
        {state.err && <p className="caution small" style={{ marginTop: 8 }}>{state.err}</p>}
      </div>
    );
  }

  function ScanSetup({ url, onSave }) {
    const [v, setV] = useState(url || "");
    return (
      <div className="panel" style={{ borderStyle: "dashed" }}>
        <div className="kicker" style={{ marginBottom: 8 }}>Scan IA — à configurer une fois</div>
        <p className="muted small" style={{ marginBottom: 12 }}>
          Le scan envoie la photo à ton Cloudflare Worker (même principe que BailSmart),
          qui porte la clé API. Colle l'URL du Worker une fois déployé (voir worker.js).
        </p>
        <div className="quicklog">
          <input type="text" value={v} placeholder="https://…workers.dev"
                 onChange={(e) => setV(e.target.value)} />
          <button className="btn primary" style={{ width: "auto", padding: "12px 18px" }}
                  onClick={() => onSave(v.trim())}>OK</button>
        </div>
      </div>
    );
  }

  // ---------- Formulaire d'ajout manuel / confirmation de scan ----------
  function AddForm({ seed, onAdd, onClear }) {
    const [f, setF] = useState(seed || { label: "", kcal: "", protein_g: "" });
    const [fav, setFav] = useState(false);
    React.useEffect(() => { if (seed) setF(seed); }, [seed]);
    const ok = f.label && Number(f.kcal) >= 0 && Number(f.protein_g) >= 0;
    const submit = () => {
      onAdd({ label: f.label, kcal: r0(Number(f.kcal)), protein_g: r0(Number(f.protein_g)), source: seed ? "scan" : "manual" }, fav);
      setF({ label: "", kcal: "", protein_g: "" }); setFav(false); onClear && onClear();
    };
    return (
      <div className="panel" style={seed ? { borderColor: "var(--amber)" } : null}>
        {seed && (
          <div className="caution small" style={{ marginBottom: 10 }}>
            <span>≈</span><span>Estimation IA{seed.confidence ? " · confiance " + seed.confidence : ""}. Ajuste si besoin — l'app vise la tendance, pas le gramme.</span>
          </div>
        )}
        <div className="field" style={{ marginBottom: 10 }}>
          <label>Repas</label>
          <input type="text" value={f.label} placeholder="ex. Poulet riz"
                 onChange={(e) => setF({ ...f, label: e.target.value })} />
        </div>
        <div className="stat-grid" style={{ marginBottom: 10 }}>
          <div className="field" style={{ margin: 0 }}><label>Calories</label>
            <input type="number" value={f.kcal} placeholder="0"
                   onChange={(e) => setF({ ...f, kcal: e.target.value })} /></div>
          <div className="field" style={{ margin: 0 }}><label>Protéines (g)</label>
            <input type="number" value={f.protein_g} placeholder="0"
                   onChange={(e) => setF({ ...f, protein_g: e.target.value })} /></div>
        </div>
        {seed && seed.note && <p className="faint small" style={{ marginBottom: 10 }}>{seed.note}</p>}
        <label className="favline" onClick={() => setFav(!fav)}>
          <span className="check" data-on={fav}>{fav ? "✓" : ""}</span>
          <span className="small">Enregistrer comme favori (un tap la prochaine fois)</span>
        </label>
        <button className="btn primary" disabled={!ok} style={{ opacity: ok ? 1 : 0.4, marginTop: 12 }}
                onClick={submit}>Ajouter</button>
      </div>
    );
  }

  // ============================================================
  //  Onglet
  // ============================================================
  window.Nutrition = function Nutrition({ data, commit }) {
    const today = DB.todayKey();
    const p = data.profile;
    const target = p.proteinTarget_g;
    const cal = DB.computed.calorieRange(p);
    const [seed, setSeed] = useState(null); // pré-remplissage depuis le scan

    const todayMeals = data.meals.filter((m) => m.date === today);
    const sumP = todayMeals.reduce((s, m) => s + (m.protein_g || 0), 0);
    const sumK = todayMeals.reduce((s, m) => s + (m.kcal || 0), 0);
    const hit = sumP >= target;
    const pct = Math.min(100, Math.round((sumP / target) * 100));

    const addMeal = (meal, asFav) =>
      commit((s) => {
        s.meals.push({ id: Date.now(), date: today, ...meal });
        if (asFav) s.favorites.push({ id: Date.now() + 1, label: meal.label, kcal: meal.kcal, protein_g: meal.protein_g });
      });
    const quickAdd = (src) => commit((s) => s.meals.push({ id: Date.now(), date: today, source: "manual", ...src }));
    const delMeal = (id) => commit((s) => { s.meals = s.meals.filter((m) => m.id !== id); });
    const setWorker = (url) => commit((s) => { s.config.visionWorkerUrl = url; });

    // Adaptation (tous les 2-3 semaines, jamais sur 1 jour)
    let adapt = null;
    const wi = data.weighIns.slice().sort((a, b) => a.date.localeCompare(b.date));
    if (wi.length >= 4) {
      const last = new Date(wi[wi.length - 1].date).getTime();
      const old = wi.find((x) => new Date(x.date).getTime() >= last - 21 * 864e5) || wi[0];
      const dW = wi[wi.length - 1].weightKg - old.weightKg;
      if (Math.abs(dW) < 0.4)
        adapt = "Poids stable depuis ~3 semaines : la semaine prochaine, vise systématiquement le bas de ta fourchette (" + cal.low + " kcal).";
    }

    return (
      <div className="stack">
        <div className="rise">
          <div className="kicker">Recomposition · 2 cibles</div>
          <h1 className="title">Nutrition</h1>
        </div>

        {/* Habitude de la semaine */}
        <div className="habit rise" style={{ animationDelay: ".03s" }}>
          <span className="dot" />Habitude en cours : <b>atteindre tes protéines</b>. Une seule à la fois.
        </div>

        {/* Indicateur quotidien : protéines oui/non */}
        <div className={"panel daily rise " + (hit ? "hit" : "")} style={{ animationDelay: ".06s" }}>
          <div className="row">
            <div>
              <div className="kicker">Protéines aujourd'hui</div>
              <div className="readout big" style={{ color: hit ? "var(--mint)" : "var(--ink)" }}>
                {r0(sumP)}<span className="unit">/ {target} g</span>
              </div>
            </div>
            <div className={"seal " + (hit ? "on" : "")}>{hit ? "✓" : pct + "%"}</div>
          </div>
          <div className="bar"><span style={{ width: pct + "%" }} /></div>
          <div className="row" style={{ marginTop: 12 }}>
            <span className="kicker">Calories · fourchette</span>
            <span className="mono">{r0(sumK)} <span className="faint">/ {cal.low}–{cal.high}</span></span>
          </div>
        </div>

        {adapt && (
          <div className="guard rise"><span>↻</span><span>{adapt}</span></div>
        )}

        {/* Scan */}
        {data.config.visionWorkerUrl
          ? <div className="rise"><ScanBlock workerUrl={data.config.visionWorkerUrl}
              onResult={(rsp) => setSeed({ label: rsp.label || "Repas scanné", kcal: rsp.kcal ?? "", protein_g: rsp.protein_g ?? "", confidence: rsp.confidence, note: rsp.note })} /></div>
          : <div className="rise"><ScanSetup url={data.config.visionWorkerUrl} onSave={setWorker} /></div>}

        {/* Formulaire (manuel ou confirmation de scan) */}
        <div className="rise"><AddForm seed={seed} onAdd={addMeal} onClear={() => setSeed(null)} /></div>

        {/* Ajout rapide : favoris + sources protéines */}
        <div className="panel rise">
          {data.favorites.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>Tes favoris</div>
              <div className="chips">
                {data.favorites.map((fv) => (
                  <button key={fv.id} className="chip" onClick={() => quickAdd(fv)}>
                    {fv.label} <em>{fv.protein_g}g</em></button>
                ))}
              </div>
            </div>
          )}
          <div className="kicker" style={{ marginBottom: 8 }}>Sources de protéines (un tap)</div>
          <div className="chips">
            {SOURCES.map((src) => (
              <button key={src.label} className="chip" onClick={() => quickAdd(src)}>
                {src.label} <em>{src.protein_g}g</em></button>
            ))}
          </div>
        </div>

        {/* Journal du jour */}
        <div className="panel rise">
          <div className="kicker" style={{ marginBottom: 10 }}>Aujourd'hui ({todayMeals.length})</div>
          {todayMeals.length === 0 && <p className="faint small">Rien encore. Commence par une source de protéines.</p>}
          {todayMeals.map((m) => (
            <div className="meal" key={m.id}>
              <div>
                <div className="meal-l">{m.label} {m.source === "scan" && <span className="tag">scan</span>}</div>
                <div className="meal-s mono">{m.kcal} kcal · {m.protein_g} g</div>
              </div>
              <button className="x" onClick={() => delMeal(m.id)}>×</button>
            </div>
          ))}
        </div>

        {data.config.visionWorkerUrl && (
          <button className="btn ghost" onClick={() => setWorker("")}>Reconfigurer le scan</button>
        )}
      </div>
    );
  };
})();
