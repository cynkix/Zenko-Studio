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
import { DAYS, RECENT, PEOPLE0, COMMENTS0, USERS, DATASETS0 } from './demo.js';
import { AssignModal, DatasetsModal } from './admin.jsx';
import { Ic } from './icons.jsx';
import { expandDoc, usageOf, makeKey, BR, INPUTS, ADD_TYPES, initialDocs, layout, branchInfo, outline, validate, makeNode, nodeOf, outsOf, uid } from './data.js';
import { createEngine, previewEngine, submit as eSubmit, back as eBack, demoValue, hasValue, fmt, progressOf } from './engine.js';
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
  const [assigns, setAssigns] = useState([]); const [datasets, setDatasets] = useState(DATASETS0); const [adm, setAdm] = useState(null); // adm : 'assign' | 'data' | null
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
  const [activating, setActivating] = useState(false);
  const activate = () => {
    if (!okAll) return;
    const d = wfsRef.current[docId];
    const m = (d.status || '').match(/v(\d+)/);
    const nextV = m ? parseInt(m[1]) + 1 : 1;
    const history = d.history || [];
    setActivating(true); setTimeout(() => setActivating(false), 700);
    commit({ ...wfsRef.current, [docId]: { ...d, status: `Actif · v${nextV}`, history: [...history, { v: nextV - 1 || nextV, status: d.status || 'Brouillon', ts: new Date().toISOString().slice(0,16).replace('T',' ') }] } });
    say(`Flux activé · version ${nextV}`);
  };
  const deactivate = () => {
    const d = wfsRef.current[docId]; const m = (d.status || '').match(/v(\d+)/); const v = m ? parseInt(m[1]) : 1;
    commit({ ...wfsRef.current, [docId]: { ...d, status: `Brouillon · v${v + 1}` } });
    say('Flux repassé en brouillon — continuez à l’éditer.');
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
    c.push({ g: 'Navigation', t: 'Tableau de bord', ic: 'grid', run: () => setView('dashboard') }, { g: 'Navigation', t: 'Nouveau workflow', ic: 'plus', run: () => setNewOpen(true) }, { g: 'Actions', t: 'Lancer le Play', ic: 'play', k: 'P', run: goPlay }, { g: 'Actions', t: 'Revenir à l’édition', ic: 'flow', run: goEdit });
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
    <TopBar {...{ collab, setCollab, people, setPeople, review, setReview, say, newFlow: () => setNewOpen(true), view, setView, mode, goPlay, goEdit, wfs, doc, docId, rootId, openDoc, okAll, checks, undo, redo, hist: hist.current, setPal, theme, setThemeS, density, setDensity, dir, setDir, minimap, setMinimap, bp, drawer, setDrawer, menu, setMenu, setInspTab, setSideTab, struct, activate, deactivate, activating }} />
    {view === 'dashboard' ? <Dashboard wfs={wfs} openDoc={(id) => { setView('studio'); openDoc(id); }} setView={setView} newFlow={() => setNewOpen(true)} openAdmin={setAdm} />
      : view === 'mobile'
      ? <MobileDemo e={eng} api={api} wfs={wfs} width={width} ver={ver} assigns={assigns} datasets={datasets} />
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
    {adm === 'assign' && <AssignModal mains={Object.values(wfs).filter((d) => d.kind === 'main')} close={() => setAdm(null)} onAssign={(a) => { setAssigns((x) => [...x, a]); say(`« ${wfs[a.wf].title} » assigné à ${a.members.length} personne(s)`); }} />}
    {adm === 'data' && <DatasetsModal datasets={datasets} setDatasets={setDatasets} close={() => setAdm(null)} say={say} />}
    {addMenu && <AddMenu m={addMenu} close={() => setAddMenu(null)} pick={(t) => { setAddMenu(null); addOnEdge(addMenu.edgeId, t); }} />}
    {pal && <Palette items={commands()} close={() => setPal(false)} />}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

/* ------------------------------------------------------------------ Top bar */
function TopBar({ collab, setCollab, people, setPeople, review, setReview, say, newFlow, view, setView, mode, goPlay, goEdit, wfs, doc, docId, rootId, openDoc, okAll, checks, undo, redo, hist, setPal, theme, setThemeS, density, setDensity, dir, setDir, minimap, setMinimap, bp, drawer, setDrawer, menu, setMenu, setInspTab, setSideTab, struct, activate, deactivate, activating }) {
  const root = wfs[rootId]; const bad = checks.filter((c) => !c.ok).length;
  const stop = (e) => e.stopPropagation();
  return <header className={`top v-${view}`} onClick={stop}>
    {bp === 's' && view === 'studio' && <button className="ib" onClick={() => setDrawer(drawer === 'left' ? null : 'left')} aria-label="Navigation"><Ic n="menu" s={18} /></button>}
    <div className="logo"><Emblem /><b className="hide-s">Zenko <em>Studio</em></b></div>
    <nav className="views" aria-label="Vue">
      <button className={view === 'dashboard' ? 'on' : ''} onClick={() => setView('dashboard')} title="Tableau de bord"><Ic n="grid" s={15} /><span className="hide-s">Tableau de bord</span></button>
      <button className={view === 'studio' ? 'on' : ''} onClick={() => setView('studio')} title="Studio"><Ic n="flow" s={15} /><span className="hide-s">Studio</span></button>
      <button className={view === 'mobile' ? 'on' : ''} onClick={() => setView('mobile')} title="App mobile"><Ic n="phone" s={15} /><span className="hide-s">App mobile</span></button>
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
    {view === 'dashboard' && <button className="btn pri" onClick={newFlow}><Ic n="plus" s={14} sw={2.4} /><span className="hide-s">Nouveau workflow</span></button>}
    <button className="ib" onClick={() => setThemeS((theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) ? 'light' : 'dark')} aria-label="Basculer clair / sombre" title="Clair / sombre">{theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? <Ic n="sun" s={16} /> : <Ic n="moon" s={16} />}</button>
    <div className="rel"><button className="ib" onClick={(e) => { stop(e); setMenu(menu === 'view' ? null : 'view'); }} aria-label="Affichage" title="Affichage"><Ic n="sliders" s={16} /></button>
      {menu === 'view' && <div className="pop view-pop" onClick={stop}>
        <div className="pg">Thème</div><Seg value={theme} set={setThemeS} opts={[['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']]} />
        <div className="pg">Écran</div><Seg value={density} set={setDensity} opts={[['auto', 'Auto'], ['compact', 'Compact'], ['wide', 'Grand écran']]} />
        <div className="ph">Grand écran : plan et inspecteur plus larges, aperçu mobile live en permanence.</div>
        <div className="pg">Sens du flux</div><Seg value={dir} set={setDir} opts={[['TB', 'Vertical'], ['LR', 'Horizontal']]} />
        <label className="chk"><input type="checkbox" checked={minimap} onChange={(e) => setMinimap(e.target.checked)} />Mini-carte</label>
      </div>}</div>
     {view === 'studio' && mode === 'edit' && <div className="rel">
      {doc.status && doc.status.startsWith('Actif')
        ? <><button className="btn" onClick={deactivate}><Ic n="edit" s={14} />Modifier</button>
           <button className={cls('btn ver-active')} onClick={() => setMenu(menu === 'ver' ? null : 'ver')} title="Historique des versions"><Ic n="restart" s={14} />v{(doc.status.match(/v(\d+)/) || ['','?'])[1]} ✓</button></>
        : <><button className="btn sm" onClick={() => setMenu(menu === 'ver' ? null : 'ver')} title="Historique">{doc.status || 'Brouillon'} <Ic n="down" s={12} /></button>
           <button className={cls('btn pri', !okAll && 'off', activating && 'activated')} disabled={!okAll} onClick={activate} title={okAll ? 'Activer ce flux en production' : 'Corrigez d’abord les points de contrôle'}><Ic n="zap" s={14} />Activer</button></>}
      {menu === 'ver' && <div className="pop ver-pop" onClick={(e) => e.stopPropagation()}>
        <div className="ver-h"><b>Versions</b><span className={cls('chip', doc.status && doc.status.startsWith('Actif') ? 'okc' : '')}>{doc.status || 'Brouillon'}</span></div>
        {!(doc.history || []).length && <p className="hintp">Aucune version activée pour l’instant.</p>}
        {[...(doc.history || [])].reverse().map((h, i) => <div key={i} className="ver-row"><span>v{h.v}</span><em>{h.status}</em><span className="mut">{h.ts}</span></div>)}
        <p className="hintp">Activer crée une version numérotée et la marque comme active. Modifier repasse en brouillon sans perdre l’historique.</p>
      </div>}
    </div>}
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
const ME = 'Cyril R.';
const slug = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const mb = (d) => (/Ko/.test(d.size) ? parseFloat(d.size.replace(',', '.')) / 1024 : parseFloat(d.size.replace(',', '.')));
const Sw = ({ on, set, label }) => <button className={cls('mp-sw', on && 'on')} role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)}><i /></button>;

/** Consultation hors ligne d'un jeu de données importé (recherche plein texte). */
function DatasetView({ ds, back, from }) {
  const [q, setQ] = useState(''); const t = q.trim().toLowerCase();
  const rows = ds.data.filter((r) => !t || r.some((c) => c.toLowerCase().includes(t)));
  return <div className="ph-body mp">
    <button className="pf-back sm" onClick={back}><Ic n="left" s={14} />{from}</button>
    <div className="mp-me"><div><b>{ds.name}</b><small>{ds.rows.toLocaleString('fr-FR')} lignes · {ds.size} · disponible hors ligne</small></div></div>
    <input className="in" placeholder="Rechercher un produit, un EAN…" value={q} onChange={(e) => setQ(e.target.value)} />
    <div className="ds-tbl">{rows.length ? rows.map((r, i) => <div key={i} className="ds-r"><b>{r[0]}</b><span>{r.slice(1).join(' · ')}</span></div>) : <p className="mp-e">Aucun résultat.</p>}</div>
    <p className="mp-e">Aperçu : {ds.data.length} lignes affichées sur {ds.rows.toLocaleString('fr-FR')}.</p></div>;
}

function MobileDemo({ e, api, wfs, width, ver, assigns, datasets }) {
  const [scr, setScr] = useState('inbox'); const [tab, setTab] = useState('tasks'); const [cur, setCur] = useState(null);
  const [st, setSt] = useState({}); const [prog, setProg] = useState({}); // st[id] : 'progress' | 'pending' | 'sending' | 'synced'
  const [off, setOff] = useState(true); const [bg, setBg] = useState(true); const [sending, setSending] = useState(false); const [media, setMedia] = useState([]);
  const [dl, setDl] = useState([]); const [dlp, setDlp] = useState({}); const [flt, setFlt] = useState('all'); const [sheet, setSheet] = useState(null); const [pick, setPick] = useState([]); const [team, setTeam] = useState(null); const [dsId, setDsId] = useState(null);
  const mains = Object.values(wfs).filter((d) => d.kind === 'main');
  const mates = USERS.filter((u) => u.n !== ME);
  const label = (id) => st[id] === 'progress' ? 'progress' : st[id] === 'sending' ? 'sending' : st[id] === 'pending' || st[id] === 'synced' ? 'done' : 'assigned';
  const assignFor = (id) => [...assigns].reverse().find((a) => a.wf === id && a.members.includes(ME));
  const start = (id, names) => { setCur(id); api.restart(id); setTeam(names && names.length ? [ME, ...names] : null); setScr('run'); };
  const done = (info) => {
    if (info && info.paused) { setSt((x) => ({ ...x, [cur]: 'progress' })); setProg((x) => ({ ...x, [cur]: info.p })); }
    else { const t = wfs[cur].title; setSt((x) => ({ ...x, [cur]: 'pending' })); setMedia((m) => [...m, { id: cur + Date.now() + 'a', wf: cur, name: `photo_${slug(t)}_1.jpg`, size: '1,8 Mo', p: 0 }, { id: cur + Date.now() + 'b', wf: cur, name: `photo_${slug(t)}_2.jpg`, size: '2,1 Mo', p: 0 }, { id: cur + Date.now() + 'c', wf: cur, name: 'signature.png', size: '24 Ko', p: 0 }]); }
    setTab('tasks'); setScr('inbox'); setTeam(null);
  };
  const pend = Object.keys(st).filter((k) => st[k] === 'pending');
  const startSend = () => { if (off) return; setSt((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v === 'pending' ? 'sending' : v]))); setSending(true); };
  // synchro en arrière-plan : dès que le réseau est là, l'envoi démarre tout seul
  useEffect(() => { if (bg && !off && !sending && pend.length) { const t = setTimeout(startSend, 900); return () => clearTimeout(t); } }, [bg, off, sending, st]);
  // file d'envoi : un média à la fois, en pause hors ligne
  useEffect(() => { if (!sending || off) return; const t = setInterval(() => setMedia((m) => { const i = m.findIndex((x) => x.p < 100); return i < 0 ? m : m.map((x, k) => (k === i ? { ...x, p: Math.min(100, x.p + 34) } : x)); }), 380); return () => clearInterval(t); }, [sending, off]);
  useEffect(() => {
    if (!sending) return; const ids = Object.keys(st).filter((k) => st[k] === 'sending');
    const fin = ids.filter((k) => media.filter((m) => m.wf === k).every((m) => m.p >= 100));
    if (fin.length) setSt((x) => ({ ...x, ...Object.fromEntries(fin.map((k) => [k, 'synced'])) }));
    if (!ids.length || fin.length === ids.length) setSending(false);
  }, [media, st, sending]);
  const queued = media.filter((m) => m.p < 100);
  const onDev = datasets.filter((d) => d.pushed || dl.includes(d.id)); const avail = datasets.filter((d) => !onDev.includes(d));
  const store = onDev.reduce((a, d) => a + mb(d), 0);
  const startDl = (id) => { if (off || dlp[id] !== undefined) return; setDlp((x) => ({ ...x, [id]: 0 })); };
  useEffect(() => { const ids = Object.keys(dlp); if (off || !ids.length) return; const t = setInterval(() => setDlp((x) => { const n = {}; const fin = []; Object.entries(x).forEach(([k, v]) => { if (v + 25 >= 100) fin.push(k); else n[k] = v + 25; }); if (fin.length) setDl((d) => [...d, ...fin]); return n; }), 320); return () => clearInterval(t); }, [dlp, off]);
  const mq = media.filter((m) => m.p < 100).reduce((a, m) => a + mb(m), 0);
  const saisies = Object.values(st).filter((v) => v !== 'synced').length * 0.12;
  const total = store + mq + saisies;
  const cnt = (k) => mains.filter((d) => label(d.id) === k).length;
  const shown = mains.filter((d) => flt === 'all' || label(d.id) === flt);
  const data = e ? Object.entries(e.data).filter(([k]) => !k.startsWith('__')) : [];
  const ds = datasets.find((d) => d.id === dsId);
  const title = { tasks: 'Mes tâches', sync: 'Synchronisation', data: 'Données hors ligne', profile: 'Profil' }[tab];
  const sub = tab === 'tasks' ? `${ME} · ${mains.length} tâches` : tab === 'sync' ? (off ? 'Hors ligne' : sending ? 'Envoi en cours…' : 'En ligne') : tab === 'data' ? `${onDev.length} jeu${onDev.length > 1 ? 'x' : ''} sur l’appareil · ${store.toFixed(1).replace('.', ',')} Mo` : 'Responsable magasin';
  const STT = { assigned: 'Assigné', progress: 'En cours', done: 'Terminé', sending: 'Synchro…' };
  const threads = e ? e.threads.filter((t) => t.status !== 'parked') : [];
  return <div className="mob">
    <div className="mob-side">
      <h1>App mobile</h1>
      <p>Un opérateur seul sur le terrain, ou une équipe qui se répartit les branches parallèles : chacun passe d’une branche à l’autre sans perdre sa place.</p>
      <ul><li>Mode hors ligne, stockage local, synchro en arrière-plan</li><li>File d’envoi des photos et signatures</li><li>Boucles : un passage par rayon ou par produit</li><li>Catalogues et listes de prix consultables sans réseau</li></ul>
      {scr === 'run' && e && <div className="drawer static"><div className="sh">Progression{team ? ' · session partagée' : ''}</div><div className="dr-b prg">{threads.map((t, i) => { const pc = t.screen && t.screen.complete ? 100 : t.status === 'wait' ? 100 : progressOf(e, t); return <div className="pr-row" key={t.id}><span className="pr-l"><b>{t.letter ? `${t.letter} · ` : ''}{t.label}</b>{team && <em>{team[i % team.length]}</em>}</span><div className="pr-b"><i style={{ width: pc + '%' }} /></div><span className="pr-p">{pc} %</span></div>; })}</div>
        <div className="sh">Données capturées</div><div className="dr-b">{data.length ? data.map(([k, v]) => <div className="kv" key={k}><code>{k}</code><span>{fmt(v)}</span></div>) : <em className="mut">Aucune donnée.</em>}</div></div>}
    </div>
    <div className="mob-stage">
      {scr === 'inbox' || !e
        ? <FitBox w={PW + 20} h={PH + 40}><div className="phone"><div className="ph-notch" />
          <div className="ph-top"><div className="ph-ttl"><b>{title}</b><span>{sub}</span></div><button className={cls('ph-off', !off && 'on')} onClick={() => setOff(!off)} title="Basculer en ligne / hors ligne (démo)">{off ? 'hors ligne' : 'en ligne'}</button></div>
          {tab === 'tasks' && <><div className="ib-flt" role="tablist">{[['all', 'Tous', mains.length], ['assigned', 'Assigné', cnt('assigned')], ['progress', 'En cours', cnt('progress')], ['done', 'Terminé', cnt('done')], ['sending', 'Synchro', cnt('sending')]].map(([k, l, n]) => <button key={k} role="tab" aria-selected={flt === k} className={flt === k ? 'on' : ''} onClick={() => setFlt(k)}>{l}<i>{n}</i></button>)}</div>
            <div className="ph-body inbox">{shown.map((d) => { const f = d.nodes.filter((n) => n.type === 'fork').length; const k = label(d.id); const as = assignFor(d.id); return <div key={d.id} className="ib-wrap"><button className="ib-card" onClick={() => start(d.id)}>
              <div className="ib-h"><b>{d.title}</b><span className={cls('chip', k === 'done' && 'okc', k === 'sending' && 'warnc')}>{k === 'progress' ? `En cours · ${prog[d.id] || 0} %` : k === 'done' ? (st[d.id] === 'synced' ? 'Terminé · synchronisé' : 'Terminé · à envoyer') : STT[k]}</span></div>
              <span className="ib-s">{d.subtitle}</span>
              {k === 'progress' && <div className="pr-b"><i style={{ width: (prog[d.id] || 0) + '%' }} /></div>}
              <div className="ib-m"><span>{d.nodes.filter((n) => n.type === 'step').length} étapes</span>{f ? <span className="par"><Ic n="branch" s={12} />{f} bloc parallèle</span> : null}<span>{d.noun}</span></div></button>
              <div className="ib-foot"><span>{as ? <><b className="new">Nouveau</b> {as.kind === 'group' ? `Groupe ${as.label}` : 'Assigné à vous'}</> : 'Assigné par le responsable'}</span><button className="lnk" onClick={() => { setSheet(d.id); setPick([]); }}><Ic n="users" s={12} />En équipe</button></div></div>; })}
              {!shown.length && <p className="mp-e c">Aucune tâche dans « {STT[flt]} ».</p>}</div></>}
          {tab === 'sync' && <div className="ph-body mp">
            <div className={cls('mp-st', !off && 'ok')}><Ic n={off ? 'restart' : 'check'} s={20} /><div><b>{off ? 'Hors ligne' : sending ? 'Synchronisation…' : 'Connecté'}</b><small>{off ? 'Vos saisies et médias restent sur l’appareil.' : sending ? 'Envoi des données puis des médias.' : 'Tout est à jour.'}</small></div></div>
            <div className="mp-row"><span><b>Synchro en arrière-plan</b><small>Envoie dès que le réseau revient</small></span><Sw on={bg} set={setBg} label="Synchronisation en arrière-plan" /></div>
            <div className="mp-h">Stockage local · {total.toFixed(1).replace('.', ',')} Mo</div>
            <div className="stk"><i style={{ flex: store, background: 'var(--ba)' }} /><i style={{ flex: Math.max(mq, 0.01), background: 'var(--warn)' }} /><i style={{ flex: Math.max(saisies, 0.01), background: 'var(--accent)' }} /></div>
            <div className="stk-l"><span><i style={{ background: 'var(--ba)' }} />Jeux de données {store.toFixed(1).replace('.', ',')} Mo</span><span><i style={{ background: 'var(--warn)' }} />Médias {mq.toFixed(1).replace('.', ',')} Mo</span><span><i style={{ background: 'var(--accent)' }} />Saisies {saisies.toFixed(1).replace('.', ',')} Mo</span></div>
            <div className="mp-h">File d’envoi des médias ({queued.length})</div>
            {media.length ? media.slice(-6).map((m) => <div key={m.id} className="mq"><span className="mq-n"><b>{m.name}</b><small>{m.size} · {m.p >= 100 ? 'Envoyé' : off ? 'En attente du réseau' : sending ? `Envoi ${m.p} %` : 'En file'}</small></span><div className="pr-b"><i style={{ width: m.p + '%', background: m.p >= 100 ? 'var(--ok)' : undefined }} /></div></div>) : <p className="mp-e">Aucun média en attente. Les photos et signatures d’un workflow terminé arrivent ici.</p>}
            <div className="mp-h">Données à envoyer ({pend.length + Object.keys(st).filter((k) => st[k] === 'sending').length})</div>
            {pend.map((k) => <div key={k} className="mp-row"><b>{wfs[k].title}</b><small>{wfs[k].noun} terminée</small></div>)}
            {off && (pend.length > 0 || queued.length > 0) && <p className="mp-hint">Passez en ligne (badge en haut) pour envoyer.</p>}
            <button className="pf-cta" disabled={off || !pend.length || sending} onClick={startSend}>{sending ? 'Envoi…' : 'Synchroniser maintenant'}</button></div>}
          {tab === 'profile' && !ds && <div className="ph-body mp">
            <div className="mp-me"><span className="av" style={{ '--t': 'var(--bb)', width: 52, height: 52 }}>CR</span><div><b>{ME}</b><small>Responsable magasin · Carrefour Wavre</small></div></div>
            <div className="mp-h">Appareil</div>
            <div className="mp-row"><span><b>Mode hors ligne</b><small>{off ? 'Actif' : 'Désactivé'}</small></span><Sw on={off} set={setOff} label="Mode hors ligne" /></div>
            <div className="mp-row"><span><b>Synchro en arrière-plan</b><small>{bg ? 'Activée' : 'Désactivée'}</small></span><Sw on={bg} set={setBg} label="Synchronisation en arrière-plan" /></div>
            <div className="mp-h">Données hors ligne</div>
            <button className="mp-row link" onClick={() => setTab('data')}><span><b>Catalogues et listes de prix</b><small>{onDev.length} sur l’appareil · {store.toFixed(1).replace('.', ',')} Mo</small></span><Ic n="right" s={14} /></button>
            <div className="mp-row"><b>Version de l’app</b><small>Zenko 1.0 (démo)</small></div>
            <button className="pf-back full" onClick={() => setTab('tasks')}>Se déconnecter</button></div>}
          {tab === 'data' && !ds && <div className="ph-body mp">
            <p className="mp-e" style={{ marginTop: 0 }}>Catalogues produits et listes de prix, consultables sans réseau pendant un workflow. Le studio peut aussi les pousser sur l’appareil.</p>
            <div className="mp-h">Sur l’appareil ({onDev.length})</div>
            {onDev.map((d) => <button key={d.id} className="mp-row link" onClick={() => setDsId(d.id)}><span><b>{d.name}</b><small>{d.type} · {d.rows.toLocaleString('fr-FR')} lignes · {d.size} · maj {d.updated}</small></span><Ic n="right" s={14} /></button>)}
            {!onDev.length && <p className="mp-e">Aucun jeu de données sur l’appareil.</p>}
            <div className="mp-h">Disponibles dans l’espace de travail ({avail.length})</div>
            {avail.map((d) => <div key={d.id} className="mq"><span className="mq-n"><b>{d.name}</b><small>{d.rows.toLocaleString('fr-FR')} lignes · {d.size}{dlp[d.id] !== undefined ? ` · Téléchargement ${dlp[d.id]} %` : ''}</small></span>{dlp[d.id] !== undefined ? <div className="pr-b"><i style={{ width: dlp[d.id] + '%' }} /></div> : <button className="btn sm pri" disabled={off} onClick={() => startDl(d.id)}>Télécharger</button>}</div>)}
            {!avail.length && <p className="mp-e">Tout est déjà sur l’appareil.</p>}
            {off && avail.length > 0 && <p className="mp-hint">Passez en ligne (badge en haut) pour télécharger.</p>}</div>}
          {tab === 'data' && ds && <DatasetView ds={ds} from="Données" back={() => setDsId(null)} />}
          <div className="ph-nav">{[['tasks', 'inbox', 'Tâches'], ['data', 'file', 'Données'], ['sync', 'restart', 'Synchro'], ['profile', 'user', 'Profil']].map(([k, ic, l]) => <button key={k} className={cls('ph-nav-btn', tab === k && 'active')} onClick={() => { setTab(k); setDsId(null); }}><Ic n={ic} s={20} /><span>{l}</span>{k === 'sync' && (pend.length > 0 || queued.length > 0) && <span className="ph-sync-dot" />}</button>)}</div>
          {sheet && <div className="pf-sheet" role="dialog" aria-label="Démarrer en équipe"><div className="pf-sheet-in"><b>Démarrer en équipe</b>
            <p>Les branches parallèles de « {wfs[sheet].title} » sont réparties entre vous et vos coéquipiers. Chacun suit sa part, la progression est partagée.</p>
            {mates.map((u) => <label key={u.n} className="mt"><input type="checkbox" checked={pick.includes(u.n)} onChange={(ev) => setPick(ev.target.checked ? [...pick, u.n] : pick.filter((x) => x !== u.n))} /><span><b>{u.n}</b><small>{u.tags.slice(0, 2).join(' · ')}</small></span></label>)}
            <button className="pf-cta" disabled={!pick.length} onClick={() => { const id = sheet; setSheet(null); start(id, pick); }}>{pick.length ? `Démarrer avec ${pick.length} coéquipier${pick.length > 1 ? 's' : ''}` : 'Choisir au moins un coéquipier'}</button>
            <button className="pf-back full" onClick={() => setSheet(null)}>Annuler</button></div></div>}
        </div></FitBox>
        : <PlayStage e={e} api={api} solo onDone={done} team={team} />}
    </div>
  </div>;
}

