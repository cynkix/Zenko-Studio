import React, { useEffect, useRef, useState } from 'react';
import { Ic } from './icons.jsx';
import { interp, hasValue, progressOf, fmt } from './engine.js';

export const PW = 340, PH = 700;
const arr = (v) => (Array.isArray(v) ? v : []);

export function FitBox({ w, h, max = 1, children }) {
  const ref = useRef(null); const [s, setS] = useState(1);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const calc = () => { const r = el.getBoundingClientRect(); setS(Math.max(0.3, Math.min(max, r.width / w, r.height / h))); };
    calc(); const ro = new ResizeObserver(calc); ro.observe(el); return () => ro.disconnect();
  }, [w, h, max]);
  return <div ref={ref} className="fit"><div className="fit-in" style={{ width: w, height: h, transform: `translate(-50%,-50%) scale(${s})` }}>{children}</div></div>;
}

function Sign({ onInk }) {
  const cv = useRef(null); const st = useRef({ d: false, inked: false });
  useEffect(() => {
    const c = cv.current; const r = c.getBoundingClientRect(); c.width = r.width; c.height = r.height;
    const x = c.getContext('2d'); x.lineWidth = 2.4; x.lineCap = 'round'; x.strokeStyle = getComputedStyle(c).color;
    const pos = (e) => { const b = c.getBoundingClientRect(); return [(e.clientX - b.left) * (c.width / b.width), (e.clientY - b.top) * (c.height / b.height)]; };
    const down = (e) => { st.current.d = true; x.beginPath(); x.moveTo(...pos(e)); c.setPointerCapture(e.pointerId); if (!st.current.inked) { st.current.inked = true; onInk(); } };
    const move = (e) => { if (!st.current.d) return; x.lineTo(...pos(e)); x.stroke(); };
    const up = () => { st.current.d = false; };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up);
    c.clear = () => x.clearRect(0, 0, c.width, c.height);
    return () => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); };
  }, []);
  return <><div className="pf-sign"><canvas ref={cv} /></div>
    <div className="pf-row"><span className="pf-mut">Signez dans le cadre</span><button className="pf-lnk" onClick={() => cv.current.clear()}>Effacer</button></div></>;
}

function Field({ e, t, api }) {
  const s = t.screen; const n = s.node.data; const I = (x) => interp(e, t, s, x);
  const v = e.data[s.key]; const set = (val) => api.set(s.key, val);
  const opts = n.options || [];
  switch (n.input) {
    case 'text': return <textarea className="pf-in" rows={4} placeholder={n.placeholder || ''} value={v || ''} onChange={(ev) => set(ev.target.value)} />;
    case 'number': return <><div className="pf-num"><button onClick={() => set((+v || 0) - 1)} aria-label="Moins">–</button><input type="number" value={v ?? ''} onChange={(ev) => set(ev.target.value === '' ? '' : +ev.target.value)} /><button onClick={() => set((+v || 0) + 1)} aria-label="Plus">+</button></div>{n.unit && <div className="pf-unit">{n.unit}</div>}</>;
    case 'date': return <input type="date" className="pf-in" value={v || ''} onChange={(ev) => set(ev.target.value)} />;
    case 'single': return <div className="pf-list">{opts.map((o) => <button key={o} className={'pf-opt' + (v === o ? ' on' : '')} onClick={() => set(o)}>{o}</button>)}</div>;
    case 'multi': { const sel = arr(v); return <div className="pf-grid">{opts.map((o) => <button key={o} className={'pf-opt' + (sel.includes(o) ? ' on' : '')} onClick={() => set(sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o])}>{o}</button>)}</div>; }
    case 'collect': return <Collect n={n} v={arr(v)} set={set} />;
    case 'slider': return <><input type="range" className="pf-range" min="0" max="100" step="5" value={v ?? 0} onChange={(ev) => set(+ev.target.value)} /><div className="pf-big">{v ?? 0}<span>{n.unit}</span></div></>;
    case 'stars': return <div className="pf-stars">{[1, 2, 3, 4, 5].map((i) => <button key={i} className={i <= (v || 0) ? 'on' : ''} onClick={() => set(i)} aria-label={`${i} étoiles`}><Ic n="star" s={30} /></button>)}</div>;
    case 'photo': return v ? <div className="pf-ok"><Ic n="check" s={34} sw={2.4} /><span>photo-{String(s.key).length * 37 % 900 + 100}.jpg · en file d’envoi</span></div>
      : <button className="pf-drop" onClick={() => set(true)}><Ic n="camera" s={34} /><span>Appuyer pour photographier</span></button>;
    case 'code': return v ? <div className="pf-ok"><Ic n="check" s={34} sw={2.4} /><span>Scanné <b>{v}</b></span></div>
      : <><div className="pf-scan"><i /><b>Code-barres · QR</b></div><button className="pf-btn2" onClick={() => set('5449000000996')}><Ic n="scan" s={16} /> Simuler un scan</button></>;
    case 'geo': return v ? <><div className="pf-map" /><div className="pf-mono">{v}</div></> : <><div className="pf-map dim" /><button className="pf-btn2" onClick={() => set('50.7169° N, 4.6089° E · ±8 m')}><Ic n="pin" s={16} /> Capturer la position</button></>;
    case 'signature': return <Sign key={s.key} onInk={() => set(true)} />;
    default: return null;
  }
}

