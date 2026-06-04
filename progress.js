/* ============================================================
   progress.js — Onglet Progrès (phase 3) · "le carburant"
   - Poids : tendance LISSÉE (jamais la pesée quotidienne en avant)
   - Tour de taille : tendance
   - CROISEMENT charges ↗ / taille ↘ = la recomp marche (affiché net)
   - Photos mensuelles, côte à côte avec le départ, 100% locales
   Dépend de : window.DB, window.LIB, window.UI.
   ============================================================ */
(function () {
  const { useState, useEffect } = React;
  const UI = () => window.UI;

  // ---------- maths ----------
  const r1 = (n) => Math.round(n * 10) / 10;
  function ewma(vals, alpha) {
    alpha = alpha || 0.25; let s = null;
    return vals.map((v) => { s = s == null ? v : alpha * v + (1 - alpha) * s; return s; });
  }
  // signe de tendance sur les ~4 derniers points, avec zone morte
  function trendSign(arr, dead) {
    if (arr.length < 2) return 0;
    const a = arr[Math.max(0, arr.length - 4)], b = arr[arr.length - 1];
    const d = b - a;
    if (Math.abs(d) < (dead || 0)) return 0;
    return d > 0 ? 1 : -1;
  }
  function daysAgoIndex(items, days) {
    if (!items.length) return 0;
    const last = new Date(items[items.length - 1].date).getTime();
    const cut = last - days * 864e5;
    for (let i = 0; i < items.length; i++)
      if (new Date(items[i].date).getTime() >= cut) return i;
    return items.length - 1;
  }

  // indice de force par séance = Σ (charge×10 + valeur) sur les exos de force
  function strengthSeries(sessions) {
    return sessions.slice().sort((a, b) => a.date.localeCompare(b.date)).map((s) => {
      let score = 0;
      s.entries.forEach((e) => {
        if (e.role === "force") score += (e.load || 0) * 10 + (e.value || 0);
      });
      return { date: s.date, score };
    }).filter((p) => p.score > 0);
  }

  // ---------- mini-graphe SVG ----------
  function Spark({ values, color, height }) {
    color = color || "var(--mint)"; height = height || 56;
    if (!values || values.length < 2)
      return <div className="spark-empty">pas encore assez de points</div>;
    const W = 100, H = height, pad = 6;
    const min = Math.min(...values), max = Math.max(...values);
    const span = max - min || 1;
    const x = (i) => (values.length === 1 ? W / 2 : (i / (values.length - 1)) * (W - 2 * pad) + pad);
    const y = (v) => H - pad - ((v - min) / span) * (H - 2 * pad);
    const pts = values.map((v, i) => [x(i), y(v)]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const area = line + " L" + pts[pts.length - 1][0].toFixed(1) + " " + H + " L" + pts[0][0].toFixed(1) + " " + H + " Z";
    const gid = "g" + Math.random().toString(36).slice(2, 7);
    const last = pts[pts.length - 1];
    return (
      <svg className="spark" viewBox={"0 0 " + W + " " + H} preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={"url(#" + gid + ")"} />
        <path d={line} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />
      </svg>
    );
  }

  // bandeau de tendance (valeur + delta fléché)
  function Trend({ label, value, unit, delta, deltaColor, sub }) {
    const arrow = delta == null ? "" : delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
    return (
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div>
          <div className="kicker">{label}</div>
          <div className="readout big" style={{ color: "var(--ink)", marginTop: 4 }}>
            {value}<span className="unit">{unit}</span>
          </div>
          {sub && <div className="faint small" style={{ marginTop: 2 }}>{sub}</div>}
        </div>
        {delta != null && (
          <div className="mono" style={{ color: deltaColor || "var(--ink-2)", fontSize: 15, textAlign: "right" }}>
            {arrow} {delta > 0 ? "+" : ""}{r1(delta)}{unit}
            <div className="faint" style={{ fontSize: 10, letterSpacing: ".1em" }}>21 J</div>
          </div>
        )}
      </div>
    );
  }

  // ---------- mini-formulaire d'ajout (poids / taille) ----------
  function QuickLog({ placeholder, step, unit, onSave }) {
    const [v, setV] = useState("");
    const save = () => { const n = Number(v); if (n > 0) { onSave(n); setV(""); } };
    return (
      <div className="quicklog">
        <input type="number" step={step} value={v} placeholder={placeholder}
               onChange={(e) => setV(e.target.value)} />
        <button className="btn primary" style={{ width: "auto", padding: "12px 18px" }}
                onClick={save}>Enregistrer</button>
      </div>
    );
  }

  // ============================================================
  //  Section Photos (locale, IndexedDB)
  // ============================================================
  function Photos() {
    const [photos, setPhotos] = useState(null);
    const load = () =>
      DB.photos.list().then((ps) => {
        ps.sort((a, b) => a.id - b.id);
        ps.forEach((p) => { p.url = URL.createObjectURL(p.blob); });
        setPhotos(ps);
      }).catch(() => setPhotos([]));
    useEffect(() => { load(); return () => { (photos || []).forEach((p) => p.url && URL.revokeObjectURL(p.url)); }; }, []);

    const onPick = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      DB.photos.add({ id: Date.now(), date: DB.todayKey(), blob: file }).then(load);
      e.target.value = "";
    };
    const delOne = (id) => { if (confirm("Supprimer cette photo ?")) DB.photos.del(id).then(load); };

    const AddBtn = ({ label, wide }) => (
      <label className={"photo-add" + (wide ? " wide" : "")}>
        <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onPick} />
        <span>＋</span><span className="small">{label}</span>
      </label>
    );

    if (photos === null) return <div className="faint small">Chargement…</div>;

    const start = photos[0], latest = photos[photos.length - 1];
    return (
      <div>
        {photos.length === 0 && (
          <div>
            <p className="muted small" style={{ marginBottom: 12 }}>
              Première photo = ton point de départ. Toujours affichée à côté des suivantes.
            </p>
            <AddBtn label="Photo de départ" wide />
          </div>
        )}

        {photos.length >= 1 && (
          <div className="photo-pair">
            <figure>
              <img src={start.url} alt="départ" />
              <figcaption>Départ · {start.date}</figcaption>
            </figure>
            {photos.length >= 2 ? (
              <figure>
                <img src={latest.url} alt="récent" onClick={() => delOne(latest.id)} />
                <figcaption>{latest.date}</figcaption>
              </figure>
            ) : (
              <AddBtn label="Photo du mois" />
            )}
          </div>
        )}

        {photos.length >= 2 && (
          <div style={{ marginTop: 12 }}><AddBtn label="Nouvelle photo" wide /></div>
        )}

        <div className="guard" style={{ marginTop: 14 }}>
          <span>🔒</span>
          <span>Stockées uniquement sur cet appareil. Aucun cloud, jamais. Fréquence conseillée : mensuelle.</span>
        </div>
      </div>
    );
  }

  // ============================================================
  //  Onglet Progrès
  // ============================================================
  window.Progress = function Progress({ data, commit }) {
    const today = DB.todayKey();

    // --- séries ---
    const wi = data.weighIns.slice().sort((a, b) => a.date.localeCompare(b.date));
    const wRaw = wi.map((x) => x.weightKg);
    const wSm = ewma(wRaw);
    const wa = data.waist.slice().sort((a, b) => a.date.localeCompare(b.date));
    const waVals = wa.map((x) => x.cm);
    const str = strengthSeries(data.sessions);
    const strVals = str.map((x) => x.score);

    // --- deltas (21 j) ---
    const wIdx = daysAgoIndex(wi, 21);
    const wDelta = wSm.length >= 2 ? wSm[wSm.length - 1] - wSm[wIdx] : null;
    const aIdx = daysAgoIndex(wa, 21);
    const aDelta = waVals.length >= 2 ? waVals[waVals.length - 1] - waVals[aIdx] : null;

    // --- croisement ---
    const sStr = trendSign(strVals, 0);
    const sWaist = trendSign(waVals, 0.3);
    let verdict = { tone: "neutral", txt: "Encore quelques points (force + tour de taille) et je t'affiche le croisement." };
    if (strVals.length >= 2 && waVals.length >= 2) {
      if (sStr > 0 && sWaist < 0) verdict = { tone: "good", txt: "Charges ↗ et tour de taille ↘ : la recomposition marche. C'est exactement le signal qu'on cherche." };
      else if (sStr > 0 && sWaist === 0) verdict = { tone: "good", txt: "Force en hausse, tour de taille stable : tu construis du muscle sans prendre de ventre. Bonne direction." };
      else if (sStr > 0 && sWaist > 0) verdict = { tone: "warn", txt: "Force ↗ mais tour de taille ↗ aussi : vise le bas de ta fourchette calorique sur 2–3 semaines." };
      else if (sStr <= 0 && sWaist < 0) verdict = { tone: "warn", txt: "Le ventre descend, mais la force stagne : garde les protéines hautes pour préserver le muscle." };
      else verdict = { tone: "warn", txt: "Force et tour de taille plats : tiens les protéines, et laisse les charges monter au mérite." };
    }

    // --- enregistrements ---
    const logWeight = (kg) =>
      commit((s) => {
        const i = s.weighIns.findIndex((x) => x.date === today);
        if (i >= 0) s.weighIns[i].weightKg = kg; else s.weighIns.push({ date: today, weightKg: kg });
        // recalcul du poids de travail (lissé) → la fourchette calorique suit
        const sm = ewma(s.weighIns.slice().sort((a, b) => a.date.localeCompare(b.date)).map((x) => x.weightKg));
        if (s.profile) s.profile.weightKg = r1(sm[sm.length - 1]);
      });
    const logWaist = (cm) =>
      commit((s) => {
        const i = s.waist.findIndex((x) => x.date === today);
        if (i >= 0) s.waist[i].cm = cm; else s.waist.push({ date: today, cm });
      });

    return (
      <div className="stack">
        <div className="rise">
          <div className="kicker">Section 3 · calculé</div>
          <h1 className="title">Progrès</h1>
        </div>

        {/* LE CROISEMENT — la pièce maîtresse */}
        <div className={"panel cross " + verdict.tone + " rise"} style={{ animationDelay: ".04s" }}>
          <div className="kicker" style={{ marginBottom: 12 }}>Le croisement</div>
          <div className="cross-grid">
            <div>
              <div className="cross-lbl">Charges
                <b className={sStr > 0 ? "up" : sStr < 0 ? "down" : ""}>{sStr > 0 ? "↗" : sStr < 0 ? "↘" : "→"}</b>
              </div>
              <Spark values={strVals} color="var(--mint)" height={44} />
            </div>
            <div>
              <div className="cross-lbl">Tour de taille
                <b className={sWaist < 0 ? "up" : sWaist > 0 ? "down" : ""}>{sWaist > 0 ? "↗" : sWaist < 0 ? "↘" : "→"}</b>
              </div>
              <Spark values={waVals} color="var(--amber)" height={44} />
            </div>
          </div>
          <p className="cross-verdict">{verdict.txt}</p>
        </div>

        {/* POIDS */}
        <div className="panel rise" style={{ animationDelay: ".08s" }}>
          <Trend label="Poids · tendance lissée"
                 value={wSm.length ? r1(wSm[wSm.length - 1]) : "—"} unit={wSm.length ? " kg" : ""}
                 delta={wDelta} deltaColor="var(--ink-2)"
                 sub={data.profile ? "cible " + data.profile.targetWeightKg + " kg" : null} />
          <div style={{ margin: "12px 0" }}><Spark values={wSm} color="var(--mint)" /></div>
          <QuickLog placeholder="Poids du jour (kg)" step="0.1" onSave={logWeight} />
          <p className="faint small" style={{ marginTop: 8 }}>
            Pèse-toi quand tu veux : c'est la courbe lissée qui parle, pas le chiffre du jour.
          </p>
        </div>

        {/* TOUR DE TAILLE */}
        <div className="panel rise" style={{ animationDelay: ".12s" }}>
          <Trend label="Tour de taille"
                 value={waVals.length ? r1(waVals[waVals.length - 1]) : "—"} unit={waVals.length ? " cm" : ""}
                 delta={aDelta} deltaColor={aDelta == null ? "var(--ink-2)" : aDelta < 0 ? "var(--mint)" : aDelta > 0 ? "var(--amber)" : "var(--ink-2)"} />
          <div style={{ margin: "12px 0" }}><Spark values={waVals} color="var(--amber)" /></div>
          <QuickLog placeholder="Tour de taille (cm)" step="0.5" onSave={logWaist} />
        </div>

        {/* PHOTOS */}
        <div className="panel rise" style={{ animationDelay: ".16s" }}>
          <h2 className="section" style={{ marginBottom: 12 }}>Photos d'évolution</h2>
          <Photos />
        </div>
      </div>
    );
  };
})();
