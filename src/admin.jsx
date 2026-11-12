/**
 * admin.jsx — Côté studio : assignation du travail et jeux de données hors ligne.
 *  - AssignModal   : assigner un workflow à un utilisateur ou à un groupe dynamique (filtres de tags)
 *  - DatasetsModal : importer des jeux de données (CSV) et les pousser vers les appareils
 * Démo : aucune donnée n'est envoyée ; l'état vit dans app.jsx.
 */
import React, { useState } from 'react';
import { Ic } from './icons.jsx';
import { USERS, SPACES } from './demo.js';

const cls = (...a) => a.filter(Boolean).join(' ');
const L = ({ l, children }) => <label className="fld2"><span>{l}</span>{children}</label>;
const ALL_TAGS = [...new Set(USERS.flatMap((u) => u.tags))];

/** Personnes qui correspondent à un filtre de tags (ET logique). */
export const matchTags = (tags) => USERS.filter((u) => tags.every((t) => u.tags.includes(t)));

export function AssignModal({ mains, close, onAssign, initial }) {
  const [wf, setWf] = useState(initial || (mains[0] && mains[0].id)); const [space, setSpace] = useState(SPACES[0]);
  const [kind, setKind] = useState('group'); const [user, setUser] = useState(USERS[0].n); const [tags, setTags] = useState(['site:Wavre']);
  const members = kind === 'user' ? USERS.filter((u) => u.n === user) : matchTags(tags);
  const toggle = (t) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);
  const ok = wf && members.length > 0 && (kind === 'user' || tags.length > 0);
  return <div className="pal-bg" onMouseDown={close}><div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Assigner le travail">
    <header><h2>Assigner le travail</h2><button className="ib" onClick={close} aria-label="Fermer"><Ic n="x" s={16} /></button></header>
    <div className="m-b">
      <div className="row"><L l="Workflow"><select className="in" value={wf} onChange={(e) => setWf(e.target.value)}>{mains.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></L>
        <L l="Espace de travail"><select className="in" value={space} onChange={(e) => setSpace(e.target.value)}>{SPACES.map((x) => <option key={x}>{x}</option>)}</select></L></div>
      <div className="seg"><button className={kind === 'user' ? 'on' : ''} onClick={() => setKind('user')}><Ic n="user" s={14} />Un utilisateur</button><button className={kind === 'group' ? 'on' : ''} onClick={() => setKind('group')}><Ic n="users" s={14} />Groupe dynamique (tags)</button></div>
      {kind === 'user'
        ? <L l="Utilisateur"><select className="in" value={user} onChange={(e) => setUser(e.target.value)}>{USERS.map((u) => <option key={u.n}>{u.n}</option>)}</select></L>
        : <div><span className="fl2">Filtres de tags <small>(la personne doit avoir tous les tags choisis)</small></span>
          <div className="tagset">{ALL_TAGS.map((t) => <button key={t} className={cls('tg', tags.includes(t) && 'on')} onClick={() => toggle(t)}>{t}</button>)}</div>
          <p className="hintp">Le groupe se met à jour tout seul : une personne qui reçoit ces tags plus tard reçoit aussi la tâche.</p></div>}
      <div className="match"><b>{members.length} personne{members.length > 1 ? 's' : ''} concernée{members.length > 1 ? 's' : ''}</b>
        <div>{members.length ? members.map((u) => <span key={u.n} className="chip"><Ic n="user" s={10} />{u.n}</span>) : <em className="mut">Aucune personne ne correspond à ces tags.</em>}</div></div>
    </div>
    <footer><button className="btn" onClick={close}>Annuler</button><button className="btn pri" disabled={!ok} onClick={() => { onAssign({ id: 'a' + Date.now(), wf, space, kind, label: kind === 'user' ? user : tags.join(' + '), members: members.map((u) => u.n) }); close(); }}>Assigner</button></footer>
  </div></div>;
}

/** Lecture très simple d'un CSV (séparateur ; ou ,). */
function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim()); if (!lines.length) return null;
  const sep = lines[0].includes(';') ? ';' : ','; const rows = lines.map((l) => l.split(sep).map((c) => c.trim()));
  return { cols: rows[0], data: rows.slice(1, 31), rows: rows.length - 1 };
}

export function DatasetsModal({ datasets, setDatasets, close, say }) {
  const [type, setType] = useState('Catalogue produits');
  const upd = (id, patch) => setDatasets(datasets.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const addFrom = (name, csv, bytes) => {
    const p = parseCsv(csv); if (!p) { say('Fichier vide'); return; }
    setDatasets([...datasets, { id: 'ds' + Date.now(), name: name.replace(/\.[^.]+$/, ''), type, cols: p.cols, data: p.data, rows: p.rows, size: (bytes / 1048576 < 0.1 ? (bytes / 1024).toFixed(0) + ' Ko' : (bytes / 1048576).toFixed(1).replace('.', ',') + ' Mo'), updated: 'à l’instant', pushed: false, devices: 0 }]);
    say(`« ${name} » importé : ${p.rows} lignes`);
  };
  const onFile = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => addFrom(f.name, String(r.result), f.size); r.readAsText(f); e.target.value = ''; };
  const sample = () => addFrom('tarifs_promo.csv', 'Produit;Prix promo;Fin de promo\nLait demi-écrémé 1 L;0,99 €;30 nov.\nPâtes penne 500 g;0,89 €;30 nov.\nCafé moulu 250 g;3,49 €;15 déc.', 190);
  return <div className="pal-bg" onMouseDown={close}><div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Jeux de données">
    <header><h2>Jeux de données hors ligne</h2><button className="ib" onClick={close} aria-label="Fermer"><Ic n="x" s={16} /></button></header>
    <div className="m-b">
      <p className="hintp" style={{ marginTop: 0 }}>Catalogues produits et listes de prix envoyés sur les appareils pour être consultés sans réseau pendant un workflow.</p>
      <div className="ds-list">{datasets.map((d) => <div key={d.id} className="ds-row"><span className="ds-ic"><Ic n="file" s={18} /></span>
        <div><b>{d.name}</b><small>{d.type} · {d.rows.toLocaleString('fr-FR')} lignes · {d.size} · maj {d.updated}</small></div>
        {d.pushed ? <><span className="chip okc">Sur {d.devices} appareils</span><button className="btn sm" onClick={() => { upd(d.id, { pushed: false, devices: 0 }); say('Retiré des appareils'); }}>Retirer</button></>
          : <button className="btn pri sm" onClick={() => { upd(d.id, { pushed: true, devices: 12 }); say(`« ${d.name} » poussé vers 12 appareils`); }}>Pousser vers les appareils</button>}</div>)}</div>
      <div className="ds-imp"><b>Importer un fichier</b>
        <div className="row"><L l="Type"><select className="in" value={type} onChange={(e) => setType(e.target.value)}>{['Catalogue produits', 'Liste de prix', 'Autre'].map((x) => <option key={x}>{x}</option>)}</select></L>
          <L l="Fichier CSV"><input className="in" type="file" accept=".csv,text/csv,text/plain" onChange={onFile} /></L></div>
        <button className="btn sm" onClick={sample}>Importer un exemple (tarifs promo)</button></div>
    </div>
    <footer><button className="btn pri" onClick={close}>Terminé</button></footer>
  </div></div>;
}