function Collect({ n, v, set }) {
  const [x, setX] = useState('');
  const opts = n.options || []; const extra = v.filter((o) => !opts.includes(o));
  const tog = (o) => set(v.includes(o) ? v.filter((y) => y !== o) : [...v, o]);
  const add = () => { const val = x.trim(); if (!val) return; if (!v.includes(val)) set([...v, val]); setX(''); };
  return <><div className="pf-chips">{opts.map((o) => <button key={o} className={'pf-opt sm' + (v.includes(o) ? ' on' : '')} onClick={() => tog(o)}>{o}</button>)}
    {extra.map((o) => <button key={o} className="pf-opt sm on" onClick={() => tog(o)}>{o} ✕</button>)}</div>
    {n.allowOther && <div className="pf-join"><input className="pf-in" placeholder="Autre, à ajouter…" value={x} onChange={(ev) => setX(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && add()} /><button className="pf-btn2" onClick={add}>Ajouter</button></div>}
    <div className="pf-mut mt">{v.length ? `${v.length} sélectionné(s) · un passage chacun` : 'Choisissez dans la liste ou ajoutez le vôtre'}</div></>;
}

function Summary({ e, t }) {
  const s = t.screen; const n = s.node.data; const items = arr(e.data[n.from]);
  return <><h1 className="pf-h">{interp(e, t, s, n.label)}</h1><p className="pf-help">Relisez chaque élément avec la personne concernée, puis passez à la signature.</p>
    <div className="pf-cards">{items.length ? items.map((it) => <div className="pf-card" key={it}><div className="pf-card-h"><b>{it}</b><span className="pf-done"><Ic n="check" s={11} sw={3} />fait</span></div>
      {(n.fields || []).map((f) => { let val = e.data[`${it}:${f.key}`]; val = Array.isArray(val) ? (val.length ? val.join(', ') : '—') : val == null || val === '' ? '—' : val; return <div className="pf-kv" key={f.key}><span>{f.label}</span><span>{String(val)}</span></div>; })}</div>)
      : <div className="pf-mut c">Rien à relire pour l’instant.</div>}</div></>;
}

export function Phone({ e, t, api, onDone, header = true }) {
  const s = t.screen; const root = e.wfs[e.rootId];
  const [ask, setAsk] = useState(false); // false | true (retour) | 'pause'
  let body, foot = null;
  if (t.status === 'wait') {
    const others = e.threads.filter((k) => k.parent === t.parent && k.id !== t.id && k.status !== 'wait');
    body = <div className="pf-center"><div className="pf-spin" /><h1 className="pf-h">Branche « {t.label} » terminée</h1>
      <p className="pf-help">{others.length ? <>En attente de : <b>{others.map((o) => o.label).join(', ')}</b>.</> : 'Presque terminé…'}</p></div>;
  } else if (s && s.complete) {
    body = <div className="pf-center"><div className="pf-badge"><Ic n="check" s={32} sw={2.4} /></div><h1 className="pf-h">{root.noun} terminée</h1><p className="pf-help">Enregistrée sur l’appareil. Synchronisation dès le retour du réseau.</p>
      <div className="pf-card" style={{ width: '100%' }}><div className="pf-kv"><span>Statut</span><span className="pf-warn">En attente de sync</span></div><div className="pf-kv"><span>Saisies</span><span>{Object.keys(e.data).filter((k) => !k.startsWith('__')).length} valeurs</span></div></div></div>;
    foot = <div className="pf-row">{t.hist.length > 0 && <button className="pf-back" onClick={() => setAsk(true)}><Ic n="left" s={16} />Corriger</button>}<button className="pf-cta" onClick={onDone || api.restart}>{onDone ? 'Retour à ma boîte' : 'Rejouer'}</button></div>;
  } else if (s) {
    const n = s.node.data; const I = (x) => interp(e, t, s, x);
    const blocked = n.kind === 'input' && n.required && !hasValue(e.data[s.key]);
    if (n.kind === 'info') body = <div className="pf-center"><div className="pf-badge soft"><Ic n="info" s={26} /></div><h1 className="pf-h">{I(n.label)}</h1><p className="pf-help">{I(n.body)}</p></div>;
    else if (n.kind === 'summary') body = <Summary e={e} t={t} />;
    else body = <div className="pf-field"><h1 className="pf-h">{I(n.label)}</h1>
      <div className="pf-meta">{n.required ? <span className="req">● Obligatoire</span> : <span>○ Facultatif</span>}{n.def !== undefined && <span>valeur par défaut, touchez pour changer</span>}</div>
      {n.help && <p className="pf-help">{I(n.help)}</p>}<div className="pf-body"><Field e={e} t={t} api={api} /></div></div>;
    foot = <div className="pf-row">{t.hist.length > 0 && <button className="pf-back" onClick={() => setAsk(true)} aria-label="Revenir à l’écran précédent : vos réponses sont conservées"><Ic n="left" s={16} />Retour</button>}<button className={'pf-cta' + (blocked ? ' off' : '')} disabled={blocked} onClick={() => api.submit(t)}>{n.kind === 'info' ? 'Continuer' : n.kind === 'summary' ? 'Tout est juste' : n.required ? 'Suivant' : 'Suivant / passer'}</button></div>;
  }
  const p = progressOf(e, t);
  return <div className="phone" style={{ '--tc': t.color }}>
    <div className="ph-notch" />
    <div className="ph-top">
      <div className="ph-ttl"><b>{s && s.item ? s.item : root.title}</b><span>{s && s.item ? root.title : root.subtitle}</span></div>
      {s && s.loopTotal ? <span className="ph-loop">{s.node ? '' : ''}{s.loopIdx}/{s.loopTotal}</span> : null}
      {t.letter && <span className="ph-br">{t.letter}</span>}
      {onDone && !(s && s.complete) && <button className="ph-pause" onClick={() => setAsk('exit')} aria-label="Quitter le workflow" title="Quitter le workflow"><Ic n="x" s={16} /></button>}
    </div>
    <div className="ph-prog"><i style={{ width: (s && s.complete ? 100 : p) + '%' }} /></div>
    <div className="ph-body">{body}</div>
    {foot && <div className="ph-foot">{foot}</div>}
    {ask === 'exit' && <div className="pf-sheet" role="alertdialog" aria-label="Quitter le workflow"><div className="pf-sheet-in">
      <b>Quitter ce workflow ?</b><p>Vos réponses sont conservées sur l’appareil. Vous pourrez le reprendre depuis « Mes tâches ».</p>
      <button className="pf-cta" onClick={() => { setAsk(false); onDone(); }}>Mettre en pause et quitter</button>
      <button className="pf-back full" onClick={() => setAsk(false)}>Continuer le workflow</button></div></div>}
    {(ask === true) && <div className="pf-sheet" role="alertdialog" aria-label="Confirmer le retour"><div className="pf-sheet-in">
      <b>Revenir à l’écran précédent ?</b><p>Vos réponses sont conservées. Vous pourrez les modifier puis continuer.</p>
      <button className="pf-cta" onClick={() => { setAsk(false); api.back(t); }}>Oui, revenir</button>
      <button className="pf-back full" onClick={() => setAsk(false)}>Non, rester ici</button></div></div>}
  </div>;
}

export function PlayStage({ e, api, solo, onDone, tabKey }) {
  const [tab, setTab] = useState(null);
  const vis = e.threads.filter((t) => t.status !== 'parked');
  const gap = 28;
  if (!vis.length) return null;
  if (solo || vis.length === 1) {
    const cur = vis.find((t) => t.id === tab) || vis.find((t) => t.status === 'run') || vis[0];
    return <div className="stage-col">
      {vis.length > 1 && <div className="tabs" role="tablist">{vis.map((t) => <button key={t.id} role="tab" aria-selected={t.id === cur.id} className={t.id === cur.id ? 'on' : ''} style={{ '--tc': t.color }} onClick={() => setTab(t.id)}><i>{t.letter}</i>{t.label}<em>{t.status === 'wait' ? 'prête' : t.screen && t.screen.complete ? 'finie' : 'en cours'}</em></button>)}</div>}
      <div className="stage-fit"><FitBox w={PW + 20} h={PH + 20}><Phone e={e} t={cur} api={api} onDone={onDone} /></FitBox></div>
    </div>;
  }
  const cols = Math.min(vis.length, 4); const rows = Math.ceil(vis.length / cols);
  const w = cols * PW + (cols - 1) * gap;
  return <div className="stage-col"><div className="stage-fit"><FitBox w={w + 20} h={rows * (PH + 60) + (rows - 1) * 20}>
    <div className="phones" style={{ gap, flexWrap: 'wrap', alignContent: 'flex-start', width: w + 20 }}>{vis.map((t) => <div key={t.id} className="phone-wrap">
      <div className="who" style={{ '--tc': t.color }}><i>{t.letter || '▶'}</i><b>{t.letter ? `Opérateur ${t.letter}` : 'Opérateur'}</b><span>{t.label}</span></div>
      <Phone e={e} t={t} api={api} onDone={onDone} /></div>)}</div>
  </FitBox></div></div>;
}
