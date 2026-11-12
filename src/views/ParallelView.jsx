/**
 * ParallelView.jsx — Vue côte-à-côte des branches parallèles (mode édition).
 * Pane — Colonne canvas d'une branche.
 */
import React, { useMemo } from 'react';
import { Ic } from '../icons.jsx';
import { BR, outline, layout, nodeOf, branchEdges } from '../data.js';
import { Canvas } from '../flow.jsx';

const cls = (...a) => a.filter(Boolean).join(' ');

export function ParallelView({ doc, info, forks, forkIdx, setForkIdx, sel, setSel, ctx, onChanges, openAdd, edit, mkEdges, say, setFocus }) {
  const { addBranch } = require('../ops.js');
  const entry = forks[Math.min(forkIdx, forks.length - 1)]; const f = entry.fork;
  const rows = useMemo(() => outline(doc), [doc]);
  const fi = rows.findIndex((r) => r.n.id === f.id); const ji = entry.join ? rows.findIndex((r, k) => k > fi && r.n.id === entry.join.id) : rows.length;
  const fr = rows[fi]; const same = (r) => r.depth === fr.depth && (r.br ? r.br.id : null) === (fr.br ? fr.br.id : null);
  const before = rows.slice(0, fi).filter((r) => same(r) && r.n.type !== 'start'); const after = rows.slice(ji + 1).filter((r) => same(r) && r.n.type !== 'end');
  const trail = (info.paths[f.id] || []).map((x) => x.label).join(' › ');
  const lab = (n) => n.type === 'loop' ? `Boucle ${n.data.run}` : n.type === 'fork' ? 'Parallèle' : n.type === 'join' ? 'Sync' : n.data.label;
  const chips = (list) => list.map(({ n }) => <button key={n.id} className={cls('cchip', sel === n.id && 'on')} onClick={() => setSel(n.id)}>{lab(n)}</button>);
  return <div className="pv">
    <div className="pv-ctx"><span className="pv-l">Avant</span><div className="pv-chips">{before.length ? chips(before) : <em>Début</em>}</div>
      {trail && <span className="pv-trail">dans {trail}</span>}<div className="pv-fork"><Ic n="branch" s={14} />{forks.length > 1 ? <select value={forkIdx} onChange={(e) => setForkIdx(+e.target.value)} aria-label="Bloc parallèle">{forks.map((x, i) => <option key={x.fork.id} value={i}>Bloc parallèle {i + 1}{x.depth ? ' (imbriqué)' : ''}</option>)}</select> : 'Départ en parallèle'}
        {f.data.branches.length < 3 && <button className="lnk" onClick={() => edit((d) => addBranch(d, f.id))}><Ic n="plus" s={12} />branche</button>}</div></div>
    <div className="pv-panes" style={{ gridTemplateColumns: `repeat(${f.data.branches.length}, minmax(0,1fr))` }}>
      {entry.branches.map((b) => <Pane key={b.id + doc.id} {...{ doc, info, entry, b, sel, setSel, ctx, onChanges, openAdd, edit, mkEdges }} />)}
    </div>
    <div className="pv-ctx after"><div className="pv-join"><Ic n="columns" s={14} />Fin des branches : attend les {f.data.branches.length} branches</div><span className="pv-l">Après</span><div className="pv-chips">{after.length ? chips(after) : <em>Fin</em>}</div></div>
  </div>;
}

function Pane({ doc, info, entry, b, sel, setSel, ctx, onChanges, openAdd, edit, mkEdges }) {
  const f = entry.fork; const idx = b.idx; const c = BR[idx];
  const sub = useMemo(() => {
    const ids = new Set(b.ids); const nodes = doc.nodes.filter((n) => ids.has(n.id)); const edges = doc.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes: nodes.length ? layout(nodes, edges, 'TB') : [], edges };
  }, [doc, b.ids.join()]);
  const dn = sub.nodes.map((n) => ({ ...n, selected: n.id === sel, data: { ...n.data, _br: info.byNode[n.id] } }));
  const de = mkEdges({ ...doc, nodes: doc.nodes, edges: sub.edges }, info, true, null).map((e) => ({ ...e, data: { ...e.data, dim: false } }));
  const be = branchEdges(doc, f.id, b);
  const pctx = useMemo(() => ({ ...ctx, dir: 'TB', editable: true }), [ctx]);
  return <section className="pane" style={{ '--c': c.color, '--cs': c.soft, '--con': c.on }}>
    <header><i>{c.letter}</i><b>{b.label}</b><span>{b.ids.filter((x) => nodeOf(doc, x).type === 'step' || nodeOf(doc, x).type === 'loop').length} étape(s)</span>
      <button className="lnk" onClick={(e) => openAdd(be.first.id, e.currentTarget.getBoundingClientRect())}><Ic n="plus" s={12} />en tête</button></header>
    <div className="pane-cv">{dn.length
      ? <Canvas nodes={dn} edges={de} ctx={pctx} fitKey={`${doc.id}|${b.ids.join()}`} readOnly onChanges={(ch) => onChanges(ch, true)} onNodeClick={(_, n) => setSel(n.id)} onPaneClick={() => setSel(null)} padding={0.18} minZoomFit={0.2} />
      : <div className="pane-empty">Branche vide<button className="btn" onClick={(e) => openAdd(be.first.id, e.currentTarget.getBoundingClientRect())}><Ic n="plus" s={14} />Ajouter une étape</button></div>}</div>
    <footer><button className="btn block" onClick={(e) => openAdd(be.last.id, e.currentTarget.getBoundingClientRect())}><Ic n="plus" s={14} />Ajouter à la fin de la branche {c.letter}</button></footer>
  </section>;
}
