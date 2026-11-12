import React, { createContext, useContext, useEffect } from 'react';
import ReactFlow, { useStore, Background, Controls, MiniMap, Handle, Position, BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow } from 'reactflow';
import { Ic } from './icons.jsx';
import { BR, INPUTS } from './data.js';

export const FlowCtx = createContext({ dir: 'TB', editable: false });
const cls = (...a) => a.filter(Boolean).join(' ');
const hp = (dir) => (dir === 'TB' ? { t: Position.Top, s: Position.Bottom } : { t: Position.Left, s: Position.Right });

function PlayBadges({ play }) {
  if (!play) return null;
  return <>
    {play.active.length > 0 && <span className="nd-pl">{play.active.map((a, i) => <span key={i} className="nd-pb" style={{ background: a.color }}>{a.letter || '▶'}</span>)}</span>}
    {play.done && !play.active.length && <span className="nd-done"><Ic n="check" s={11} sw={3} /></span>}
  </>;
}
const brStyle = (br) => (br ? { '--c': BR[br.idx].color, '--cs': BR[br.idx].soft, '--con': BR[br.idx].on } : undefined);
const actStyle = (play, st) => (play && play.active.length ? { ...(st || {}), '--ac': play.active[0].color } : st);

function StepNode({ data, selected }) {
  const c = useContext(FlowCtx); const p = hp(c.dir); const br = data._br;
  const ic = data.kind === 'info' ? 'info' : data.kind === 'summary' ? 'file' : (INPUTS[data.input] || {}).ic;
  return <div className={cls('nd', selected && 'sel', br && 'br', data._ghost && 'ghost', data._play && data._play.active.length && 'act', data._play && data._play.done && 'done')} style={actStyle(data._play, brStyle(br))}>
    <Handle type="target" position={p.t} isConnectable={false} />
    {br && <span className="nd-br">{br.tag}</span>}
    {data._ghost && <span className="gh-tag" title="Étape de la sous-routine, répétée pour chaque élément"><Ic n="loop" s={10} />{data._gelt}</span>}
    <span className="nd-ic"><Ic n={ic} s={16} /></span>
    <span className="nd-tx">
      <span className="nd-t">{data._ghost ? String(data.label || '').replace(/\{(\w+)\}/g, '‹$1›') : data.label}</span>
      <span className="nd-sub">{data.key && <span className="nd-k">{data.key}</span>}<span className="nd-ty">{data.kind === 'input' ? INPUTS[data.input].label : data.kind === 'info' ? 'Information' : 'Synthèse'}</span></span>
    </span>
    {data.required && <span className="nd-req" title="Obligatoire" />}
    {data._cm > 0 && <span className="nd-cm" title="Commentaires à traiter"><Ic n="chat" s={11} />{data._cm}</span>}
    <PlayBadges play={data._play} />
    <Handle type="source" position={p.s} isConnectable={false} />
  </div>;
}

function LoopNode({ data, selected }) {
  const c = useContext(FlowCtx); const p = hp(c.dir); const br = data._br;
  return <div className={cls('nd loop', selected && 'sel', br && 'br', data._ghost && 'ghost', data._play && data._play.active.length && 'act', data._play && data._play.done && 'done')} style={actStyle(data._play, brStyle(br))}>
    <Handle type="target" position={p.t} isConnectable={false} />
    {br && <span className="nd-br">{br.tag}</span>}
    <span className="nd-ic"><Ic n="loop" s={16} /></span>
    <span className="nd-tx">
      <span className="nd-t">Pour chaque <b>{data.elt}</b> dans <code>{data.from || '—'}</code></span>
      <span className="nd-sub"><span className="nd-run">Exécuter</span>
        <button className="lnk nodrag" onClick={(e) => { e.stopPropagation(); c.openSub && c.openSub(data.run); }}>{data.run || '—'} <Ic n="ext" s={11} /></button>
        {c.editable && !data._ghost && <button className="lnk nodrag" onClick={(e) => { e.stopPropagation(); c.toggleUnfold && c.toggleUnfold(data._id); }}>{data._open ? 'Replier' : 'Déplier'}</button>}
        <span className="nd-ty">→ {data.collect}</span></span>
    </span>
    <PlayBadges play={data._play} />
    <Handle type="source" position={p.s} isConnectable={false} />
  </div>;
}

function ForkNode({ data, selected }) {
  const c = useContext(FlowCtx); const p = hp(c.dir); const n = data.branches.length; const br = data._br;
  return <div className={cls('nd fork', selected && 'sel', br && 'br', data._play && data._play.done && 'done')} style={brStyle(br)}>
    <Handle type="target" position={p.t} isConnectable={false} />
    {br && <span className="nd-br">{br.tag}</span>}
    <span className="nd-ic"><Ic n="branch" s={16} /></span>
    <span className="nd-tx">
      <span className="nd-t">Départ en parallèle</span>
      <span className="nd-sub">{data.branches.map((b, i) => <span key={b.id} className="bchip" style={{ '--c': BR[i].color, '--cs': BR[i].soft, '--con': BR[i].on }}><i>{BR[i].letter}</i>{b.label}</span>)}</span>
    </span>
    {data.branches.map((b, i) => <Handle key={b.id} id={b.id} type="source" position={p.s} isConnectable={false} style={c.dir === 'TB' ? { left: `${((i + 0.5) / n) * 100}%` } : { top: `${((i + 0.5) / n) * 100}%` }} />)}
  </div>;
}

