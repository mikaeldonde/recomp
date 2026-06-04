/* ============================================================
   session.js — Onglet Séance (phase 2)
   1) Check-in d'entrée → MODE (standard / allégé)
   2) Séance du jour : vrais exos depuis la bibliothèque fermée,
      logging charge/reps/douleur, marquage kiné par exo.
   3) Fin de séance → moteur AU MÉRITE → récap des paliers.
   Dépend de : window.LIB, window.TEMPLATES, window.DB, window.UI.
   ============================================================ */
(function () {
  const { useState } = React;
  const UI = () => window.UI;

  // ---------- Helpers ----------
  // Résout la séance du jour : applique les "à bannir" (saute au candidat
  // suivant pour la force ; retire pour réveil/core/retour).
  function resolveTemplate(idx, status) {
    const t = TEMPLATES[((idx % 3) + 3) % 3];
    const keep = (ids) => ids.filter((id) => status[id] !== "ban");
    const force = t.force.map((slot) => ({
      pattern: slot.pattern,
      id: slot.cand.find((c) => status[c] !== "ban") || null,
    }));
    return { key: t.key, reveil: keep(t.reveil), core: keep(t.core), force, retour: keep(t.retour) };
  }

  function prescriptionOf(exo, cur) {
    if (exo.type === "time") return cur.target + " s";
    let s = cur.target + " rép";
    if (exo.loadable) s += cur.load > 0 ? " · " + cur.load + " kg" : " · poids du corps";
    return s;
  }

  const STATUS_META = {
    todo:  { s: "todo",  label: "à valider" },
    ok:    { s: "ok",    label: "validé" },
    adapt: { s: "adapt", label: "à adapter" },
    ban:   { s: "ban",   label: "à bannir" },
  };
  function statusKey(v) { return v || "todo"; }
  function nextStatus(v) {
    return v == null ? "ok" : v === "ok" ? "adapt" : v === "adapt" ? "ban" : undefined;
  }

  const PAIN = ["Dos OK", "A tiré", "A fait mal"];

  // ============================================================
  //  Check-in
  // ============================================================
  const QUESTIONS = [
    { id: "dos",     label: "Dos",     opts: ["Neutre", "Tendu", "Douleur"] },
    { id: "genou",   label: "Genou",   opts: ["OK", "Sensible", "Douleur"] },
    { id: "energie", label: "Énergie", opts: ["Bonne", "Moyenne", "Basse"] },
    { id: "nuit",    label: "Nuit",    opts: ["Correcte", "Moyenne", "Mauvaise"] },
  ];
  function decideMode(a) {
    if (a.dos === 2 || a.genou === 2)
      return { mode: "allege", reason: "Douleur signalée — séance allégée. Technique avant tout, on ne charge pas." };
    const score = (a.dos || 0) + (a.genou || 0) + (a.energie || 0) + (a.nuit || 0);
    if (score >= 3) return { mode: "allege", reason: "Plusieurs signaux moyens — on allège la dose aujourd'hui." };
    return { mode: "standard", reason: "Tous les voyants au vert — séance standard." };
  }

  function CheckIn({ initial, onValidate }) {
    const u = UI();
    const [a, setA] = useState(initial || {});
    const complete = QUESTIONS.every((q) => a[q.id] !== undefined);
    const verdict = complete ? decideMode(a) : null;
    return (
      <div className="stack">
        <div className="rise">
          <div className="kicker">Avant de commencer</div>
          <h1 className="title">Check-in</h1>
          <p className="muted small" style={{ marginTop: 6 }}>
            Quatre signaux rapides. Ils règlent la dose du jour — pas une note, une protection.
          </p>
        </div>
        <div className="panel rise" style={{ animationDelay: ".06s" }}>
          {QUESTIONS.map((q) => (
            <div className="field" key={q.id} style={{ marginBottom: 18 }}>
              <label>{q.label}</label>
              <u.Seg options={q.opts} value={a[q.id]} severity
                     onChange={(i) => setA({ ...a, [q.id]: i })} />
            </div>
          ))}
        </div>
        {verdict && (
          <div className="panel rise" style={{ animationDelay: ".12s" }}>
            <div className="row"><span className="kicker">Dose du jour</span>
              <u.ModeBadge mode={verdict.mode} /></div>
            <p className="muted small" style={{ marginTop: 10 }}>{verdict.reason}</p>
          </div>
        )}
        <button className="btn primary" disabled={!complete}
                style={{ opacity: complete ? 1 : 0.4 }}
                onClick={() => onValidate(a, verdict)}>Lancer la séance</button>
      </div>
    );
  }

  // ============================================================
  //  Carte d'exercice loggable (force / stabilité)
  // ============================================================
  function ExoCard({ id, exo, cur, mode, status, banned, log, onLog, onStatus }) {
    const u = UI();
    const meta = STATUS_META[statusKey(status)];
    if (banned) {
      return (
        <div className="exo banned">
          <div className="top">
            <div><div className="nm">{exo.name}</div><div className="pat">{exo.pattern}</div></div>
            <button className="status" data-s="ban" onClick={() => onStatus(id)}>à bannir</button>
          </div>
          <p className="small faint" style={{ marginTop: 6 }}>Banni — aucun candidat de remplacement libre sur ce créneau. À revoir avec le kiné.</p>
        </div>
      );
    }
    const adapt = status === "adapt";
    const useAllege = mode === "allege" || adapt;
    const eff = log || { load: cur.load, value: cur.target };
    const painSet = log && log.pain !== undefined;

    return (
      <div className="exo">
        <div className="top">
          <div>
            <div className="nm">{exo.name}</div>
            <div className="pat">{exo.pattern}{useAllege ? " · variante allégée" : ""}</div>
          </div>
          <button className="status" data-s={meta.s} onClick={() => onStatus(id)}>{meta.label}</button>
        </div>

        <div className="rx">
          <span className="k">Cible</span>
          <span className="v">{prescriptionOf(exo, cur)}</span>
        </div>

        <div className="cue">{useAllege ? exo.allege : exo.std}</div>
        {exo.caution && <div className="caution"><span>⚠</span><span>{exo.caution}</span></div>}

        <div className="controls">
          {exo.loadable && (
            <div>
              <div className="lab">Charge (kg)</div>
              <u.Stepper value={eff.load} step={exo.loadStep || 1}
                         onChange={(v) => onLog({ ...eff, load: v })} />
            </div>
          )}
          <div style={exo.loadable ? null : { gridColumn: "1 / -1" }}>
            <div className="lab">{exo.type === "time" ? "Tenu (s)" : "Réps faites"}</div>
            <u.Stepper value={eff.value} step={exo.step || 1} min={0}
                       suffix={exo.type === "time" ? "s" : null}
                       onChange={(v) => onLog({ ...eff, value: v })} />
          </div>
        </div>

        <div className="pain">
          <div className="lab" style={{ fontFamily: "var(--f-mono)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: painSet ? "var(--ink-3)" : "var(--amber)", marginBottom: 5 }}>
            Retour du dos {painSet ? "" : "· requis"}
          </div>
          <u.Seg options={PAIN} value={log ? log.pain : undefined} severity
                 onChange={(i) => onLog({ ...eff, pain: i })} />
        </div>
      </div>
    );
  }

  function DoneRow({ exo, on, onToggle }) {
    return (
      <div className="done-row" data-on={on} onClick={onToggle}>
        <div className="check">{on ? "✓" : ""}</div>
        <div className="dn">{exo.name}<div className="sub">{exo.std}</div></div>
      </div>
    );
  }

  // ============================================================
  //  Récap de fin de séance (paliers au mérite)
  // ============================================================
  const STATUS_SYMBOL = { up: "↑", hold: "=", block: "⤓", graduate: "★" };
  function fmtNext(exo, p) {
    if (exo.type === "time") return p.target + " s";
    let s = p.target + " rép";
    if (exo.loadable) s += p.load > 0 ? " · " + p.load + " kg" : " · PdC";
    return s;
  }
  function Recap({ results, mode, onClose }) {
    return (
      <div className="stack">
        <div className="rise">
          <div className="kicker">Séance enregistrée</div>
          <h1 className="title">Au mérite</h1>
          <p className="muted small" style={{ marginTop: 6 }}>
            Ce qui se débloque pour la prochaine fois. Le dos a le dernier mot.
          </p>
        </div>
        <div className="panel rise" style={{ animationDelay: ".05s" }}>
          {results.map((r) => (
            <div className={"recap-row " + r.status} key={r.id}>
              <span className="badge-st">{STATUS_SYMBOL[r.status]}</span>
              <div>
                <div className="rc-nm">{r.name}</div>
                <div className="rc-msg">{r.msg}</div>
                <div className="rc-next">prochaine fois : {fmtNext(r.exo, r.next)}</div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn primary" onClick={onClose}>Terminé</button>
      </div>
    );
  }

  // ============================================================
  //  Plan de séance (le cœur)
  // ============================================================
  function SessionPlan({ data, commit, checkin, onRedo, onCommitted, onClose }) {
    const u = UI();
    const today = DB.todayKey();
    const idx = data.nextTemplate || 0;
    const mode = checkin.mode;
    const plan = resolveTemplate(idx, data.exerciseStatus);

    const [log, setLog] = useState({});     // {id:{load,value,pain}}
    const [done, setDone] = useState({});    // {id:true}
    const [recap, setRecap] = useState(null);

    if (recap) return <Recap results={recap} mode={mode} onClose={onClose} />;

    const curOf = (id) => data.progression[id] || DB.merit.init(LIB[id]);
    const loggedIds = [
      ...plan.core,
      ...plan.force.filter((f) => f.id).map((f) => f.id),
    ];
    const ready = loggedIds.every((id) => log[id] && log[id].pain !== undefined);

    const setStatus = (id) =>
      commit((s) => {
        const nx = nextStatus(s.exerciseStatus[id]);
        if (nx === undefined) delete s.exerciseStatus[id];
        else s.exerciseStatus[id] = nx;
      });

    const finish = () => {
      const results = [];
      commit((s) => {
        const prog = { ...s.progression };
        const entries = [];
        loggedIds.forEach((id) => {
          const exo = LIB[id];
          const cur = prog[id] || DB.merit.init(exo);
          const l = log[id] || { load: cur.load, value: cur.target, pain: 0 };
          const pain = ["ok", "tire", "mal"][l.pain ?? 0];
          const nx = DB.merit.next(exo, cur, { pain, value: l.value, load: l.load });
          prog[id] = { load: nx.load, target: nx.target };
          entries.push({ exerciseId: id, role: exo.role, load: exo.loadable ? l.load : undefined, value: l.value, pain });
          results.push({ id, name: exo.name, exo, status: nx.status, msg: nx.msg, next: { load: nx.load, target: nx.target } });
        });
        [...plan.reveil, ...plan.retour].forEach((id) => {
          if (done[id]) entries.push({ exerciseId: id, role: LIB[id].role, done: true });
        });
        s.sessions.push({ id: Date.now(), date: today, mode, template: plan.key, checkin: s.lastCheckin, entries });
        s.progression = prog;
        s.nextTemplate = (idx + 1) % 3;
      });
      onCommitted();
      setRecap(results);
    };

    const Block = ({ n, name, time, anchor, children }) => (
      <div className="panel rise" style={{ animationDelay: 0.05 * n + "s" }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 className="section">
            <span style={{ fontFamily: "var(--f-mono)", color: anchor ? "var(--amber)" : "var(--mint)", marginRight: 8 }}>{n}</span>{name}
          </h2>
          <span className="time mono small">{time}</span>
        </div>
        {children}
      </div>
    );

    return (
      <div className="stack">
        <div className="rise">
          <div className="row">
            <div><div className="kicker">Séance · modèle {plan.key}</div>
              <h1 className="title">Aujourd'hui</h1></div>
            <u.ModeBadge mode={mode} />
          </div>
        </div>

        {mode === "allege" && (
          <div className="guard rise"><span>⚠</span>
            <span>Mode allégé : chaque exo bascule sur sa version adaptée. On garde le mouvement, on retire la contrainte.</span></div>
        )}

        <Block n={1} name="Réveil articulaire" time="≈ 3 min">
          <div className="done-list">
            {plan.reveil.map((id) => (
              <DoneRow key={id} exo={LIB[id]} on={!!done[id]}
                       onToggle={() => setDone({ ...done, [id]: !done[id] })} />
            ))}
          </div>
        </Block>

        <Block n={2} name="Stabilité du tronc" time="≈ 4 min" anchor>
          {plan.core.map((id) => (
            <ExoCard key={id} id={id} exo={LIB[id]} cur={curOf(id)} mode={mode}
                     status={data.exerciseStatus[id]} log={log[id]}
                     onLog={(v) => setLog({ ...log, [id]: v })} onStatus={setStatus} />
          ))}
        </Block>

        <Block n={3} name="Bloc force" time="≈ 8–10 min">
          {plan.force.map((f) => (
            <ExoCard key={f.pattern} id={f.id} exo={f.id ? LIB[f.id] : { name: f.pattern, pattern: f.pattern }}
                     cur={f.id ? curOf(f.id) : { load: 0, target: 0 }} mode={mode}
                     status={f.id ? data.exerciseStatus[f.id] : "ban"} banned={!f.id}
                     log={f.id ? log[f.id] : null}
                     onLog={(v) => setLog({ ...log, [f.id]: v })} onStatus={setStatus} />
          ))}
        </Block>

        <Block n={4} name="Retour au calme" time="≈ 1–2 min">
          <div className="done-list">
            {plan.retour.map((id) => (
              <DoneRow key={id} exo={LIB[id]} on={!!done[id]}
                       onToggle={() => setDone({ ...done, [id]: !done[id] })} />
            ))}
          </div>
        </Block>

        <div className="guard rise"><span>🩺</span>
          <span>Bibliothèque <b>à valider par un kiné</b>. Touche le statut d'un exo pour le marquer
            validé / à adapter / à bannir — « à adapter » force la version allégée, « à bannir » le remplace.</span></div>

        <button className="btn primary" disabled={!ready} style={{ opacity: ready ? 1 : 0.4 }}
                onClick={finish}>
          {ready ? "Terminer la séance" : "Renseigne le retour du dos de chaque exo"}
        </button>
        <button className="btn ghost" onClick={onRedo}>Refaire le check-in</button>
      </div>
    );
  }

  // ============================================================
  //  Panneau "déjà fait aujourd'hui" (au rechargement)
  // ============================================================
  function DonePanel({ data, sess }) {
    const u = UI();
    const logged = sess.entries.filter((e) => e.role === "force" || e.role === "core");
    const nextKey = TEMPLATES[(data.nextTemplate || 0) % 3].key;
    return (
      <div className="stack">
        <div className="rise">
          <div className="row"><div><div className="kicker">Aujourd'hui</div>
            <h1 className="title">Séance faite</h1></div>
            <u.ModeBadge mode={sess.mode} /></div>
        </div>
        <div className="panel rise" style={{ animationDelay: ".05s" }}>
          {logged.map((e) => {
            const exo = LIB[e.exerciseId]; const p = data.progression[e.exerciseId] || { load: 0, target: 0 };
            const painLabel = { ok: "dos OK", tire: "a tiré", mal: "a fait mal" }[e.pain];
            return (
              <div className="recap-row" key={e.exerciseId} style={{ borderTopColor: "var(--line)" }}>
                <span className="badge-st" style={{ color: e.pain === "mal" ? "var(--red)" : e.pain === "tire" ? "var(--amber)" : "var(--mint)" }}>•</span>
                <div>
                  <div className="rc-nm">{exo.name}</div>
                  <div className="rc-msg">{e.value}{exo.type === "time" ? " s" : " rép"}{e.load ? " · " + e.load + " kg" : ""} — {painLabel}</div>
                  <div className="rc-next">prochaine fois : {fmtNext(exo, p)}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="guard rise"><span>↻</span>
          <span>Prochaine séance : modèle <b>{nextKey}</b>. Reviens demain — la récupération fait partie du plan.</span></div>
      </div>
    );
  }

  // ============================================================
  //  Conteneur d'onglet
  // ============================================================
  window.Session = function Session({ data, commit }) {
    const today = DB.todayKey();
    const ci = data.lastCheckin && data.lastCheckin.date === today ? data.lastCheckin : null;
    const todaySession = data.sessions.find((s) => s.date === today);
    const [forceCheckin, setForceCheckin] = useState(false);
    const [justDone, setJustDone] = useState(false); // garde le récap visible après commit

    if (todaySession && !justDone) return <DonePanel data={data} sess={todaySession} />;

    if (!ci || forceCheckin) {
      return (
        <CheckIn initial={ci ? ci.answers : null}
          onValidate={(answers, verdict) => {
            commit((s) => { s.lastCheckin = { date: today, answers, mode: verdict.mode, reason: verdict.reason }; });
            setForceCheckin(false);
          }} />
      );
    }
    return (
      <SessionPlan data={data} commit={commit} checkin={ci}
                   onRedo={() => setForceCheckin(true)}
                   onCommitted={() => setJustDone(true)}
                   onClose={() => setJustDone(false)} />
    );
  };
})();