function parseLine(raw) {
  const s = raw.trim(); const n = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let label = s, options;
  const m = s.match(/^(.*?)\s*:\s*(.+\/.+)$/);
  if (m) { label = m[1]; options = m[2].split('/').map((x) => x.trim()).filter(Boolean); return { type: /plusieurs|multiple/.test(n) ? 'multi' : 'single', label, options }; }
  const t = /signature|signer/.test(n) ? 'signature' : /photo|image/.test(n) ? 'photo' : /scan|code.?barre|qr/.test(n) ? 'code' : /gps|position|localis/.test(n) ? 'geo' : /date/.test(n) ? 'date' : /note|etoile|satisfaction/.test(n) ? 'stars' : /combien|nombre|quantite|releve|compteur|mesure/.test(n) ? 'number' : /niveau|proprete|pourcent/.test(n) ? 'slider' : 'text';
  return { type: t, label };
}

/* ---- Tableau de bord : génération de données d’exemple (déterministe) ---- */
const END0 = new Date(2026, 10, 10); // fin de la période d’exemple : 10 nov. 2026
const rnd = (seed) => { let x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };
const fdate = (d, o) => d.toLocaleDateString('fr-FR', o || { day: 'numeric', month: 'short' });
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const PERIODS = { day: 'Jour', week: 'Semaine', month: 'Mois', year: 'Année', custom: 'Personnalisé' };
/** Série d’exécutions pour un mode et un décalage (0 = période la plus récente). */
function periodData(mode, off) {
  const N = { day: 12, week: 7, month: 30, year: 12, custom: 14 }[mode];
  const span = { day: 1, week: 7, month: 30, year: 365, custom: 14 }[mode];
  const end = addDays(END0, -off * span); const start = mode === 'day' ? end : mode === 'year' ? new Date(end.getFullYear() - 1, end.getMonth() + 1, 1) : addDays(end, -(N - 1));
  const vals = []; const labels = [];
  for (let i = 0; i < N; i++) {
    const d = mode === 'year' ? new Date(start.getFullYear(), start.getMonth() + i, 1) : addDays(start, i);
    const wk = d.getDay() === 0 || d.getDay() === 6;
    let v;
    if (mode === 'custom' && off === 0) v = DAYS[i];
    else if (mode === 'day') v = Math.round(5 + rnd(off * 31 + i) * 10);
    else if (mode === 'year') v = Math.round(330 + rnd(off * 17 + i) * 260);
    else v = Math.round((wk ? 12 : 38) + rnd(off * 53 + i + N) * (wk ? 12 : 26));
    vals.push(v);
    labels.push(mode === 'day' ? `${8 + i} h` : mode === 'year' ? fdate(d, { month: 'short' }) : mode === 'week' ? fdate(d, { weekday: 'short' }) : (i === 0 || d.getDate() === 1) ? fdate(d) : String(d.getDate()));
  }
  const tot = vals.reduce((a, b) => a + b, 0);
  const k = off === 0 && mode === 'custom';
  const sec = k ? 440 : 400 + Math.round(rnd(off + N) * 90);
  return { vals, labels, tot, start, end, N,
    done: k ? 92 : 89 + Math.round(rnd(off * 7 + N) * 6), median: `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, '0')}`,
    dExec: k ? 12 : Math.round(rnd(off * 3 + N) * 24 - 6), dDone: k ? 3 : Math.round(rnd(off * 5 + N) * 6 - 2), dMed: k ? -45 : Math.round(rnd(off * 11 + N) * 90 - 50) };
}
const niceTop = (m) => { const step = m > 200 ? 100 : m > 60 ? 30 : 10; return Math.ceil(m / step) * step; };
const sgn = (n, u) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n) + u;
const EXECS = [['Inventaire magasin', 'Carrefour Wavre', 'Marie D.', 'Terminé', '6 min 12'], ['Visite stock hebdo', 'Carrefour Wavre', 'Paul M.', 'Terminé', '9 min 40'], ['Visite stock hebdo', 'Carrefour Namur', 'Sophie L.', 'En cours', '—'], ['Entrée de stock', 'Entrepôt Liège', 'Cyril R.', 'En attente de sync', '7 min 03'], ['Visite stock hebdo', 'Delhaize Ottignies', 'Marc T.', 'Terminé', '8 min 51'], ['Inventaire magasin', 'Delhaize Namur', 'Cyril R.', 'Terminé', '7 min 02'], ['Entrée de stock', 'Entrepôt Liège', 'Marie D.', 'Terminé', '5 min 44']];