function JoinNode({ data, selected }) {
  const c = useContext(FlowCtx); const p = hp(c.dir); const br = data._br;
  return <div className={cls('nd join', selected && 'sel', br && 'br', data._play && data._play.done && 'done')} style={brStyle(br)}>
    <Handle type="target" position={p.t} isConnectable={false} />
    {br && <span className="nd-br">{br.tag}</span>}
    <span className="nd-ic"><Ic n="columns" s={16} /></span>
    <span className="nd-tx"><span className="nd-t">Fin des branches</span><span className="nd-sub"><span className="nd-ty">attend les {data._n || 2} branches</span></span></span>
    <Handle type="source" position={p.s} isConnectable={false} />
  </div>;
}

function TermNode({ data, type }) {
  const c = useContext(FlowCtx); const p = hp(c.dir);
  return <div className={cls('nd term', data._play && data._play.done && 'done', data._play && data._play.active.length && 'act')}>
    {type === 'end' && <Handle type="target" position={p.t} isConnectable={false} />}
    <Ic n={type === 'start' ? 'play' : 'flag'} s={13} /> {type === 'start' ? 'Début' : 'Fin'}
    {type === 'start' && <Handle type="source" position={p.s} isConnectable={false} />}
  </div>;
}
const StartNode = (p) => <TermNode {...p} type="start" />;
const EndNode = (p) => <TermNode {...p} type="end" />;

function PlusEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) {
  const [path, lx, ly] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 14 });
  const mk = data && data.mk ? data.mk : 'arr-n';
  return <>
    <BaseEdge id={id} path={path} markerEnd={`url(#${mk})`} style={{ stroke: (data && data.color) || 'var(--edge)', strokeWidth: 2, opacity: data && data.dim ? 0.35 : 1 }} />
    {data && data.editable && <EdgeLabelRenderer>
      <div className="edge-plus nodrag nopan" style={{ transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)` }}>
        <button title="Ajouter une étape ici" aria-label="Ajouter une étape ici" onClick={(ev) => { ev.stopPropagation(); data.onAdd(id, ev.currentTarget.getBoundingClientRect()); }}><Ic n="plus" s={12} sw={2.4} /></button>
      </div>
    </EdgeLabelRenderer>}
  </>;
}

const nodeTypes = { step: StepNode, loop: LoopNode, fork: ForkNode, join: JoinNode, start: StartNode, end: EndNode };
const edgeTypes = { plus: PlusEdge };

export function Markers() {
  const m = (id, v) => <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" style={{ fill: v }} /></marker>;
  return <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>{m('arr-n', 'var(--edge)')}{m('arr-a', 'var(--ba)')}{m('arr-b', 'var(--bb)')}{m('arr-c', 'var(--bc)')}</defs></svg>;
}

function Fitter({ k, padding, minZ = 0.72 }) {
  const rf = useReactFlow(); const W = useStore((s) => s.width); const H = useStore((s) => s.height);
  useEffect(() => {
    const t = setTimeout(() => {
      rf.fitView({ padding, duration: 0, maxZoom: 1.05 });
      const z = rf.getViewport().zoom; const ns = rf.getNodes();
      if (z >= minZ || !ns.length) { rf.fitView({ padding, duration: 260, maxZoom: 1.05 }); return; }
      const x0 = Math.min(...ns.map((n) => n.position.x)); const x1 = Math.max(...ns.map((n) => n.position.x + (n.width || 260)));
      rf.setViewport({ x: W / 2 - ((x0 + x1) / 2) * minZ, y: 56, zoom: minZ }, { duration: 260 });
    }, 90);
    return () => clearTimeout(t);
  }, [k, W, H]);
  return null;
}

function Focuser({ focus }) {
  const rf = useReactFlow();
  useEffect(() => { if (!focus || !focus.id) return; const t = setTimeout(() => rf.fitView({ nodes: [{ id: focus.id }], duration: 380, maxZoom: 1, padding: 0.9 }), 120); return () => clearTimeout(t); }, [focus && focus.tick]);
  return null;
}

const mmColor = (n) => (n.data && n.data._br ? ['#2F6FEB', '#E2761B', '#C2318A'][n.data._br.idx] : '#8a948f');

export function Canvas({ nodes, edges, ctx, fitKey, minimap, readOnly, onChanges, onNodeClick, onPaneClick, focus, minZoomFit, padding = 0.14 }) {
  return <FlowCtx.Provider value={ctx}>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      onNodesChange={onChanges} onNodeClick={onNodeClick} onPaneClick={onPaneClick}
      nodesConnectable={false} nodesDraggable={!readOnly} elementsSelectable={!readOnly} deleteKeyCode={null} selectionKeyCode={null} multiSelectionKeyCode={null}
      minZoom={0.15} maxZoom={1.6} proOptions={{ hideAttribution: true }} fitView fitViewOptions={{ padding, maxZoom: 1.05 }}>
      <Background gap={22} size={1.2} />
      <Controls showInteractive={false} position="bottom-left" />
      {minimap && <MiniMap pannable zoomable nodeColor={mmColor} nodeStrokeWidth={0} maskColor="rgba(110,125,118,0.16)" />}
      {focus && <Focuser focus={focus} />}
      <Fitter k={fitKey} padding={padding} minZ={minZoomFit || 0.72} />
    </ReactFlow>
  </FlowCtx.Provider>;
}
