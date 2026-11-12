/**
 * Dashboard.jsx — Vue tableau de bord : KPIs, graphique, dernières exécutions.
 * FlowsHome — Liste des workflows.
 * NewFlow — Assistant de création de workflow.
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Ic } from '../icons.jsx';
import { BR } from '../data.js';
import { validate, INPUTS } from '../data.js';
import { DAYS, RECENT } from '../demo.js';

export function parseLine(raw) {
  const s = raw.trim(); const n = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let label = s, options;
  const m = s.match(/^(.*?)\s*:\s*(.+\/.+)$/);
  if (m) { label = m[1]; options = m[2].split('/').map((x) => x.trim()).filter(Boolean); return { type: /plusieurs|multiple/.test(n) ? 'multi' : 'single', label, options }; }
  const t = /signature|signer/.test(n) ? 'signature' : /photo|image/.test(n) ? 'photo' : /scan|code.?barre|qr/.test(n) ? 'code' : /gps|position|localis/.test(n) ? 'geo' : /date/.test(n) ? 'date' : /note|etoile|satisfaction/.test(n) ? 'stars' : /combien|nombre|quantite|releve|compteur|mesure/.test(n) ? 'number' : /niveau|proprete|pourcent/.test(n) ? 'slider' : 'text';
  return { type: t, label };
}

export function Dashboard({ wfs, openDoc, setView, newFlow }) {
  const mains = Object.values(wfs).filter((d) => d.kind === 'main');
  const max = Math.max(...DAYS); const W = 560, H = 150, bw = W / DAYS.length;
  const tot = DAYS.reduce((a, b) => a + b, 0);
  return <div className="page dash">
    <header className="pg-h"><div><h1>Tableau de bord</h1><p>Vue d’ensemble de vos workflows et des exécutions terrain. <span className="chip">Données d’exemple</span></p></div></header>
    <div className="kpis">
      {[['Exécutions · 14 jours', tot.toLocaleString('fr-FR'), '+12 % vs période précédente', 'up'], ['Taux de complétion', '92 %', '+3 pts', 'up'], ['Durée médiane', '7 min 20', '−45 s', 'up'], ['Gain des branches parallèles', '−38 %', 'vs même flux en séquence', 'up']].map(([l, v, d]) => <div className="kpi" key={l}><span>{l}</span><b>{v}</b><em>{d}</em></div>)}
    </div>
    <div className="dgrid">
      <section className="card c-chart"><h2>Exécutions par jour</h2>
        <svg viewBox={`0 0 ${W + 30} ${H + 30}`} role="img" aria-label="Exécutions par jour sur 14 jours">
          {[0, 0.5, 1].map((t) => <g key={t}><line x1="28" x2={W + 28} y1={H - t * (H - 10)} y2={H - t * (H - 10)} className="gl" /><text x="22" y={H - t * (H - 10) + 4} className="gt" textAnchor="end">{Math.round(max * t)}</text></g>)}
          {DAYS.map((v, i) => { const h = (v / max) * (H - 10); return <g key={i}><rect x={28 + i * bw + 5} y={H - h} width={bw - 10} height={h} rx="3" className={i === DAYS.length - 3 ? 'bar hi' : 'bar'} /><text x={28 + i * bw + bw / 2} y={H + 16} className="gt" textAnchor="middle">{i < 4 ? 28 + i : i - 3}</text></g>; })}
        </svg><p className="cap">Octobre → novembre · les week-ends sont creux.</p></section>
      <section className="card"><h2>Par workflow</h2>
        {mains.slice(0, 4).map((d, i) => { const n = [312, 229, 0, 0][i] || 0; return <div className="hbar" key={d.id}><span>{d.title}</span><div><i style={{ width: Math.max(4, (n / 312) * 100) + '%' }} /></div><b>{n}</b></div>; })}
        <h2 className="sp-t">Statuts</h2>
        <div className="stk"><i style={{ flex: 92, background: 'var(--ok)' }} /><i style={{ flex: 5, background: 'var(--warn)' }} /><i style={{ flex: 3, background: 'var(--err)' }} /></div>
        <div className="stk-l"><span><i style={{ background: 'var(--ok)' }} />Terminé 92 %</span><span><i style={{ background: 'var(--warn)' }} />En cours 5 %</span><span><i style={{ background: 'var(--err)' }} />Abandonné 3 %</span></div></section>
      <section className="card c-wide"><div className="card-h"><h2>Dernières exécutions</h2></div>
        <div className="tbl"><table><thead><tr><th>Workflow</th><th>Site</th><th>Statut</th><th>Durée</th><th>Mode</th></tr></thead><tbody>
          {RECENT.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td><span className={'chip ' + (r[2] === 'Terminé' ? 'okc' : '')}>{r[2]}</span></td><td className="num">{r[3]}</td><td>{r[4] ? 'Parallèle · 2 opérateurs' : 'Parallèle · 1 opérateur'}</td></tr>)}</tbody></table></div></section>
      <section className="card"><div className="card-h"><h2>À surveiller</h2></div>
        {mains.map((d) => { const bad = validate(wfs, d).filter((c) => !c.ok); return <button key={d.id} className="watch" onClick={() => openDoc(d.id)}><span className={'dot ' + (bad.length ? 'bad' : 'ok')}>{bad.length ? bad.length : '✓'}</span><span><b>{d.title}</b><em>{bad.length ? bad[0].label : d.status + ' · prêt à activer'}</em></span><Ic n="right" s={14} /></button>; })}
        <button className="btn block" onClick={newFlow}><Ic n="plus" s={14} />Créer un workflow</button></section>
    </div>
  </div>;
}

export function FlowsHome({ wfs, openDoc, newFlow }) {
  const mains = Object.values(wfs).filter((d) => d.kind === 'main');
  return <div className="page">
    <header className="pg-h"><div><h1>Workflows</h1><p>{mains.length} workflows · chaque boucle appelle une sous-routine réutilisable.</p></div></header>
    <div className="fcards">
      <button className="fcard new" onClick={newFlow}><span><Ic n="plus" s={22} /></span><b>Nouveau workflow</b><em>Partir de zéro, d’un modèle ou d’une liste d’étapes</em></button>
      {mains.map((d) => { const f = d.nodes.filter((n) => n.type === 'fork').length; const v = validate(wfs, d).every((c) => c.ok);
        return <button className="fcard" key={d.id} onClick={() => openDoc(d.id)}><div className="fc-h"><b>{d.title}</b><span className={'chip ' + (d.status.startsWith('Actif') ? 'okc' : '')}>{d.status}</span></div>
          <em>{d.subtitle}</em>
          <div className="fc-m"><span>{d.nodes.filter((n) => n.type === 'step').length} étapes</span><span>{d.nodes.filter((n) => n.type === 'loop').length} boucle(s)</span>{f ? <span className="par"><Ic n="branch" s={12} />{f} parallèle</span> : null}<span>{d.noun}</span></div>
          <div className="fc-f"><span className={v ? 'okt' : 'badt'}>{v ? '✓ Valide' : '⚠ À corriger'}</span><span className="lnk2">Ouvrir dans le studio →</span></div></button>; })}
    </div>
    <h2 className="sub-h">Sous-routines</h2>
    <div className="fcards sm">{Object.values(wfs).filter((d) => d.kind === 'sub').map((d) => <div className="fcard static" key={d.id}><b className="mono">{d.title}</b><em>paramètre {'{' + d.param + '}'} · {d.nodes.filter((n) => n.type === 'step').length} étapes</em></div>)}</div>
  </div>;
}

export function NewFlow({ close, create }) {
  const [title, setTitle] = useState(''); const [noun, setNoun] = useState('Inventaire'); const [tpl, setTpl] = useState('text');
  const [lines, setLines] = useState("Date de la visite\nÉtat général : bon / moyen / mauvais\nPhoto de l’installation\nCombien de prises défectueuses ?\nSignature du client");
  const tpls = [['text', "Depuis une liste d’étapes", 'Une ligne par étape, le type est deviné'], ['blank', 'Vide', 'Début, une consigne, fin'], ['inventory', 'Modèle Inventaire magasin', 'Boucle sur les rayons + réserve en parallèle'], ['merch', 'Modèle Visite stock', 'Boucle sur les produits + vitrine en parallèle']];
  const prev = tpl === 'text' ? lines.split('\n').filter((x) => x.trim()).map(parseLine) : [];
  const ok = title.trim().length > 1;
  return <div className="pal-bg" onMouseDown={close}><div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Nouveau workflow">
    <header><h2>Nouveau workflow</h2><button className="ib" onClick={close} aria-label="Fermer"><Ic n="x" s={16} /></button></header>
    <div className="m-b">
      <div className="row"><label className="fld"><span className="fl">Nom du workflow</span><input id="nf-title" autoFocus className="in" placeholder="Ex. Contrôle chaudière" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="fld"><span className="fl">Nom côté terrain</span><select className="in" value={noun} onChange={(e) => setNoun(e.target.value)}>{[' Inventaire', 'Visite', 'Réception', 'Contrôle'].map((x) => <option key={x}>{x}</option>)}</select></label></div>
      <div className="tpls" role="radiogroup" aria-label="Point de départ">{tpls.map(([k, t, h]) => <button key={k} role="radio" aria-checked={tpl === k} className={tpl === k ? 'on' : ''} onClick={() => setTpl(k)}><b>{t}</b><em>{h}</em></button>)}</div>
      {tpl === 'text' && <div className="gen"><label className="fld"><span className="fl">Étapes, une par ligne</span><span className="fh">« Question : choix 1 / choix 2 » crée un choix. Les mots photo, signature, date, scan, GPS, nombre, note sont reconnus.</span><textarea id="nf-lines" className="in" rows={6} value={lines} onChange={(e) => setLines(e.target.value)} /></label>
        <div className="gprev">{prev.map((p, i) => <span key={i} className="chip"><Ic n={(INPUTS[p.type] || {}).ic} s={11} />{INPUTS[p.type].label}</span>)}</div></div>}
    </div>
    <footer><button className="btn" onClick={close}>Annuler</button><button className="btn pri" disabled={!ok} onClick={() => create({ title: title.trim(), noun, template: tpl, lines: lines.split('\n').filter((x) => x.trim()) })}>Créer et ouvrir dans le studio</button></footer>
  </div></div>;
}