function Dashboard({ wfs, openDoc, setView, newFlow, openAdmin }) {
  const [dtab, setDtab] = React.useState('team');
  const mains = Object.values(wfs).filter((d) => d.kind === 'main');
  const [mode, setMode] = React.useState('custom'); const [off, setOff] = React.useState(0); const [cmp, setCmp] = React.useState('prev');
  const [lv, setLv] = React.useState('exec'); const [wfF, setWfF] = React.useState('all');
  const [f, setF] = React.useState({ wf: '', site: '', op: '', st: '' }); const [exported, setExported] = React.useState(false);
  const P = React.useMemo(() => periodData(mode, off), [mode, off]);
  const max = Math.max(...P.vals); const top = niceTop(max); const W = 640, H = 190, bw = W / P.N; const showVal = P.N <= 14;
  const cmpTxt = cmp === 'prev' ? 'vs période précédente' : 'vs année précédente';
  const shares = [0.577, 0.423 - 0.02, 0.02]; const byWf = mains.map((d, i) => (i < mains.length - 1 ? Math.round(P.tot * (shares[i] || 0)) : 0));
  byWf[mains.length - 1] = P.tot - byWf.slice(0, -1).reduce((a, b) => a + b, 0);
  const rangeTxt = mode === 'day' ? fdate(P.end, { day: 'numeric', month: 'long' }) : `${fdate(P.start)} – ${fdate(P.end)}`;
  const lenTxt = { day: '1 jour', week: '7 jours', month: '30 jours', year: '12 mois', custom: '14 jours' }[mode];
  const opts = (i) => [...new Set(EXECS.map((r) => r[i]))];
  const rows = EXECS.filter((r) => (!f.wf || r[0] === f.wf) && (!f.site || r[1] === f.site) && (!f.op || r[2] === f.op) && (!f.st || r[3] === f.st));
  const exportCsv = () => {
    try { const csv = ['Workflow;Site;Opérateur;Statut;Durée', ...rows.map((r) => r.join(';'))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'executions.csv'; a.click(); } catch (err) { /* aperçu sans téléchargement */ }
    setExported(true); setTimeout(() => setExported(false), 1800);
  };
  const FSel = ({ k, label, i }) => <label className="fld"><span>{label}</span><select className="fsl" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}><option value="">Tous</option>{opts(i).map((x) => <option key={x}>{x}</option>)}</select></label>;
  const wfMatch = (k) => (d) => k === 'all' || (k === 'act' ? d.status.startsWith('Actif') : k === 'draft' ? d.status.startsWith('Brouillon') : validate(wfs, d).some((c) => !c.ok));
  const wfRows = mains.filter(wfMatch(wfF));
  const drafts = mains.filter((d) => d.status.startsWith('Brouillon') && validate(wfs, d).every((c) => c.ok)).length;
  const kpiList = [['Exécutions · ' + lenTxt, P.tot.toLocaleString('fr-FR'), sgn(P.dExec, ' %'), P.dExec >= 0], ['Taux de complétion', P.done + ' %', sgn(P.dDone, ' pts'), P.dDone >= 0], ['Durée médiane', P.median, sgn(P.dMed, ' s'), P.dMed <= 0], ['Gain branches parallèles', '−38 %', 'Plus rapide', true]];

  const teamView = <>
    <section className="card pfilt">
      <div className="pf-c"><span className="pf-l">Afficher par</span><div className="seg big">{Object.entries(PERIODS).map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setOff(0); }}>{mode === k && <i className="rdot" />}{l}</button>)}</div></div>
      <div className="pf-c"><span className="pf-l">{mode === 'custom' ? `Période personnalisée · ${lenTxt}` : `Période · ${lenTxt}`}</span>
        <div className="pf-r"><button className="ib sq" onClick={() => setOff(off + 1)} aria-label="Période précédente"><Ic n="left" s={16} /></button>
          <div className="pf-date"><Ic n="calendar" s={15} />{rangeTxt}{mode !== 'day' && <> · {lenTxt}</>}</div>
          <button className="ib sq" onClick={() => setOff(Math.max(0, off - 1))} disabled={off === 0} aria-label="Période suivante"><Ic n="right" s={16} /></button>
          <button className="btn pill" onClick={() => setOff(0)} disabled={off === 0}>Aujourd’hui</button></div></div>
      <div className="pf-c wide"><span className="pf-l">Comparaison des tendances</span>
        <select className="fsl lg" value={cmp} onChange={(e) => setCmp(e.target.value)}><option value="prev">Période précédente</option><option value="year">Année précédente</option><option value="none">Aucune comparaison</option></select></div>
    </section>
    <div className="kpis">{kpiList.map(([l, v, d, good]) => <div className="kpi" key={l}><span className="kl"><i className="kok"><Ic n="check" s={9} sw={3} /></i>{l}</span><b>{v}</b>
      {cmp === 'none' ? <em className="kd mut">&nbsp;</em> : <em className="kd"><strong className={good ? 'up' : 'dn'}>{d}</strong> {l === 'Gain branches parallèles' ? 'vs séquence' : cmpTxt}</em>}</div>)}</div>
    <div className="dgrid">
      <section className="card c-chart"><div className="card-h"><h2>Exécutions par jour</h2><b className="tot">{P.tot.toLocaleString('fr-FR')} exécutions</b></div>
        <p className="sub">{mode === 'day' ? 'Activité de l’équipe heure par heure.' : mode === 'year' ? 'Activité de l’équipe sur les 12 derniers mois.' : `Activité de l’équipe sur les ${lenTxt.replace(' jours', '')} derniers jours.`}</p>
        <svg viewBox={`0 0 ${W + 40} ${H + 34}`} role="img" aria-label="Exécutions sur la période">
          <defs><linearGradient id="barG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0.92 }} /><stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0.38 }} /></linearGradient>
            <linearGradient id="barH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 1 }} /><stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0.6 }} /></linearGradient></defs>
          {[0, 0.5, 1].map((t) => <g key={t}><line x1="36" x2={W + 36} y1={H - t * (H - 24)} y2={H - t * (H - 24)} className="gl" /><text x="28" y={H - t * (H - 24) + 4} className="gt" textAnchor="end">{Math.round(top * t)}</text></g>)}
          {P.vals.map((v, i) => { const h = (v / top) * (H - 24); const hi = v === max; return <g key={`${mode}-${off}-${i}`}><rect style={{ '--i': i }} x={36 + i * bw + bw * 0.14} y={H - h} width={bw * 0.72} height={h} rx="3" className={hi ? 'bar hi' : 'bar'} />
            {(showVal || hi) && <text x={36 + i * bw + bw / 2} y={H - h - 6} className={hi ? 'gt hi' : 'gt'} textAnchor="middle">{v}</text>}
            {(P.N <= 14 || i % 3 === 0) && <text x={36 + i * bw + bw / 2} y={H + 20} className="gt" textAnchor="middle">{P.labels[i]}</text>}</g>; })}
        </svg><p className="cap">{mode === 'year' ? 'Saisonnalité : pic en fin d’année.' : (mode === 'day' ? 'Pic en milieu de matinée.' : 'Les week-ends sont creux.')}</p></section>
      <section className="card"><h2>Par workflow</h2><p className="sub">Volume d’exécutions sur la période</p>
        {mains.map((d, i) => <div className="hbar" key={d.id}><span>{d.title}</span><b>{byWf[i].toLocaleString('fr-FR')}</b><div><i style={{ width: Math.max(0, (byWf[i] / Math.max(...byWf)) * 100) + '%' }} /></div></div>)}
        <h3 className="sp-t">Statuts des exécutions</h3>
        <div className="stk"><i style={{ flex: 92, background: 'var(--ok)' }} /><i style={{ flex: 5, background: 'var(--warn)' }} /><i style={{ flex: 3, background: 'var(--err)' }} /></div>
        <div className="stk-l"><span><i style={{ background: 'var(--ok)' }} />Terminé 92 %</span><span><i style={{ background: 'var(--warn)' }} />En cours 5 %</span><span><i style={{ background: 'var(--err)' }} />Abandonné 3 %</span></div></section>
      <section className="card c-wide"><div className="card-h"><h2>{lv === 'exec' ? 'Dernières exécutions' : 'Workflows'}</h2>
        <div className="seg sm lvseg" role="tablist" aria-label="Type de vue"><button role="tab" aria-selected={lv === 'exec'} className={lv === 'exec' ? 'on' : ''} onClick={() => setLv('exec')}>Exécutions</button><button role="tab" aria-selected={lv === 'wf'} className={lv === 'wf' ? 'on' : ''} onClick={() => setLv('wf')}>Workflows</button></div></div>
      {lv === 'wf' ? <>
        <p className="sub">État de publication · {wfRows.length} workflow{wfRows.length > 1 ? 's' : ''} sur {mains.length}</p>
        <div className="wfchips" role="group" aria-label="Filtrer par état">{[['all', 'Tous'], ['act', 'Activé'], ['draft', 'Brouillon'], ['bad', 'À corriger']].map(([k, l]) => <button key={k} className={wfF === k ? 'on' : ''} onClick={() => setWfF(k)}>{l}<i>{k === 'all' ? mains.length : mains.filter(wfMatch(k)).length}</i></button>)}</div>
        <div className="tbl"><table><thead><tr><th>Workflow</th><th>État</th><th>Version</th><th>Contrôles</th><th className="num">Exécutions</th></tr></thead><tbody>
          {wfRows.map((d) => { const act = d.status.startsWith('Actif'); const bad = validate(wfs, d).filter((c) => !c.ok); return <tr key={d.id} className="tr-link" onClick={() => { setView('studio'); openDoc(d.id); }}>
            <td>{d.title}</td><td><span className={'chip st ' + (act ? 'actc' : '')}><i />{act ? 'Activé' : 'Brouillon'}</span></td><td>{(d.status.match(/v\d+/) || ['—'])[0]}</td>
            <td><span className={bad.length ? 'badt' : 'okt'}>{bad.length ? `⚠ ${bad.length} à corriger` : '✓ Valide'}</span></td><td className="num">{act ? byWf[mains.indexOf(d)].toLocaleString('fr-FR') : '—'}</td></tr>; })}
          {!wfRows.length && <tr><td colSpan={5} className="empty-row">Aucun workflow pour ce filtre.</td></tr>}
        </tbody></table></div>
        <div className="tfoot"><span>{wfRows.length} workflows affichés</span><span>Les brouillons n’ont pas d’exécution</span></div>
      </> : <>
      <p className="sub">Tous les collaborateurs · {rows.length} exécution{rows.length > 1 ? 's' : ''} sur {EXECS.length}</p>
        <div className="fgrid"><FSel k="wf" label="Workflow" i={0} /><FSel k="site" label="Site" i={1} /><FSel k="op" label="Opérateur" i={2} /><FSel k="st" label="Exécution" i={3} /></div>
        <div className="tbl"><table><thead><tr><th>Workflow</th><th>Site</th><th>Opérateur</th><th>Exécution</th><th className="num">Durée</th></tr></thead><tbody>
          {rows.map((r, i) => <tr key={i} className="tr-link" onClick={() => { setView('studio'); openDoc(mains.find((d) => d.title === r[0])?.id || mains[0]?.id); }}>
            <td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td><span className={'chip st ' + (r[3] === 'Terminé' ? 'okc' : r[3] === 'En cours' ? '' : 'warnc')}><i />{r[3]}</span></td><td className="num">{r[4]}</td></tr>)}
          {!rows.length && <tr><td colSpan={5} className="empty-row">Aucune exécution pour ces filtres.</td></tr>}
        </tbody></table></div>
        <div className="tfoot"><span>{rows.length} exécutions affichées</span><span>— Exécution en cours</span></div></>}</section>
      <section className="card c-watch"><h2>Workflows à surveiller</h2><p className="sub">{mains.length} workflows · {drafts} brouillon{drafts > 1 ? 's' : ''} prêt{drafts > 1 ? 's' : ''} à activer</p>
        {mains.map((d) => { const bad = validate(wfs, d).filter((c) => !c.ok); const act = d.status.startsWith('Actif'); return <button key={d.id} className="watch" onClick={() => { setView('studio'); openDoc(d.id); }}>
          <span className={'wi ' + (act ? 'ok' : 'warn')}><Ic n={act ? 'check' : 'alert'} s={act ? 14 : 20} sw={act ? 3 : 2} /></span>
          <span className="wt"><b>{d.title}</b><em>{d.status}</em><small className={bad.length ? 'bad' : act ? 'ok' : 'warn'}>{bad.length ? bad[0].label : act ? 'Activé · en production' : 'Prêt à activer'}</small></span><Ic n="right" s={16} /></button>; })}
        <button className="btn pri block lg" onClick={newFlow}>Créer un workflow</button><p className="sub foot">Les brouillons ne génèrent pas d’exécution.</p></section>
    </div>
    <footer className="dfoot"><span>Périmètre : équipe · Tous les sites · Du {fdate(P.start, { day: 'numeric', month: 'long' })} au {fdate(P.end, { day: 'numeric', month: 'long' })}</span><span>Durées exprimées en minutes et secondes</span></footer>
  </>;

  const myView = <div className="dgrid">
    <section className="card c-wide"><div className="card-h"><h2>Mes tâches assignées</h2><span className="chip">Cyril R.</span></div>
      <div className="fcards sm mt">
        {mains.map((d) => { const v = validate(wfs, d).every((c) => c.ok); const f = d.nodes.filter((n) => n.type === 'fork').length; return <button key={d.id} className="fcard" onClick={() => { setView('studio'); openDoc(d.id); }}>
          <div className="fc-h"><b>{d.title}</b><span className={'chip ' + (d.status.startsWith('Actif') ? 'okc' : '')}>{d.status}</span></div>
          <em>{d.subtitle}</em>
          <div className="fc-m"><span>{d.nodes.filter((n) => n.type === 'step').length} étapes</span>{f ? <span className="par"><Ic n="branch" s={12} />{f} parallèle</span> : null}<span>{d.noun}</span></div>
          <div className="fc-f"><span className={v ? 'okt' : 'badt'}>{v ? '✓ Valide' : '⚠ À corriger'}</span><span className="lnk2">Ouvrir dans le studio →</span></div></button>; })}
        <button className="fcard new" onClick={newFlow}><span><Ic n="plus" s={22} /></span><b>Nouveau workflow</b><em>Partir de zéro, d’un modèle ou d’une liste d’étapes</em></button>
      </div></section>
    <section className="card"><h2>Mes KPIs</h2>
      {[['Exécutions (moi)', '28', '+4 cette semaine'], ['Taux de complétion', '96 %', '+4 pts vs équipe'], ['Durée médiane', '6 min 44', '−36 s']].map(([l, v, d]) => <div className="kpi sm" key={l}><span>{l}</span><b>{v}</b><em>{d}</em></div>)}
    </section>
  </div>;

  return <div className="page dash">
    <header className="pg-h">
      <div><h1>Tableau de bord</h1><p>Exécutions terrain et workflows. <span className="chip">Données d'exemple</span></p></div>
      <div className="pg-r"><div className="seg"><button className={dtab === 'team' ? 'on' : ''} onClick={() => setDtab('team')}><Ic n="users" s={14} />Équipe</button><button className={dtab === 'my' ? 'on' : ''} onClick={() => setDtab('my')}><Ic n="user" s={14} />Mes workflows</button></div>
        {dtab === 'team' && <div className="pg-b"><button className="btn pill" onClick={() => openAdmin('data')}><Ic n="file" s={14} />Jeux de données</button><button className="btn pill" onClick={() => openAdmin('assign')}><Ic n="users" s={14} />Assigner</button><button className="btn pill" onClick={exportCsv}>{exported ? 'Exporté ✓' : 'Exporter'}</button></div>}</div>
    </header>
    {dtab === 'team' ? teamView : myView}
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
      <div className="row"><Fld l="Nom du workflow"><input id="nf-title" autoFocus className="in" placeholder="Ex. Visite rayon frais" value={title} onChange={(e) => setTitle(e.target.value)} /></Fld>
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
