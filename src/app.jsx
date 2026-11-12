/**
 * app.jsx — Point d'entrée principal. Shell de l'application, état global.
 *
 * Organisation des sous-modules :
 *   src/views/Dashboard.jsx  — Tableau de bord, liste des workflows, assistant de création
 *   src/views/PlayView.jsx   — Vue Play plein écran + démonstration mobile
 *   src/views/ParallelView.jsx — Vue côte-à-côte des branches parallèles
 *   src/editor/Inspector.jsx — Panneau inspecteur (NodeForm, Fld, Tog, Seg)
 *   src/collab.jsx           — Collaboration, commentaires, assistant workflow
 *   src/engine.js            — Moteur d'exécution des workflows (threads, fork/join)
 *   src/data.js              — Modèle de données, layout dagre, branchInfo
 *   src/ops.js               — Opérations d'édition (insert, delete, fork…)
 *   src/demo.js              — Données de démonstration (remplacer en production)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { applyNodeChanges } from 'reactflow';
import { Emblem } from './logo.jsx';
import { CollabPop, CommentsTab, AssistantTab, Avatar, REVIEW_LABEL } from './collab.jsx';
import { DAYS, RECENT, PEOPLE0, COMMENTS0 } from './demo.js';
import { Ic } from './icons.jsx';
import { expandDoc, usageOf, makeKey, BR, INPUTS, ADD_TYPES, initialDocs, layout, branchInfo, outline, validate, makeNode, nodeOf, outsOf, uid } from './data.js';
import { createEngine, previewEngine, submit as eSubmit, back as eBack, demoValue, hasValue, fmt } from './engine.js';
import { relay, insertOnEdge, insertFork, deleteNode, duplicateNode, addBranch, removeBranch, branchEdges } from './ops.js';
import { Canvas, Markers } from './flow.jsx';
import { PlayStage, Phone, FitBox, PW, PH } from './phone.jsx';

const cls = (...a) => a.filter(Boolean).join(' ');
const ls = { get: (k, d) => { try { return localStorage.getItem(k) || d; } catch (_) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
const MOD = isMac ? '⌘' : 'Ctrl';

function useWidth() {
  const [w, setW] = useState(typeof window === 'undefined' ? 1400 : window.innerWidth);
  useEffect(() => { const f = () => setW(window.innerWidth); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return w;
}

/* ------------------------------------------------------------------ App */
function App() {
  const [wfs, setWfsS] = useState(initialDocs);
  const wfsRef = useRef(wfs); wfsRef.current = wfs;
  const setW = (n) => { wfsRef.current = n; setWfsS(n); };
  const hist = useRef({ past: [], future: [], co: null, t: 0 });
  const [struct, setStruct] = useState(0);
  const [docId, setDocId] = useState('inventory');
  const [rootId, setRootId] = useState('inventory');
  const [sel, setSel] = useState(null); const [unfold, setUnfold] = useState({});
  const [collab, setCollab] = useState({ on: false, bot: false, show: true }); const [people, setPeople] = useState(PEOPLE0); const [comments, setComments] = useState(COMMENTS0); const [review, setReview] = useState('draft');
  const [view, setView] = useState('dashboard');
  const [newOpen, setNewOpen] = useState(false);
  const [mode, setMode] = useState('edit');
  const [dual, setDual] = useState(false);
  const [dir, setDirS] = useState(ls.get('sp-dir', 'TB'));
  const [theme, setThemeS] = useState(ls.get('sp-theme', 'light'));
  const [density, setDensityS] = useState(ls.get('sp-density', 'auto'));
  const [minimap, setMinimapS] = useState(ls.get('sp-mm', '1') === '1');
  const [sideTab, setSideTab] = useState('flux');
  const [inspTab, setInspTab] = useState('step');
  const [drawer, setDrawer] = useState(null);
  const [addMenu, setAddMenu] = useState(null);
  const [pal, setPal] = useState(false);
  const [menu, setMenu] = useState(null);
  const [toast, setToast] = useState(null);
  const [focus, setFocus] = useState(null);
  const [forkIdx, setForkIdx] = useState(0);
  const [solo, setSolo] = useState(false);
  const [auto, setAuto] = useState(false);
  const [panel, setPanel] = useState('data');
  const [showPanel, setShowPanel] = useState(true);
  const width = useWidth();

  /* ---- responsive tier ---- */
  const bp = width < 900 ? 's' : density === 'compact' ? 'm' : density === 'wide' ? (width < 1200 ? 'm' : 'l') : width >= 2200 ? 'xl' : width >= 1500 ? 'l' : 'm';

  /* ---- theme ---- */
  useEffect(() => { const r = document.documentElement; if (theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', theme); ls.set('sp-theme', theme); }, [theme]);
  const setDensity = (v) => { setDensityS(v); ls.set('sp-density', v); };
  const setMinimap = (v) => { setMinimapS(v); ls.set('sp-mm', v ? '1' : '0'); };

  const doc = wfs[docId]; const root = wfs[rootId];
  const info = useMemo(() => branchInfo(doc), [doc]);
  const selNode = sel ? nodeOf(doc, sel) : null;
  const openCm = doc.nodes.reduce((s, n) => s + (comments[`${doc.id}:${n.id}`] || []).filter((c) => !c.done).length, 0);
  const say = (m) => { setToast(m); clearTimeout(say.t); say.t = setTimeout(() => setToast(null), 2600); };

  /* ---- history ---- */
  const commit = (next, co) => {
    const h = hist.current; const prev = wfsRef.current;
    if (!(co && h.co === co && Date.now() - h.t < 1200)) { h.past.push(prev); if (h.past.length > 80) h.past.shift(); }
    h.co = co || null; h.t = Date.now(); h.future = []; setW(next); setStruct((v) => v + 1);
  };
  const undo = () => { const h = hist.current; if (!h.past.length) return; h.future.push(wfsRef.current); setW(h.past.pop()); setStruct((v) => v + 1); };
  const redo = () => { const h = hist.current; if (!h.future.length) return; h.past.push(wfsRef.current); setW(h.future.pop()); setStruct((v) => v + 1); };

  const edit = (fn, { select, msg, id } = {}) => {
    const did = id || docId; const r = fn(wfsRef.current[did]);
    if (!r) { say(msg || 'Action impossible ici'); return false; }
    const d = r.d || r; const next = { ...wfsRef.current, [did]: relay(d, dir) };
    commit(next);
    const f = select || r.focus; if (f) { setSel(f); setFocus({ id: f, tick: Date.now() }); if (bp === 's') setDrawer('right'); }
    return true;
  };
  const updateNode = (id, patch, co) => {
    const d = wfsRef.current[docId];
    commit({ ...wfsRef.current, [docId]: { ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)) } }, co || 'u' + id + Object.keys(patch)[0]);
  };
  const updateDoc = (patch, co) => commit({ ...wfsRef.current, [docId]: { ...wfsRef.current[docId], ...patch } }, co || 'd' + Object.keys(patch)[0]);

  /* ---- structural actions ---- */
  const addOnEdge = (edgeId, typeId) => {
    const d = wfsRef.current[docId];
    if (typeId === 'fork') return edit((x) => insertFork(x, edgeId), { msg: 'Deux niveaux de parallélisme au maximum.' });
    const n = makeNode(typeId, d, wfsRef.current);
    edit((x) => insertOnEdge(x, edgeId, n), { select: n.id });
  };
  const addAfterSel = (typeId) => {
    const d = wfsRef.current[docId]; const s = sel && nodeOf(d, sel); let e;
    if (s && s.type !== 'end') e = outsOf(d, s.id)[0];
    if (!e) { const end = d.nodes.find((n) => n.type === 'end'); e = d.edges.find((x) => x.target === end.id); }
    addOnEdge(e.id, typeId);
  };
  const addStep = (text) => {
    const d = wfsRef.current[docId]; const spec = parseLine(text); const n = makeNode(spec.type, d, wfsRef.current);
    n.data.label = spec.label; if (spec.options) n.data.options = spec.options; n.data.key = makeKey(spec.label, d);
    const end = d.nodes.find((x) => x.type === 'end'); const e = d.edges.find((x) => x.target === end.id);
    edit((x) => insertOnEdge(x, e.id, n), { select: n.id });
  };
  const addBlock = (subId) => {
    const w = wfsRef.current; const d = w[docId];
    if (d.kind === 'sub') { say('Ouvrez un workflow pour y insérer ce bloc.'); return; }
    const n = makeNode('loop', d, w); n.data.run = subId; n.data.elt = w[subId].param;
    const end = d.nodes.find((x) => x.type === 'end'); const e = d.edges.find((x) => x.target === end.id);
    edit((x) => insertOnEdge(x, e.id, n), { select: n.id });
  };
  const detachSub = (loopId) => {
    const w = wfsRef.current; const d = w[docId]; const ln = nodeOf(d, loopId); const src = w[ln.data.run];
    let k = 2; while (w[`${src.id}_copie${k > 2 ? k : ''}`]) k++; const id = `${src.id}_copie${k > 2 ? k : ''}`;
    commit({ ...w, [id]: { ...src, id, title: id }, [docId]: { ...d, nodes: d.nodes.map((x) => (x.id === loopId ? { ...x, data: { ...x.data, run: id } } : x)) } });
    say(`Copie détachée : ${id}. Modifiez-la sans toucher aux autres workflows.`);
  };
  const del = (id) => { if (edit((d) => deleteNode(d, id), { msg: 'Début et fin ne se suppriment pas.' })) setSel(null); };
  const openAdd = useCallback((edgeId, rect) => setAddMenu({ edgeId, x: rect.left + rect.width / 2, y: rect.bottom + 6 }), []);

  const openDoc = (id, select) => { setMode('edit'); setDocId(id); setSel(select || null); setDual(false); if (wfsRef.current[id].kind === 'main') setRootId(id); setFocus(null); if (bp === 's') setDrawer(null); };
  const openSub = useCallback((id) => { if (wfsRef.current[id]) { setDocId(id); setSel(null); setDual(false); } }, []);
  const setDir = (v) => { setDirS(v); ls.set('sp-dir', v); const n = {}; Object.values(wfsRef.current).forEach((d) => { n[d.id] = relay(d, v); }); setW(n); setStruct((x) => x + 1); };
  const reflow = () => { setW({ ...wfsRef.current, [docId]: relay(wfsRef.current[docId], dir) }); setStruct((x) => x + 1); say('Flux réorganisé'); };
  const duplicateFlow = () => {
    const id = 'copy' + Math.random().toString(36).slice(2, 5); const d = wfsRef.current[rootId];
    commit({ ...wfsRef.current, [id]: { ...d, id, title: d.title + ' (copie)', status: 'Brouillon · v1' } }); openDoc(id); say('Flux dupliqué');
  };

  const createFlow = ({ title, noun, template, lines }) => {
    const id = 'wf' + Math.random().toString(36).slice(2, 6); const w = wfsRef.current;
    let d;
    if (template === 'inventory' || template === 'merch') d = { ...w[template], id, title, noun, status: 'Brouillon · v1' };
    else {
      const base = relay({ id, kind: 'main', title, noun, status: 'Brouillon · v1', subtitle: 'Nouveau workflow',
        nodes: [{ id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} }, { id: 'intro', type: 'step', position: { x: 0, y: 0 }, data: { kind: 'info', label: title, body: 'Décrivez ici la consigne de départ.' } }, { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: {} }],
        edges: [{ id: 'e1', source: 'start', target: 'intro' }, { id: 'e2', source: 'intro', target: 'end' }] }, dir);
      d = base;
      (template === 'text' ? lines : []).forEach((ln) => { const spec = parseLine(ln); const n = makeNode(spec.type, d, w); n.data.label = spec.label; if (spec.options) n.data.options = spec.options; n.data.key = makeKey(spec.label, d); const end = d.nodes.find((x) => x.type === 'end'); const e = d.edges.find((x) => x.target === end.id); d = insertOnEdge(d, e.id, n); });
    }
    commit({ ...w, [id]: relay(d, dir) }); setRootId(id); setDocId(id); setSel(null); setMode('edit'); setView('studio'); setNewOpen(false); say('Workflow créé : ' + title);
  };

  /* ---- engine ---- */
  const engRef = useRef(null); const [ver, setVer] = useState(0); const bump = () => setVer((v) => v + 1);
  const api = useMemo(() => ({
    set: (k, v) => { engRef.current.data[k] = v; bump(); },
    submit: (t) => { eSubmit(engRef.current, t); bump(); },
    back: (t) => { eBack(engRef.current, t); bump(); },
    restart: (rid, from) => { engRef.current = from ? previewEngine(wfsRef.current, from.docId, from.nodeId, rootRef.current) : createEngine(wfsRef.current, typeof rid === 'string' ? rid : rootRef.current); bump(); },
  }), []);
  const rootRef = useRef(rootId); rootRef.current = rootId;
  const eng = engRef.current;
  const dockOn = view === 'studio' && mode === 'edit' && (bp === 'l' || bp === 'xl');
  useEffect(() => {
    if (view !== 'studio') return;
    if (mode === 'play') { const t = setTimeout(() => api.restart(), 0); return () => clearTimeout(t); }
    if (dockOn) {
      const s = sel && nodeOf(wfsRef.current[docId], sel); const from = s && s.type === 'step' ? { docId, nodeId: s.id } : null;
      const t = setTimeout(() => api.restart(undefined, from), 250); return () => clearTimeout(t);
    }
  }, [mode, dockOn, struct, rootId, view, sel, docId]);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => {
      const e = engRef.current; if (!e) return;
      let any = false;
      for (const t of [...e.threads]) {
        if (!e.threads.includes(t) || t.status !== 'run' || !t.screen || t.screen.complete) continue;
        const n = t.screen.node.data;
        if (n.kind === 'input' && !hasValue(e.data[t.screen.key])) { const v = demoValue(e, t.screen); if (v !== undefined) e.data[t.screen.key] = v; }
        eSubmit(e, t); any = true;
      }
      bump(); if (!any) setAuto(false);
    }, 650);
    return () => clearInterval(id);
  }, [auto]);

  /* ---- derived canvas data ---- */
  const overlay = useMemo(() => {
    const o = {}; if (!eng || mode !== 'play') return o;
    eng.visited.forEach((id) => { o[id] = { active: [], done: true }; });
    eng.threads.forEach((t) => {
      if (t.status === 'run' && t.stack.length > 1) { const g = `${t.stack[0].nodeId}::${t.stack[1].nodeId}`; if (!o[g]) o[g] = { active: [], done: false }; o[g].active.push({ color: t.color, letter: t.letter }); }
      if (t.status === 'parked' || (t.status === 'done' && !t.parent)) return;
      const id = t.stack[0].nodeId; if (!o[id]) o[id] = { active: [], done: false };
      if (t.status !== 'done') o[id].active.push({ color: t.color, letter: t.letter });
    });
    return o;
  }, [ver, mode, eng]);

  const isOpen = (id) => mode === 'play' || !!unfold[`${docId}:${id}`];
  const xd = useMemo(() => expandDoc(doc, wfs, isOpen, dir), [doc, wfs, unfold, mode, dir, docId]);
  const xinfo = useMemo(() => { const g = {}; Object.keys(xd.ghostOf).forEach((l) => xd.ghostOf[l].forEach((id) => { if (info.byNode[l]) g[id] = info.byNode[l]; })); return { ...info, byNode: { ...info.byNode, ...g } }; }, [xd, info]);
  const xdoc = useMemo(() => ({ id: doc.id, nodes: xd.nodes, edges: xd.edges }), [doc.id, xd]);
  const mkNodes = (d, inf, ovl, selId) => d.nodes.map((n) => {
    const entry = n.type === 'join' ? inf.forks.find((f) => f.join && f.join.id === n.id) : null;
    return { ...n, selected: n.id === selId, data: { ...n.data, _id: n.id, _open: n.type === 'loop' && isOpen(n.id), _br: inf.byNode[n.id], _n: entry ? entry.branches.length : undefined, _play: ovl[n.id], _cm: collab.on && collab.show ? (comments[`${d.id}:${n.id}`] || []).filter((c) => !c.done).length : 0 } };
  });
  const mkEdges = (d, inf, editable, ovl) => d.edges.map((e) => {
    const src = nodeOf(d, e.source); let br;
    if (src && src.type === 'fork') { const i = src.data.branches.findIndex((b) => b.id === e.sourceHandle); br = { idx: i }; } else br = inf.byNode[e.source];
    const o = ovl && ovl[e.source];
    return { id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, type: 'plus', data: { color: br ? BR[br.idx].color : undefined, mk: br ? BR[br.idx].mk : 'arr-n', editable: editable && !e.ghost, onAdd: openAdd, dim: mode === 'play' && !e.ghost && !(o && (o.done || o.active.length)) } };
  });
  const dnodes = useMemo(() => mkNodes(xdoc, xinfo, overlay, mode === 'play' ? null : sel), [xdoc, xinfo, overlay, sel, mode, comments, collab.on, collab.show, unfold]);
  const dedges = useMemo(() => mkEdges(xdoc, xinfo, mode === 'edit', overlay), [xdoc, xinfo, overlay, mode]);
  const toggleUnfold = useCallback((id) => setUnfold((u) => { const k = `${docIdRef.current}:${id}`; return { ...u, [k]: !u[k] }; }), []);
  const ctx = useMemo(() => ({ dir, editable: mode === 'edit', openSub, toggleUnfold }), [dir, mode, openSub, toggleUnfold]);

  const onChanges = useCallback((changes, onlyDims) => {
    const ch = changes.filter((c) => (onlyDims ? c.type === 'dimensions' : c.type === 'position' || c.type === 'dimensions'));
    if (!ch.length) return; const prev = wfsRef.current; const d = prev[docIdRef.current];
    setW({ ...prev, [d.id]: { ...d, nodes: applyNodeChanges(ch, d.nodes) } });
  }, []);
  const docIdRef = useRef(docId); docIdRef.current = docId;
  const onNode = useCallback((_, n) => { if (n.data && n.data._ghost) { setDocId(n.data._gsub); setSel(n.data._gnode); setInspTab('step'); return; } setSel(n.id); setInspTab('step'); if (bp === 's') setDrawer('right'); }, [bp]);
  const onPane = useCallback(() => setSel(null), []);

  const checks = useMemo(() => validate(wfs, doc), [wfs, doc]);
  const okAll = checks.every((c) => c.ok);
  const forks = info.forks; const hasFork = forks.length > 0;
  useEffect(() => { if (!hasFork) setDual(false); if (forkIdx >= forks.length) setForkIdx(0); }, [hasFork, forks.length]);

  /* ---- keyboard ---- */
  useEffect(() => {
    const k = (e) => {
      const tag = (e.target.tagName || '').toLowerCase(); const typing = ['input', 'textarea', 'select'].includes(tag);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal((p) => !p); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (e.key === 'Escape') { setAddMenu(null); setMenu(null); setPal(false); return; }
      if (typing || view !== 'studio' || mode !== 'edit') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); del(sel); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && sel) { e.preventDefault(); edit((d) => duplicateNode(d, sel)); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  const goPlay = () => { if (doc.kind === 'sub') setDocId(rootId); setMode('play'); setDual(false); setAuto(false); setDrawer(null); };
  const goEdit = () => { setMode('edit'); setAuto(false); };

  /* ---- palette commands ---- */
  const commands = () => {
    const c = [];
    c.push({ g: 'Navigation', t: 'Tableau de bord', ic: 'grid', run: () => setView('dashboard') }, { g: 'Navigation', t: 'Tous les workflows', ic: 'list', run: () => setView('flows') }, { g: 'Navigation', t: 'Nouveau workflow', ic: 'plus', run: () => setNewOpen(true) }, { g: 'Actions', t: 'Lancer le Play', ic: 'play', k: 'P', run: goPlay }, { g: 'Actions', t: 'Revenir à l’édition', ic: 'flow', run: goEdit });
    if (hasFork) c.push({ g: 'Actions', t: dual ? 'Fermer la vue parallèle' : 'Ouvrir la vue parallèle (double flux)', ic: 'columns', run: () => { setMode('edit'); setDual(!dual); } });
    c.push({ g: 'Actions', t: 'Réorganiser le flux', ic: 'layout', run: reflow }, { g: 'Actions', t: dir === 'TB' ? 'Flux horizontal' : 'Flux vertical', ic: 'updown', run: () => setDir(dir === 'TB' ? 'LR' : 'TB') },
      { g: 'Actions', t: 'Annuler', ic: 'undo', k: MOD + 'Z', run: undo }, { g: 'Actions', t: 'App mobile (démo)', ic: 'phone', run: () => setView('mobile') }, { g: 'Actions', t: 'Studio', ic: 'flow', run: () => setView('studio') },
      { g: 'Affichage', t: theme === 'dark' ? 'Thème clair' : 'Thème sombre', ic: theme === 'dark' ? 'sun' : 'moon', run: () => setThemeS(theme === 'dark' ? 'light' : 'dark') },
      { g: 'Affichage', t: 'Mode grand écran', ic: 'monitor', run: () => setDensity('wide') }, { g: 'Affichage', t: 'Mode compact', ic: 'layout', run: () => setDensity('compact') });
    Object.values(wfs).filter((d) => d.kind === 'main').forEach((d) => c.push({ g: 'Flux', t: d.title, s: d.status, ic: 'flow', run: () => { setView('studio'); openDoc(d.id); } }));
    Object.values(wfs).filter((d) => d.kind === 'sub').forEach((d) => c.push({ g: 'Sous-routines', t: d.title, s: 'RUN', ic: 'loop', run: () => { setView('studio'); setMode('edit'); setDocId(d.id); setSel(null); } }));
    doc.nodes.filter((n) => n.type === 'step' || n.type === 'loop').forEach((n) => c.push({ g: 'Étapes de ce flux', t: n.data.label || ('Boucle ' + n.data.run), s: n.data.key || '', ic: n.type === 'loop' ? 'loop' : n.data.kind === 'info' ? 'info' : (INPUTS[n.data.input] || {}).ic || 'file', run: () => { setView('studio'); setMode('edit'); setSel(n.id); setFocus({ id: n.id, tick: Date.now() }); } }));
    ADD_TYPES.forEach((t) => c.push({ g: 'Ajouter après la sélection', t: t.label, ic: t.ic, run: () => { setView('studio'); setMode('edit'); addAfterSel(t.id); } }));
    return c;
  };

  const openPar = (forkId) => { const i = forks.findIndex((f) => f.fork.id === forkId); if (i >= 0) setForkIdx(i); setDual(true); };
  const solos = solo;
  const layoutCls = cls('app', 'bp-' + bp, drawer && 'dr-' + drawer);

  return <div className={layoutCls} onClick={() => { setMenu(null); }}>
    <Markers />
    <TopBar {...{ collab, setCollab, people, setPeople, review, setReview, say, newFlow: () => setNewOpen(true), view, setView, mode, goPlay, goEdit, wfs, doc, docId, rootId, openDoc, okAll, checks, undo, redo, hist: hist.current, setPal, theme, setThemeS, density, setDensity, dir, setDir, minimap, setMinimap, bp, drawer, setDrawer, menu, setMenu, setInspTab, setSideTab, struct }} />
    {view === 'dashboard' ? <Dashboard wfs={wfs} openDoc={(id) => { setView('studio'); openDoc(id); }} setView={setView} newFlow={() => setNewOpen(true)} />
      : view === 'flows' ? <FlowsHome wfs={wfs} openDoc={(id) => { setView('studio'); openDoc(id); }} newFlow={() => setNewOpen(true)} />
      : view === 'mobile'
      ? <MobileDemo e={eng} api={api} wfs={wfs} width={width} ver={ver} />
      : <div className={cls('work', mode === 'play' && 'is-play')}>
        <aside className="side">
          <Sidebar {...{ addBlock, wfs, doc, docId, rootId, openDoc, sideTab, setSideTab, sel, setSel, setFocus, addAfterSel, duplicateFlow, mode, setMode, setDocId, bp, setDrawer }} />
        </aside>
        <main className="center">
          {mode === 'edit' && <>
            {doc.kind === 'sub' && <div className="subbar"><button onClick={() => openDoc(rootId)}><Ic n="left" s={14} /> {root.title}</button><span>/</span><b>{doc.title}</b><em>sous-routine · paramètre {'{' + doc.param + '}'}{(() => { const u = usageOf(wfs, doc.id); return u.uses > 1 ? ` · partagée : ${u.uses} usages` : ''; })()}</em></div>}
            <div className={cls('stage-wrap', dual && hasFork && 'dual')}>
            <div className="cv-tools">
              {!dual && <button className="tb" onClick={() => setDir(dir === 'TB' ? 'LR' : 'TB')} title="Changer le sens du flux"><Ic n="updown" s={15} />{dir === 'TB' ? 'Vertical' : 'Horizontal'}</button>}
              {!dual && <button className="tb" onClick={reflow} title="Réorganiser automatiquement"><Ic n="layout" s={15} />Réorganiser</button>}
              {!dual && doc.nodes.some((n) => n.type === 'loop') && (() => { const ids = doc.nodes.filter((n) => n.type === 'loop').map((n) => `${docId}:${n.id}`); const all = ids.every((k) => unfold[k]); return <button className={cls('tb', all && 'on')} onClick={() => setUnfold((u) => { const x = { ...u }; ids.forEach((k) => { x[k] = !all; }); return x; })} title="Afficher les étapes des sous-routines dans le flux"><Ic n="loop" s={15} />{all ? 'Replier les blocs' : 'Déplier les blocs'}</button>; })()}
              {collab.on && <button className={cls('tb', collab.show && 'on')} onClick={() => setCollab({ ...collab, show: !collab.show })} title={collab.show ? 'Masquer les commentaires sur le canvas' : 'Afficher les commentaires sur le canvas'}><Ic n="chat" s={15} />Commentaires<i>{openCm}</i></button>}
              {collab.on && sel && <button className="tb" onClick={() => { setInspTab('comments'); setDrawer('right'); }} title="Commenter l’étape sélectionnée"><Ic n="plus" s={15} />Commenter</button>}
              {hasFork && <button className={cls('tb', dual && 'on')} onClick={() => setDual(!dual)}><Ic n="columns" s={15} />Vue parallèle<i>{forks.reduce((a, f) => a + f.branches.length, 0)}</i></button>}
            </div>
            {dual && hasFork
              ? <ParallelView {...{ doc, info, forks, forkIdx, setForkIdx, sel, setSel, ctx, onChanges, openAdd, edit, mkEdges, say, setFocus }} />
              : <div className="cv"><Canvas nodes={dnodes} edges={dedges} ctx={ctx} fitKey={`${docId}|${dir}|${struct}|${bp}|${mode}|${dual}|${Object.keys(unfold).filter((k) => unfold[k]).join()}`} minimap={minimap && bp !== 's'} onChanges={(c) => onChanges(c)} onNodeClick={onNode} onPaneClick={onPane} focus={focus} /></div>}
            </div>
          </>}
          {mode === 'play' && <PlayView {...{ eng, api, ver, dnodes, dedges, ctx, root, solo: solos, setSolo, auto, setAuto, panel, setPanel, showPanel, setShowPanel, onChanges, bp, struct, docId, dir }} />}
        </main>
        {mode === 'edit' && <aside className="insp"><Inspector {...{ doc, wfs, selNode, info, inspTab, setInspTab, checks, updateNode, updateDoc, del, edit, openSub, setSel, setFocus, setDual: () => openPar((forks[0] || {fork:{}}).fork.id), openPar, hasFork, collab, comments, setComments, people, addStep, say, detachSub }} /></aside>}
        {dockOn && eng && <aside className="dock">
          <div className="dock-h"><b>Aperçu live</b><span>{eng.preview ? `Étape : ${(selNode && selNode.data.label) || ''}` : root.title}</span>
            <button className="ib" onClick={() => api.restart(undefined, eng.preview && selNode && selNode.type === 'step' ? { docId, nodeId: selNode.id } : undefined)} title="Rejouer"><Ic n="restart" s={15} /></button>
            <button className={cls('ib', auto && 'on')} onClick={() => setAuto(!auto)} title="Lecture auto"><Ic n={auto ? 'pause' : 'zap'} s={15} /></button></div>
          <div className="dock-b"><PlayStage e={eng} api={api} solo={false} /></div>
          <button className="dock-go" onClick={goPlay}><Ic n="play" s={14} /> Ouvrir en plein Play</button>
        </aside>}
        {bp === 's' && drawer && <div className="scrim" onClick={() => setDrawer(null)} />}
      </div>}
    {newOpen && <NewFlow close={() => setNewOpen(false)} create={createFlow} />}
    {addMenu && <AddMenu m={addMenu} close={() => setAddMenu(null)} pick={(t) => { setAddMenu(null); addOnEdge(addMenu.edgeId, t); }} />}
    {pal && <Palette items={commands()} close={() => setPal(false)} />}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

/* ------------------------------------------------------------------ Top bar */
function TopBar({ collab, setCollab, people, setPeople, review, setReview, say, newFlow, view, setView, mode, goPlay, goEdit, wfs, doc, docId, rootId, openDoc, okAll, checks, undo, redo, hist, setPal, theme, setThemeS, density, setDensity, dir, setDir, minimap, setMinimap, bp, drawer, setDrawer, menu, setMenu, setInspTab, setSideTab, struct }) {
  const root = wfs[rootId]; const bad = checks.filter((c) => !c.ok).length;
  const stop = (e) => e.stopPropagation();
  return <header className="top" onClick={stop}>
    {bp === 's' && view === 'studio' && <button className="ib" onClick={() => setDrawer(drawer === 'left' ? null : 'left')} aria-label="Navigation"><Ic n="menu" s={18} /></button>}
    <div className="logo"><Emblem /><b className="hide-s">Zenko <em>Studio</em></b></div>
    <nav className="views" aria-label="Vue">
      <button className={view === 'dashboard' ? 'on' : ''} onClick={() => setView('dashboard')}><Ic n="grid" s={15} /><span className="hide-s">Tableau de bord</span></button>
      <button className={view === 'flows' ? 'on' : ''} onClick={() => setView('flows')}><Ic n="list" s={15} /><span className="hide-s">Workflows</span></button>
      <button className={view === 'studio' ? 'on' : ''} onClick={() => setView('studio')}><Ic n="flow" s={15} /><span className="hide-s">Studio</span></button>
      <button className={view === 'mobile' ? 'on' : ''} onClick={() => setView('mobile')}><Ic n="phone" s={15} /><span className="hide-s">App mobile</span></button>
    </nav>
    {view === 'studio' && <>
      <div className="crumb">
        <button className="sw" onClick={(e) => { stop(e); setMenu(menu === 'flows' ? null : 'flows'); }}><span className="t">{root.title}</span><span className="chip">{root.status}</span><Ic n="down" s={14} /></button>
        {doc.kind === 'sub' && <><Ic n="right" s={13} /><span className="t mono">{doc.title}</span></>}
        {menu === 'flows' && <div className="pop sw-pop" onClick={stop}>{Object.values(wfs).filter((d) => d.kind === 'main').map((d) => <button key={d.id} className={d.id === rootId ? 'on' : ''} onClick={() => { setMenu(null); openDoc(d.id); }}><b>{d.title}</b><span>{d.status}</span></button>)}</div>}
      </div>
      <div className="seg mode" role="tablist" aria-label="Mode">
        <button role="tab" aria-selected={mode === 'edit'} className={mode === 'edit' ? 'on' : ''} onClick={goEdit}><Ic n="pen" s={14} />Éditer</button>
        <button role="tab" aria-selected={mode === 'play'} className={cn(mode === 'play')} onClick={goPlay}><Ic n="play" s={13} />Play</button>
      </div>
    </>}
    <div className="sp" />
    {view === 'studio' && mode === 'edit' && <>
      <div className="rel"><span className={cls('pill', okAll ? 'ok' : 'bad', 'hide-s')} onClick={() => setMenu(menu === 'checks' ? null : 'checks')} role="button" tabIndex={0}><Ic n={okAll ? 'check' : 'alert'} s={13} sw={2.4} />{okAll ? 'Valide' : `${bad} point(s)`}</span>
        {menu === 'checks' && <div className="pop checks-pop" onClick={(e) => e.stopPropagation()}>{checks.map((c, i) => <div key={i} className={cls('ck', c.ok ? 'ok' : 'bad')}><Ic n={c.ok ? 'check' : 'alert'} s={14} sw={2.4} /><span>{c.label}</span></div>)}<p className="hintp">Le flux ne peut être activé que si tous les points sont verts.</p></div>}
      </div>
      <button className="ib hide-s" onClick={undo} disabled={!hist.past.length} title={`Annuler (${MOD}Z)`}><Ic n="undo" s={16} /></button>
      <button className="ib hide-s" onClick={redo} disabled={!hist.future.length} title="Rétablir"><Ic n="redo" s={16} /></button>
    </>}
    {view === 'studio' && <div className="rel"><button className={cls('btn collab-btn', collab.on && 'on')} onClick={(e) => { stop(e); setMenu(menu === 'collab' ? null : 'collab'); }} title="Collaboration et assistant">
      {collab.on ? <span className="avs">{people.slice(0, 3).map((p) => <Avatar key={p.id} p={p} s={22} />)}</span> : <Ic n="users" s={15} />}{collab.on ? (review !== 'draft' && <span className={cls('chip', review === 'approved' && 'okc')}>{review === 'approved' ? 'Validé' : 'En relecture'}</span>) : <span className="hide-s">Collaborer</span>}{collab.bot && <Ic n="zap" s={13} />}</button>
      {menu === 'collab' && <CollabPop {...{ collab, setCollab, people, setPeople, review, setReview, say }} />}</div>}
    <button className="kbtn" onClick={() => setPal(true)}><Ic n="search" s={14} /><span className="hide-s">Aller à…</span><kbd className="hide-s">{MOD}K</kbd></button>
    {(view === 'dashboard' || view === 'flows') && <button className="btn pri" onClick={newFlow}><Ic n="plus" s={14} sw={2.4} /><span className="hide-s">Nouveau workflow</span></button>}
    <button className="ib" onClick={() => setThemeS((theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) ? 'light' : 'dark')} aria-label="Basculer clair / sombre" title="Clair / sombre">{theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? <Ic n="sun" s={16} /> : <Ic n="moon" s={16} />}</button>
    <div className="rel"><button className="ib" onClick={(e) => { stop(e); setMenu(menu === 'view' ? null : 'view'); }} aria-label="Affichage" title="Affichage"><Ic n="sliders" s={16} /></button>
      {menu === 'view' && <div className="pop view-pop" onClick={stop}>
        <div className="pg">Thème</div><Seg value={theme} set={setThemeS} opts={[['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']]} />
        <div className="pg">Écran</div><Seg value={density} set={setDensity} opts={[['auto', 'Auto'], ['compact', 'Compact'], ['wide', 'Grand écran']]} />
        <div className="ph">Grand écran : plan et inspecteur plus larges, aperçu mobile live en permanence.</div>
        <div className="pg">Sens du flux</div><Seg value={dir} set={setDir} opts={[['TB', 'Vertical'], ['LR', 'Horizontal']]} />
        <label className="chk"><input type="checkbox" checked={minimap} onChange={(e) => setMinimap(e.target.checked)} />Mini-carte</label>
      </div>}</div>
    {view === 'studio' && mode === 'edit' && <button className={cls('btn pri', !okAll && 'off')} disabled={!okAll} title={okAll ? 'Activer ce flux' : 'Corrigez les points de contrôle'}>Activer</button>}
    {bp === 's' && view === 'studio' && mode === 'edit' && <button className="ib" onClick={() => setDrawer(drawer === 'right' ? null : 'right')} aria-label="Inspecteur"><Ic n="layout" s={18} /></button>}
  </header>;
  function cn(on) { return on ? 'on play' : 'play'; }
}

function Seg({ value, set, opts }) { return <div className="seg sm">{opts.map(([v, l]) => <button key={v} className={value === v ? 'on' : ''} onClick={() => set(v)}>{l}</button>)}</div>; }

/* ------------------------------------------------------------------ Sidebar */
function Sidebar({ addBlock, wfs, doc, docId, rootId, openDoc, sideTab, setSideTab, sel, setSel, setFocus, addAfterSel, duplicateFlow, mode, bp, setDrawer, setDocId }) {
  const mains = Object.values(wfs).filter((d) => d.kind === 'main'); const subs = Object.values(wfs).filter((d) => d.kind === 'sub');
  const rows = useMemo(() => outline(doc), [doc]);
  const tabs = [['flux', 'Flux', 'flow'], ['plan', 'Plan', 'list'], ['add', 'Ajouter', 'plus']];
  const stepsOf = (d) => d.nodes.filter((n) => n.type === 'step').length;
  return <div className="side-in">
    <div className="stabs" role="tablist">{tabs.map(([k, l, ic]) => <button key={k} role="tab" aria-selected={sideTab === k} className={sideTab === k ? 'on' : ''} onClick={() => setSideTab(k)}><Ic n={ic} s={14} />{l}</button>)}</div>
    <div className="side-scroll">
      {sideTab === 'flux' && <>
        <div className="sh">Workflows</div>
        {mains.map((d) => { const f = d.nodes.filter((n) => n.type === 'fork').length; return <button key={d.id} className={cls('li', d.id === rootId && docId === d.id && 'on', d.id === rootId && 'root')} onClick={() => openDoc(d.id)}>
          <span className="li-t"><b>{d.title}</b><span>{d.subtitle}</span></span>
          <span className="li-m"><span className="chip">{d.status}</span><span className="mut">{stepsOf(d)} étapes{f ? ` · ${f} parallèle` : ''}</span></span></button>; })}
        <button className="li ghost" onClick={duplicateFlow}><Ic n="copy" s={14} />Dupliquer ce flux</button>
        <div className="sh">Sous-routines</div>
        {subs.map((d) => { const u = usageOf(wfs, d.id); return <div key={d.id} className="li-wrap"><button className={cls('li', docId === d.id && 'on')} onClick={() => { setDocId(d.id); setSel(null); if (bp === 's') setDrawer(null); }}><span className="li-t"><b className="mono">{d.title}</b><span>paramètre {'{' + d.param + '}'}</span></span><span className="li-m"><span className="mut">{stepsOf(d)} étapes · {u.uses ? `utilisé dans ${u.docs} workflow${u.docs > 1 ? 's' : ''}` : 'non utilisé'}</span></span></button>
          <button className="li-add" title="Insérer ce bloc à la fin du workflow ouvert" onClick={() => addBlock(d.id)}><Ic n="plus" s={13} sw={2.4} />Insérer</button></div>; })}
        <p className="hintp">Blocs réutilisables : une même sous-routine peut servir dans plusieurs workflows. Sur le canvas, « Déplier » affiche ses étapes en place.</p>
      </>}
      {sideTab === 'plan' && <>
        <div className="sh">Plan de « {doc.title} »</div>
        <div className="outline">{rows.filter((r) => r.n.type !== 'start' && r.n.type !== 'end').map(({ n, depth, br }, i) => {
          const ic = n.type === 'fork' ? 'branch' : n.type === 'join' ? 'columns' : n.type === 'loop' ? 'loop' : n.data.kind === 'info' ? 'info' : n.data.kind === 'summary' ? 'file' : INPUTS[n.data.input].ic;
          const lab = n.type === 'fork' ? 'Départ en parallèle' : n.type === 'join' ? 'Fin des branches' : n.type === 'loop' ? `Pour chaque ${n.data.elt} → ${n.data.run}` : n.data.label;
          return <button key={n.id + i} className={cls('ol', sel === n.id && 'on', br && 'br')} style={{ '--c': br ? BR[br.idx].color : 'transparent', paddingLeft: 10 + depth * 14 }} onClick={() => { if (mode !== 'edit') return; setSel(n.id); setFocus({ id: n.id, tick: Date.now() }); if (bp === 's') setDrawer(null); }}>
            {br && <i className="ol-b" style={{ background: BR[br.idx].color }}>{BR[br.idx].letter}</i>}<Ic n={ic} s={14} /><span>{lab}</span></button>; })}</div>
      </>}
      {sideTab === 'add' && <>
        <div className="sh">Ajouter après la sélection</div>
        {['Structure', 'Saisie'].map((g) => <div key={g}><div className="sg">{g}</div><div className="pgrid">{ADD_TYPES.filter((t) => t.group === g).map((t) => <button key={t.id} className="pt" onClick={() => addAfterSel(t.id)} title={t.hint || t.label}><Ic n={t.ic} s={16} /><span>{t.label}</span></button>)}</div></div>)}
        <p className="hintp">Astuce : survolez un lien du canvas et cliquez sur <b>+</b> pour insérer exactement à cet endroit.</p>
      </>}
    </div>
  </div>;
}

/* ------------------------------------------------------------------ Inspector */
function Fld({ l, children, help }) { return <label className="fld"><span className="fl">{l}</span>{children}{help && <span className="fh">{help}</span>}</label>; }
function Tog({ l, v, set }) { return <label className="tog"><input type="checkbox" checked={!!v} onChange={(e) => set(e.target.checked)} /><i />{l}</label>; }

function Inspector({ doc, wfs, selNode, info, inspTab: tab0, setInspTab, checks, updateNode, updateDoc, del, edit, openSub, setSel, setFocus, setDual, openPar, hasFork, collab, comments, setComments, people, addStep, say, detachSub }) {
  const bad = checks.filter((c) => !c.ok).length;
  const nOpen = collab.on ? doc.nodes.reduce((s, n) => s + (comments[`${doc.id}:${n.id}`] || []).filter((c) => !c.done).length, 0) : 0;
  const tabs = [['step', 'Étape'], ...(collab.on ? [['comments', 'Commentaires']] : []), ...(collab.bot ? [['bot', 'Assistant']] : [])];
  const inspTab = tabs.some(([k]) => k === tab0) ? tab0 : 'step';
  return <div className="insp-in">
    <div className="stabs" role="tablist">
      {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={inspTab === k} className={inspTab === k ? 'on' : ''} onClick={() => setInspTab(k)}>{l}{k === 'comments' && nOpen > 0 && <i className="dot bad">{nOpen}</i>}{k === 'check' && <i className={cls('dot', bad ? 'bad' : 'ok')}>{bad || '✓'}</i>}</button>)}
    </div>
    <div className="insp-scroll">
      {inspTab === 'step' && (selNode ? <NodeForm {...{ doc, wfs, n: selNode, info, updateNode, del, edit, openSub, setDual, openPar, detachSub }} /> : <><div className="empty"><Ic n="flow" s={28} /><b>Sélectionnez une étape</b><p>Cliquez sur un nœud du canvas ou du plan pour l’éditer. Survolez un lien et cliquez sur <b>+</b> pour insérer une étape.</p>{hasFork && <button className="btn" onClick={() => setDual(true)}><Ic n="columns" s={15} />Voir les branches côte à côte</button>}
          </div><div className="flow-info">
            <Fld l={doc.kind === 'sub' ? 'Nom de la sous-routine' : 'Titre du flux'}><input className="in" value={doc.title} onChange={(e) => updateDoc({ title: e.target.value })} /></Fld>
            {doc.kind === 'main' && <><Fld l="Sous-titre"><input className="in" value={doc.subtitle || ''} onChange={(e) => updateDoc({ subtitle: e.target.value })} /></Fld>
              <Fld l="Nom terrain" help="Affiché dans l’app mobile."><select className="in" value={doc.noun} onChange={(e) => updateDoc({ noun: e.target.value })}>{[' Inventaire', 'Visite', 'Réception', 'Contrôle'].map((x) => <option key={x}>{x}</option>)}</select></Fld></>}
            {doc.kind === 'sub' && <Fld l="Paramètre reçu"><input className="in mono" value={doc.param} onChange={(e) => updateDoc({ param: e.target.value })} /></Fld>}
            <div className="stats"><div><b>{doc.nodes.filter((n) => n.type === 'step').length}</b><span>étapes</span></div><div><b>{doc.nodes.filter((n) => n.type === 'loop').length}</b><span>boucles</span></div><div><b>{doc.nodes.filter((n) => n.type === 'fork').length}</b><span>parallèles</span></div></div>
          </div></>)}
      {inspTab === 'comments' && <CommentsTab {...{ doc, sel: selNode && selNode.id, setSel, comments, setComments, people, can: true }} />}
      {inspTab === 'bot' && <AssistantTab {...{ doc, checks, addStep, say }} />}


    </div>
  </div>;
}

function NodeForm({ doc, wfs, n, info, updateNode, del, edit, openSub, setDual, openPar, detachSub }) {
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

/* ------------------------------------------------------------------ Parallel view */
function ParallelView({ doc, info, forks, forkIdx, setForkIdx, sel, setSel, ctx, onChanges, openAdd, edit, mkEdges, say, setFocus }) {
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

/* ------------------------------------------------------------------ Play */
function PlayView({ eng, api, ver, dnodes, dedges, ctx, root, solo, setSolo, auto, setAuto, panel, setPanel, showPanel, setShowPanel, onChanges, bp, struct, docId, dir }) {
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

/* ------------------------------------------------------------------ Mobile demo */
function MobileDemo({ e, api, wfs, width, ver }) {
  const [scr, setScr] = useState('inbox'); const [synced, setSynced] = useState({});
  const [cur, setCur] = useState(null);
  const mains = Object.values(wfs).filter((d) => d.kind === 'main');
  const start = (id) => { setCur(id); api.restart(id); setScr('run'); };
  const done = () => { setSynced((s) => ({ ...s, [cur]: true })); setScr('inbox'); };
  const data = e ? Object.entries(e.data).filter(([k]) => !k.startsWith('__')) : [];
  return <div className="mob">
    <div className="mob-side">
      <h1>App mobile</h1>
      <p>Un opérateur seul sur le terrain. Quand un flux a des branches parallèles, elles deviennent des onglets : il passe de l’une à l’autre sans perdre sa place.</p>
      <ul><li>Mode hors ligne, une saisie par écran</li><li>Boucles : un passage par rayon ou par produit</li><li>Branches parallèles : onglets en haut de l’écran</li></ul>
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
          <div className="ph-nav"><button className="ph-nav-btn active"><Ic n="inbox" s={20} /><span>Tâches</span></button><button className="ph-nav-btn sync"><Ic n="restart" s={20} /><span className="ph-sync-dot" /><span>Synchro</span></button><button className="ph-nav-btn"><Ic n="user" s={20} /><span>Profil</span></button></div></div></FitBox>
        : <PlayStage e={e} api={api} solo onDone={done} />}
    </div>
  </div>;
}


/* ------------------------------------------------------------------ parse / dashboard / library / wizard */
function parseLine(raw) {
  const s = raw.trim(); const n = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let label = s, options;
  const m = s.match(/^(.*?)\s*:\s*(.+\/.+)$/);
  if (m) { label = m[1]; options = m[2].split('/').map((x) => x.trim()).filter(Boolean); return { type: /plusieurs|multiple/.test(n) ? 'multi' : 'single', label, options }; }
  const t = /signature|signer/.test(n) ? 'signature' : /photo|image/.test(n) ? 'photo' : /scan|code.?barre|qr/.test(n) ? 'code' : /gps|position|localis/.test(n) ? 'geo' : /date/.test(n) ? 'date' : /note|etoile|satisfaction/.test(n) ? 'stars' : /combien|nombre|quantite|releve|compteur|mesure/.test(n) ? 'number' : /niveau|proprete|pourcent/.test(n) ? 'slider' : 'text';
  return { type: t, label };
}

// DAYS → see src/demo.js
// RECENT → see src/demo.js

function Dashboard({ wfs, openDoc, setView, newFlow }) {
  const mains = Object.values(wfs).filter((d) => d.kind === 'main');
  const max = Math.max(...DAYS); const W = 560, H = 150, bw = W / DAYS.length;
  const tot = DAYS.reduce((a, b) => a + b, 0);
  return <div className="page dash">
    <header className="pg-h"><div><h1>Tableau de bord</h1><p>Vue d’ensemble de vos workflows et des exécutions terrain. <span className="chip">Données d’exemple</span></p></div></header>
    <div className="kpis">
      {[['Exécutions · 14 jours', tot.toLocaleString('fr-FR'), '+12 % vs période précédente', 'up'], ['Taux de complétion', '92 %', '+3 pts', 'up'], ['Durée médiane', '7 min 20', '−45 s', 'up'], ['Gain des branches parallèles', '−38 %', 'vs même flux en séquence', 'up']].map(([l, v, d]) => <div className="kpi" key={l}><span>{l}</span><b>{v}</b><em>{d}</em></div>)}
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
        <div className="stk-l"><span><i style={{ background: 'var(--ok)' }} />Terminé 92 %</span><span><i style={{ background: 'var(--warn)' }} />En cours 5 %</span><span><i style={{ background: 'var(--err)' }} />Abandonné 3 %</span></div></section>
      <section className="card c-wide"><div className="card-h"><h2>Dernières exécutions</h2></div>
        <div className="tbl"><table><thead><tr><th>Workflow</th><th>Site</th><th>Statut</th><th>Durée</th><th>Mode</th></tr></thead><tbody>
          {RECENT.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td><span className={'chip ' + (r[2] === 'Terminé' ? 'okc' : '')}>{r[2]}</span></td><td className="num">{r[3]}</td><td>{r[4] ? 'Parallèle · 2 opérateurs' : 'Parallèle · 1 opérateur'}</td></tr>)}</tbody></table></div></section>
      <section className="card"><div className="card-h"><h2>À surveiller</h2></div>
        {mains.map((d) => { const bad = validate(wfs, d).filter((c) => !c.ok); return <button key={d.id} className="watch" onClick={() => openDoc(d.id)}><span className={'dot ' + (bad.length ? 'bad' : 'ok')}>{bad.length ? bad.length : '✓'}</span><span><b>{d.title}</b><em>{bad.length ? bad[0].label : d.status + ' · prêt à activer'}</em></span><Ic n="right" s={14} /></button>; })}
        <button className="btn block" onClick={newFlow}><Ic n="plus" s={14} />Créer un workflow</button></section>
    </div>
  </div>;
}

function FlowsHome({ wfs, openDoc, newFlow }) {
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

function NewFlow({ close, create }) {
  const [title, setTitle] = useState(''); const [noun, setNoun] = useState('Inventaire'); const [tpl, setTpl] = useState('text');
  const [lines, setLines] = useState('Date de la visite\nÉtat général : bon / moyen / mauvais\nPhoto de l’installation\nCombien de prises défectueuses ?\nSignature du client');
  const tpls = [['text', 'Depuis une liste d’étapes', 'Une ligne par étape, le type est deviné'], ['blank', 'Vide', 'Début, une consigne, fin'], ['inventory', 'Modèle Inventaire magasin', 'Boucle sur les rayons + réserve en parallèle'], ['merch', 'Modèle Visite stock', 'Boucle sur les produits + vitrine en parallèle']];
  const prev = tpl === 'text' ? lines.split('\n').filter((x) => x.trim()).map(parseLine) : [];
  const ok = title.trim().length > 1;
  return <div className="pal-bg" onMouseDown={close}><div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Nouveau workflow">
    <header><h2>Nouveau workflow</h2><button className="ib" onClick={close} aria-label="Fermer"><Ic n="x" s={16} /></button></header>
    <div className="m-b">
      <div className="row"><Fld l="Nom du workflow"><input id="nf-title" autoFocus className="in" placeholder="Ex. Contrôle chaudière" value={title} onChange={(e) => setTitle(e.target.value)} /></Fld>
        <Fld l="Nom côté terrain"><select className="in" value={noun} onChange={(e) => setNoun(e.target.value)}>{['Inventaire', 'Visite', 'Réception', 'Contrôle'].map((x) => <option key={x}>{x}</option>)}</select></Fld></div>
      <div className="tpls" role="radiogroup" aria-label="Point de départ">{tpls.map(([k, t, h]) => <button key={k} role="radio" aria-checked={tpl === k} className={tpl === k ? 'on' : ''} onClick={() => setTpl(k)}><b>{t}</b><em>{h}</em></button>)}</div>
      {tpl === 'text' && <div className="gen"><Fld l="Étapes, une par ligne" help="« Question : choix 1 / choix 2 » crée un choix. Les mots photo, signature, date, scan, GPS, nombre, note sont reconnus."><textarea id="nf-lines" className="in" rows={6} value={lines} onChange={(e) => setLines(e.target.value)} /></Fld>
        <div className="gprev">{prev.map((p, i) => <span key={i} className="chip"><Ic n={(INPUTS[p.type] || {}).ic} s={11} />{INPUTS[p.type].label}</span>)}</div></div>}
    </div>
    <footer><button className="btn" onClick={close}>Annuler</button><button className="btn pri" disabled={!ok} onClick={() => create({ title: title.trim(), noun, template: tpl, lines: lines.split('\n').filter((x) => x.trim()) })}>Créer et ouvrir dans le studio</button></footer>
  </div></div>;
}

/* ------------------------------------------------------------------ Add menu + palette */
function AddMenu({ m, close, pick }) {
  const ref = useRef(null);
  useEffect(() => { const f = (ev) => { if (ref.current && !ref.current.contains(ev.target)) close(); }; setTimeout(() => window.addEventListener('mousedown', f), 0); return () => window.removeEventListener('mousedown', f); }, []);
  const x = Math.max(8, Math.min(m.x - 130, window.innerWidth - 268)); const y = Math.min(m.y, window.innerHeight - 380);
  return <div className="addm" ref={ref} style={{ left: x, top: y }} role="menu">
    {['Structure', 'Saisie'].map((g) => <div key={g}><div className="sg">{g}</div>{ADD_TYPES.filter((t) => t.group === g).map((t) => <button key={t.id} role="menuitem" onClick={() => pick(t.id)}><Ic n={t.ic} s={15} /><span>{t.label}</span>{t.hint && <em>{t.hint}</em>}</button>)}</div>)}
  </div>;
}

function Palette({ items, close }) {
  const [q, setQ] = useState(''); const [i, setI] = useState(0); const list = useRef(null);
  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const res = useMemo(() => { const n = norm(q); const r = n ? items.filter((it) => norm(it.t + ' ' + it.g + ' ' + (it.s || '')).includes(n)) : items.filter((it) => !it.g.startsWith('Ajouter')); return r.slice(0, 40); }, [q]);
  useEffect(() => setI(0), [q]);
  useEffect(() => { const el = list.current && list.current.querySelector('.on'); if (el) el.scrollIntoView({ block: 'nearest' }); }, [i]);
  const run = (it) => { close(); setTimeout(it.run, 0); };
  let last = '';
  return <div className="pal-bg" onMouseDown={close}>
    <div className="pal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Aller à">
      <div className="pal-in"><Ic n="search" s={16} /><input autoFocus placeholder="Flux, étape, action…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(res.length - 1, x + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); } else if (e.key === 'Enter' && res[i]) run(res[i]); else if (e.key === 'Escape') close(); }} /><kbd>esc</kbd></div>
      <div className="pal-l" ref={list}>{res.length ? res.map((it, k) => { const h = it.g !== last; last = it.g; return <React.Fragment key={k}>{h && <div className="sg">{it.g}</div>}
        <button className={k === i ? 'on' : ''} onMouseMove={() => setI(k)} onClick={() => run(it)}><Ic n={it.ic} s={15} /><span>{it.t}</span>{it.s && <em>{it.s}</em>}{it.k && <kbd>{it.k}</kbd>}</button></React.Fragment>; }) : <div className="empty sm">Aucun résultat pour « {q} »</div>}</div>
      <div className="pal-f"><span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span><span><kbd>↵</kbd> ouvrir</span><span>{MOD}K ouvre cette fenêtre partout</span></div>
    </div></div>;
}

createRoot(document.getElementById('root')).render(<App />);
