/**
 * Inspector.jsx — Panneau de droite : formulaire d'étape (NodeForm), onglets
 * Étape / Flux / Commentaires / Assistant / Contrôles.
 */
import React, { useState } from 'react';
import { Ic } from '../icons.jsx';
import { BR, INPUTS, ADD_TYPES, nodeOf, usageOf } from '../data.js';
import { addBranch, removeBranch } from '../ops.js';
import { CollabPop, CommentsTab, AssistantTab } from '../collab.jsx';

const cls = (...a) => a.filter(Boolean).join(' ');

/** Label + champ de formulaire */
export function Fld({ l, children, help }) {
  return <label className="fld"><span className="fl">{l}</span>{children}{help && <span className="fh">{help}</span>}</label>;
}

/** Toggle (checkbox stylisée) */
export function Tog({ l, v, set }) {
  return <label className="tog"><input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} /><i />{l}</label>;
}

/** Groupe de boutons segmentés */
export function Seg({ value, set, opts }) {
  return <div className="seg sm">{opts.map(([v, l]) => <button key={v} className={value === v ? 'on' : ''} onClick={() => set(v)}>{l}</button>)}</div>;
}

export function Inspector({ doc, wfs, selNode, info, inspTab: tab0, setInspTab, checks, updateNode, updateDoc, del, edit, openSub, setSel, setFocus, setDual, openPar, hasFork, collab, comments, setComments, people, addStep, say, detachSub }) {
  const bad = checks.filter((c) => !c.ok).length;
  const nOpen = collab.on ? doc.nodes.reduce((s, n) => s + (comments[`${doc.id}:${n.id}`] || []).filter((c) => !c.done).length, 0) : 0;
  const tabs = [['step', 'Étape'], ['flow', 'Flux'], ...(collab.on ? [['comments', 'Commentaires']] : []), ...(collab.bot ? [['bot', 'Assistant']] : []), ['check', 'Contrôles']];
  const inspTab = tabs.some(([k]) => k === tab0) ? tab0 : 'step';
  return <div className="insp-in">
    <div className="stabs" role="tablist">
      {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={inspTab === k} className={inspTab === k ? 'on' : ''} onClick={() => setInspTab(k)}>{l}{k === 'comments' && nOpen > 0 && <i className="dot bad">{nOpen}</i>}{k === 'check' && <i className={cls('dot', bad ? 'bad' : 'ok')}>{bad || '✓'}</i>}</button>)}
    </div>
    <div className="insp-scroll">
      {inspTab === 'step' && (selNode ? <NodeForm {...{ doc, wfs, n: selNode, info, updateNode, del, edit, openSub, setDual, openPar, detachSub }} /> : <div className="empty"><Ic n="flow" s={28} /><b>Sélectionnez une étape</b><p>Cliquez sur un nœud du canvas ou du plan pour l’éditer. Survolez un lien et cliquez sur <b>+</b> pour insérer une étape.</p>{hasFork && <button className="btn" onClick={() => setDual(true)}><Ic n="columns" s={15} />Voir les branches côte à côte</button>}</div>)}
      {inspTab === 'comments' && <CommentsTab {...{ doc, sel: selNode && selNode.id, setSel, comments, setComments, people, can: true }} />}
      {inspTab === 'bot' && <AssistantTab {...{ doc, checks, addStep, say }} />}
      {inspTab === 'flow' && <div>
        <Fld l={doc.kind === 'sub' ? 'Nom de la sous-routine' : 'Titre du flux'}><input className="in" value={doc.title} onChange={(e) => updateDoc({ title: e.target.value })} /></Fld>
        {doc.kind === 'main' && <><Fld l="Sous-titre"><input className="in" value={doc.subtitle || ''} onChange={(e) => updateDoc({ subtitle: e.target.value })} /></Fld>
          <Fld l="Nom donné à la tâche côté terrain" help="Affiché dans l’app mobile."><select className="in" value={doc.noun} onChange={(e) => updateDoc({ noun: e.target.value })}>{['Inventaire', 'Visite', 'Réception', 'Contrôle'].map((x) => <option key={x}>{x}</option>)}</select></Fld></>}
        {doc.kind === 'sub' && <Fld l="Paramètre reçu" help="Les textes peuvent l’utiliser avec {paramètre}."><input className="in mono" value={doc.param} onChange={(e) => updateDoc({ param: e.target.value })} /></Fld>}
        <div className="stats">
          <div><b>{doc.nodes.filter((n) => n.type === 'step').length}</b><span>étapes</span></div>
          <div><b>{doc.nodes.filter((n) => n.type === 'loop').length}</b><span>boucles</span></div>
          <div><b>{doc.nodes.filter((n) => n.type === 'fork').length}</b><span>parallèles</span></div>
        </div>
      </div>}
      {inspTab === 'check' && <div className="checks">{checks.map((c, i) => <div key={i} className={cls('ck', c.ok ? 'ok' : 'bad')}><Ic n={c.ok ? 'check' : 'alert'} s={14} sw={2.4} /><span>{c.label}</span></div>)}
        <p className="hintp">Le flux ne peut être activé que si tous les points sont verts.</p></div>}
    </div>
  </div>;
}

