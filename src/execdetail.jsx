/**
 * execdetail.jsx — Détail d'une exécution : ce qu'un opérateur a réellement saisi sur le terrain.
 * Démo : les valeurs sont dérivées du workflow (champs, valeurs par défaut, options) ; aucune donnée réelle.
 */
import React from 'react';
import { Ic } from './icons.jsx';

const fw = (s) => { const d = new Date(s); return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

/** Champs de saisie d'un workflow, dans l'ordre de lecture du flux. */
const inputsOf = (doc) => doc.nodes.filter((n) => n.type === 'step' && n.data.kind === 'input')
  .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

/** Valeur d'exemple d'un champ (ou null si le champ n'est pas encore renseigné). */
function valueOf(n, row, done) {
  const d = n.data; const unit = d.unit ? ' ' + d.unit : '';
  if (!done) return { text: 'Pas encore renseigné', todo: true };
  switch (d.input) {
    case 'date': return { text: row.when.split(' · ')[0] + ' 2026' };
    case 'collect': { const o = (d.options || []).slice(0, 4); return { text: o.length ? o.join(' · ') : '—', note: o.length ? `${o.length} éléments contrôlés` : '' }; }
    case 'number': return { text: (d.def !== undefined ? d.def : 12) + unit };
    case 'photo': return { photo: true, queued: row.st === 'En attente de sync' };
    case 'signature': return { sign: true };
    case 'geo': return { text: 'Position confirmée · sur site (± 12 m)' };
    case 'single': return { text: (d.options || ['—'])[0] };
    case 'text': return { text: 'Rien à signaler' };
    default: return { text: '—' };
  }
}

export function ExecDetail({ row, doc, close, openStudio }) {
  const [wf, site, op, st, dur, start] = row;
  const r = { st, when: fw(start) };
  const fields = doc ? inputsOf(doc) : [];
  const upto = st === 'En cours' ? Math.ceil(fields.length * 0.6) : fields.length;
  const tone = st === 'Terminé' ? 'okc' : st === 'En cours' ? '' : 'warnc';
  return <div className="pal-bg" onMouseDown={close}><div className="modal xd" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={`Détail de l’exécution · ${wf}`}>
    <header><h2>{wf}</h2><button className="ib" onClick={close} aria-label="Fermer"><Ic n="x" s={16} /></button></header>
    <div className="m-b">
      <div className="xd-grid">
        <div><small>Site</small><b>{site}</b></div><div><small>Opérateur</small><b>{op}</b></div>
        <div><small>Début</small><b>{r.when}</b></div><div><small>Durée</small><b>{dur}</b></div>
        <div><small>Exécution</small><span className={'chip st ' + tone}><i />{st}</span></div>
      </div>
      {st === 'En attente de sync' && <p className="hintp">Terminé sur l’appareil : les réponses et les photos partiront automatiquement dès le retour du réseau.</p>}
      {st === 'En cours' && <p className="hintp">L’opérateur est encore en train de remplir le workflow.</p>}
      <h3 className="sp-t">Réponses saisies sur le terrain</h3>
      <div className="xd-list">{fields.map((n, i) => { const v = valueOf(n, r, i < upto); return <div className="xd-row" key={n.id}>
        <span className="xd-l">{n.data.label}</span>
        {v.photo ? <span className="xd-v"><span className="xd-ph"><Ic n="camera" s={18} /></span><small>{v.queued ? 'En file d’envoi' : 'Photo reçue'}</small></span>
          : v.sign ? <span className="xd-v"><Ic n="pen" s={15} /> Signé par le responsable du site</span>
            : <span className={'xd-v' + (v.todo ? ' mut' : '')}>{v.text}{v.note && <small>{v.note}</small>}</span>}
      </div>; })}
      {!fields.length && <p className="hintp">Aucune réponse à afficher pour ce workflow.</p>}</div>
      <p className="hintp">Données d’exemple : le détail est généré à partir des champs du workflow.</p>
    </div>
    <footer><button className="btn" onClick={openStudio}>Ouvrir le workflow dans le Studio</button><button className="btn pri" onClick={close}>Fermer</button></footer>
  </div></div>;
}
