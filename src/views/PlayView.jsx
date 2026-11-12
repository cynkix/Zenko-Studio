/**
 * PlayView.jsx — Vue Play en plein écran : canvas en direct + téléphones.
 * MobileDemo — Vue "App mobile" avec boîte de réception.
 */
import React, { useState } from 'react';
import { Ic } from '../icons.jsx';
import { fmt } from '../engine.js';
import { Canvas } from '../flow.jsx';
import { PlayStage, FitBox, PW, PH } from '../phone.jsx';

const cls = (...a) => a.filter(Boolean).join(' ');

export function PlayView({ eng, api, ver, dnodes, dedges, ctx, root, solo, setSolo, auto, setAuto, panel, setPanel, showPanel, setShowPanel, onChanges, bp, struct, docId, dir }) {
  const [flowOpen, setFlowOpen] = useState(false);
  if (!eng) return <div className="play" />;
  const data = Object.entries(eng.data).filter(([k]) => !k.startsWith('__'));
  const running = eng.threads.filter((t) => t.status === 'run' && t.screen && !t.screen.complete).length;
  return <div className={cls('play', flowOpen && 'flow-open')}>
    <section className="play-flow">
      <div className="pf-h2"><b>Parcours</b><span>le canvas suit le parcours en direct</span>
        <div className="legend">{eng.threads.filter((t) => t.status !== 'parked' && t.letter).map((t) => <span key={t.id} style={{ '--tc': t.color }}><i>{t.letter}</i>{t.label}</span>)}</div></div>
      <div className="cv"><Canvas nodes={dnodes} edges={dedges} ctx={ctx} fitKey={`play|${docId}|${dir}|${bp}`} readOnly onChanges={(c) => onChanges(c, true)} /></div>
    </section>
    <section className="play-stage">
      <div className="ptools">
        <button className="btn" onClick={() => { setAuto(false); api.restart(); }}><Ic n="restart" s={14} />Rejouer</button>
        <button className={cls('btn', auto && 'pri')} onClick={() => setAuto(!auto)} disabled={eng.done && !auto}><Ic n={auto ? 'pause' : 'zap'} s={14} />{auto ? 'Pause' : 'Lecture auto'}</button>
        {bp === 's' && <button className="btn" onClick={() => setFlowOpen(!flowOpen)}><Ic n="flow" s={14} />{flowOpen ? 'Écrans' : 'Flux'}</button>}
        <div className="sp" /><span className="mut hide-s">{eng.done ? 'Terminé' : `${running} écran(s) actif(s)`}</span>
        <button className="btn" onClick={() => setShowPanel(!showPanel)}><Ic n="list" s={14} />Données</button>
      </div>
      <div className="stage"><PlayStage e={eng} api={api} solo={solo} /></div>
      {showPanel && <div className="drawer">
        <div className="seg sm"><button className={panel === 'data' ? 'on' : ''} onClick={() => setPanel('data')}>Données ({data.length})</button><button className={panel === 'trace' ? 'on' : ''} onClick={() => setPanel('trace')}>Trace ({eng.trace.length})</button></div>
        <div className="dr-b">{panel === 'data'
          ? (data.length ? data.map(([k, v]) => <div className="kv" key={k}><code>{k}</code><span>{fmt(v)}</span></div>) : <em className="mut">Aucune donnée capturée.</em>)
          : [...eng.trace].reverse().map((t) => <div className={cls('tr', t.kind)} key={t.id}>{t.text}</div>)}</div></div>}
    </section>
  </div>;
}

export function MobileDemo({ e, api, wfs, width, ver }) {
  const [scr, setScr] = useState('inbox'); const [synced, setSynced] = useState({});
  const [cur, setCur] = useState(null);
  const mains = Object.values(wfs).filter((d) => d.kind === 'main');
  const start = (id) => { setCur(id); api.restart(id); setScr('run'); };
  const done = () => { setSynced((s) => ({ ...s, [cur]: true })); setScr('inbox'); };
  const data = e ? Object.entries(e.data).filter(([k]) => !k.startsWith('__')) : [];
  return <div className="mob">
    <div className="mob-side">
      <h1>App mobile</h1>
      <p>Un opérateur seul sur le terrain. Quand un flux a des branches parallèles, elles deviennent des onglets : il passe de l'une à l'autre sans perdre sa place.</p>
      <ul><li>Mode hors ligne, une saisie par écran</li><li>Boucles : un passage par rayon ou par produit</li><li>Branches parallèles : onglets en haut de l'écran</li></ul>
      {scr === 'run' && e && <div className="drawer static"><div className="sh">Données capturées</div><div className="dr-b">{data.length ? data.map(([k, v]) => <div className="kv" key={k}><code>{k}</code><span>{fmt(v)}</span></div>) : <em className="mut">Aucune donnée.</em>}</div></div>}
    </div>
    <div className="mob-stage">
      {scr === 'inbox' || !e
        ? <FitBox w={PW + 20} h={PH + 40}><div className="phone"><div className="ph-notch" />
          <div className="ph-top"><div className="ph-ttl"><b>Mes tâches</b><span>Cyril R. · 2 tâches</span></div><span className="ph-off">hors ligne</span></div>
          <div className="ph-body inbox">{mains.map((d) => { const f = d.nodes.filter((n) => n.type === 'fork').length; return <button key={d.id} className="ib-card" onClick={() => start(d.id)}>
            <div className="ib-h"><b>{d.title}</b><span className={cls('chip', synced[d.id] && 'okc')}>{synced[d.id] ? 'Synchronisée' : 'À faire'}</span></div>
            <span className="ib-s">{d.subtitle}</span>
            <div className="ib-m"><span>{d.nodes.filter((n) => n.type === 'step').length} étapes</span>{f ? <span className="par"><Ic n="branch" s={12} />{f} bloc parallèle</span> : null}<span>{d.noun}</span></div></button>; })}</div>
          <div className="ph-foot"><div className="pf-mut c">Tout est enregistré sur l'appareil</div></div></div></FitBox>
        : <PlayStage e={e} api={api} solo onDone={done} />}
    </div>
  </div>;
}