export function NodeForm({ doc, wfs, n, info, updateNode, del, edit, openSub, setDual, openPar, detachSub }) {
  const d = n.data; const U = (p, co) => updateNode(n.id, p, co);
  const collects = doc.nodes.filter((x) => x.data.input === 'collect').map((x) => x.data.key);
  const subs = Object.values(wfs).filter((x) => x.kind === 'sub');
  const br = info.byNode[n.id];
  const head = (title, ic) => <div className="nf-h"><span className="nd-ic"><Ic n={ic} s={16} /></span><h2>{title}</h2>{br && <span className="bchip" style={{ '--c': BR[br.idx].color, '--cs': BR[br.idx].soft, '--con': BR[br.idx].on }}><i>{br.tag}</i>{br.path.map((x) => x.label).join(' › ')}</span>}</div>;
  const acts = (n.type === 'step' || n.type === 'loop') && <div className="nf-a"><button className="btn" onClick={() => edit((x) => duplicateNode(x, n.id))}><Ic n="copy" s={14} />Dupliquer</button><button className="btn dng" onClick={() => del(n.id)}><Ic n="trash" s={14} />Supprimer</button></div>;
  if (n.type === 'start' || n.type === 'end') return <div>{head(n.type === 'start' ? 'Début du flux' : 'Fin du flux', n.type === 'start' ? 'play' : 'flag')}<p className="hintp">{n.type === 'start' ? 'Le parcours démarre ici. Ajoutez des étapes avec le + sur le lien suivant.' : 'Le parcours se termine ici et l’écran de fin s’affiche côté terrain.'}</p></div>;
  if (n.type === 'fork') {
    return <div>{head('Départ en parallèle', 'branch')}
      <p className="hintp">Chaque branche est jouée en même temps par un opérateur. Le flux reprend quand toutes les branches sont terminées.</p>
      <div className="sh">Branches</div>
      {d.branches.map((b, i) => <div className="brow" key={b.id} style={{ '--c': BR[i].color, '--cs': BR[i].soft, '--con': BR[i].on }}><i>{BR[i].letter}</i>
        <input className="in" value={b.label} onChange={(e) => U({ branches: d.branches.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)) })} aria-label={`Nom de la branche ${BR[i].letter}`} />
        {d.branches.length > 2 && <button className="ib" title="Supprimer la branche" onClick={() => edit((x) => removeBranch(x, n.id, b.id))}><Ic n="x" s={14} /></button>}</div>)}
      {d.branches.length < 3 && <button className="btn block" onClick={() => edit((x) => addBranch(x, n.id))}><Ic n="plus" s={14} />Ajouter une branche</button>}
      <div className="sh">Fin des branches</div><p className="hintp">Attendre toutes les branches avant de continuer.</p>
      <div className="nf-a"><button className="btn" onClick={() => openPar(n.id)}><Ic n="columns" s={14} />Vue parallèle</button><button className="btn dng" onClick={() => del(n.id)}><Ic n="trash" s={14} />Retirer le bloc</button></div></div>;
  }
  if (n.type === 'join') return <div>{head('Fin des branches', 'columns')}<p className="hintp">Point de rendez-vous : une branche qui arrive ici attend les autres. Le flux continue dès que toutes sont prêtes.</p><div className="nf-a"><button className="btn dng" onClick={() => del(n.id)}><Ic n="trash" s={14} />Retirer le bloc parallèle</button></div></div>;
  if (n.type === 'loop') return <div>{head('Boucle', 'loop')}
    <p className="hintp">Pour chaque élément de la liste, le flux exécute une sous-routine et collecte son résultat.</p>
    <Fld l="Parcourir la liste" help="Une saisie de type « liste dynamique »."><select className="in" value={d.from} onChange={(e) => U({ from: e.target.value })}><option value="">—</option>{collects.map((k) => <option key={k}>{k}</option>)}</select></Fld>
    <Fld l="Nom de l’élément"><input className="in mono" value={d.elt} onChange={(e) => U({ elt: e.target.value })} /></Fld>
    <Fld l="Exécuter la sous-routine"><div className="row"><select className="in" value={d.run} onChange={(e) => U({ run: e.target.value })}>{subs.map((s) => <option key={s.id}>{s.id}</option>)}</select><button className="btn" onClick={() => openSub(d.run)}>Ouvrir <Ic n="ext" s={13} /></button></div></Fld>
    <Fld l="Collecter dans"><input className="in mono" value={d.collect} onChange={(e) => U({ collect: e.target.value.toUpperCase() })} /></Fld>
    {(() => { const u = usageOf(wfs, d.run); return <div className="blk-note"><b>Bloc partagé</b><span>{u.uses > 1 ? `« ${d.run} » est utilisé ${u.uses} fois (${u.docs} workflow${u.docs > 1 ? 's' : ''}). Le modifier change tous ces usages.` : `« ${d.run} » n’est utilisé qu’ici.`}</span><button className="btn" onClick={() => detachSub(n.id)}><Ic n="copy" s={14} />Détacher une copie</button></div>; })()}{acts}</div>;
  if (d.kind === 'info') return <div>{head('Information', 'info')}<Fld l="Titre"><input className="in" value={d.label} onChange={(e) => U({ label: e.target.value })} /></Fld><Fld l="Texte" help="Accepte {CLÉ} pour insérer une donnée."><textarea className="in" rows={4} value={d.body || ''} onChange={(e) => U({ body: e.target.value })} /></Fld>{acts}</div>;
  if (d.kind === 'summary') return <div>{head('Synthèse', 'file')}<Fld l="Titre"><input className="in" value={d.label} onChange={(e) => U({ label: e.target.value })} /></Fld>
    <Fld l="Résumer la liste"><select className="in" value={d.from} onChange={(e) => U({ from: e.target.value })}><option value="">—</option>{collects.map((k) => <option key={k}>{k}</option>)}</select></Fld>
    <div className="sh">Champs affichés</div>
    {(d.fields || []).map((f, i) => <div className="row" key={i}><input className="in" value={f.label} onChange={(e) => U({ fields: d.fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} /><input className="in mono" value={f.key} onChange={(e) => U({ fields: d.fields.map((x, j) => (j === i ? { ...x, key: e.target.value.toUpperCase() } : x)) })} /><button className="ib" onClick={() => U({ fields: d.fields.filter((_, j) => j !== i) })} aria-label="Retirer"><Ic n="x" s={14} /></button></div>)}
    <button className="btn block" onClick={() => U({ fields: [...(d.fields || []), { label: 'Champ', key: 'CLE' }] })}><Ic n="plus" s={14} />Ajouter un champ</button>{acts}</div>;
  const T = d.input; const hasOpts = ['single', 'multi', 'collect'].includes(T);
  return <div>{head(INPUTS[T].label, INPUTS[T].ic)}
    <Fld l="Type de saisie"><select className="in" value={T} onChange={(e) => U({ input: e.target.value, ...(['single', 'multi', 'collect'].includes(e.target.value) && !d.options ? { options: ['Option 1', 'Option 2'] } : {}) })}>{Object.entries(INPUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Fld>
    <Fld l="Question posée" help="Accepte {CLÉ} et le paramètre d’une sous-routine."><input className="in" value={d.label} onChange={(e) => U({ label: e.target.value })} /></Fld>
    <Fld l="Clé de données" help="Contrat public : exports et conditions s’y réfèrent. La renommer casse ces liens."><input className="in mono" value={d.key || ''} onChange={(e) => U({ key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })} /></Fld>
    {hasOpts && <Fld l="Choix"><div className="opts">{(d.options || []).map((o, i) => <span className="oc" key={i}><input value={o} onChange={(e) => U({ options: d.options.map((x, j) => (j === i ? e.target.value : x)) })} size={Math.max(4, o.length)} aria-label={`Choix ${i + 1}`} /><button onClick={() => U({ options: d.options.filter((_, j) => j !== i) })} aria-label="Retirer"><Ic n="x" s={11} /></button></span>)}<button className="oc add" onClick={() => U({ options: [...(d.options || []), 'Nouveau choix'] })}><Ic n="plus" s={12} />ajouter</button></div></Fld>}
    {['number', 'slider'].includes(T) && <div className="row"><Fld l="Valeur par défaut"><input className="in" type="number" value={d.def ?? ''} onChange={(e) => U({ def: e.target.value === '' ? undefined : +e.target.value })} /></Fld><Fld l="Unité"><input className="in" value={d.unit || ''} onChange={(e) => U({ unit: e.target.value })} /></Fld></div>}
    {T === 'text' && <Fld l="Texte d’exemple"><input className="in" value={d.placeholder || ''} onChange={(e) => U({ placeholder: e.target.value })} /></Fld>}
    <Fld l="Aide affichée"><input className="in" value={d.help || ''} onChange={(e) => U({ help: e.target.value })} /></Fld>
    <div className="tgs"><Tog l="Obligatoire" v={d.required} set={(v) => U({ required: v })} />{T === 'collect' && <Tog l="Autoriser « Autre »" v={d.allowOther} set={(v) => U({ allowOther: v })} />}</div>{acts}</div>;
}
