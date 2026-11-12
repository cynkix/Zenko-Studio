import { BR, uid, nextId, nodeOf, startOf } from './data.js';

const clone = (s) => s.map((f) => ({ ...f, loop: f.loop ? { ...f.loop } : undefined }));
const top = (t) => t.stack[t.stack.length - 1];
const arr = (v) => (Array.isArray(v) ? v : []);

function log(e, text, kind = 'info') { e.trace.push({ id: e.trace.length, text, kind }); }

function mkThread(e, label, idx, parent, stack) {
  const br = idx == null ? null : BR[idx % 3];
  return { id: uid('t'), label, color: br ? br.color : 'var(--accent)', letter: br ? br.letter : '', parent, stack, status: 'run', screen: null, hist: [], waitJoin: null };
}

export function createEngine(wfs, rootId) {
  const e = { wfs, rootId, data: {}, threads: [], trace: [], visited: new Set(), done: false };
  const root = wfs[rootId];
  e.threads.push(mkThread(e, 'Parcours', null, null, [{ docId: rootId, nodeId: startOf(root).id }]));
  log(e, `Démarrage de « ${root.title} »`);
  settle(e);
  return e;
}

/* preview: start a lone thread directly on a given step (sub-routines get a sample item) */
export function previewEngine(wfs, docId, nodeId, rootId) {
  const e = { wfs, rootId, data: {}, threads: [], trace: [], visited: new Set(), done: false, preview: nodeId };
  const d = wfs[docId]; const fr = { docId, nodeId };
  if (d.kind === 'sub') {
    let item = 'Exemple';
    Object.values(wfs).forEach((w) => w.nodes.forEach((n) => {
      if (n.type === 'loop' && n.data.run === docId) {
        const src = w.nodes.find((x) => x.data && x.data.key === n.data.from);
        if (src && src.data.options && src.data.options[0]) item = src.data.options[0];
      }
    }));
    fr.loop = { items: [item], idx: 0, elt: d.param, node: null, collect: null };
  }
  e.threads.push(mkThread(e, 'Aperçu', null, null, [fr]));
  settle(e);
  return e;
}

function viewOf(e, t, n) {
  const f = top(t);
  const item = f.loop ? f.loop.items[f.loop.idx] : null;
  const key = n.data.key ? (item != null ? `${item}:${n.data.key}` : n.data.key) : n.id;
  if (n.data.def !== undefined && e.data[key] === undefined) e.data[key] = n.data.def;
  return { node: n, key, item, param: f.loop ? f.loop.elt : null, loopIdx: f.loop ? f.loop.idx + 1 : null, loopTotal: f.loop ? f.loop.items.length : null, docId: f.docId };
}

function step(e, t) {
  for (let g = 0; g < 400; g++) {
    const f = top(t); const d = e.wfs[f.docId]; const n = d && nodeOf(d, f.nodeId);
    if (!n) { t.status = 'done'; return; }
    if (f.docId === e.rootId && n.type !== 'step') e.visited.add(n.id);
    if (n.type === 'start') { f.nodeId = nextId(d, n.id); continue; }
    if (n.type === 'step') { t.screen = viewOf(e, t, n); return; }
    if (n.type === 'end') {
      if (f.loop) {
        const item = f.loop.items[f.loop.idx];
        log(e, `${t.label} · ${f.loop.elt} « ${item} » terminé`, 'ok');
        if (f.loop.idx < f.loop.items.length - 1) { f.loop.idx++; f.nodeId = startOf(d).id; continue; }
        t.stack.pop(); const p = top(t); p.nodeId = nextId(e.wfs[p.docId], p.nodeId); if (p.docId === e.rootId) e.visited.add(f.loop.node); continue;
      }
      t.status = 'done'; t.screen = { complete: true };
      if (!t.parent) { e.done = true; log(e, 'Parcours terminé', 'ok'); }
      return;
    }
    if (n.type === 'loop') {
      const items = arr(e.data[n.data.from]);
      if (!items.length) { f.nodeId = nextId(d, n.id); continue; }
      t.stack.push({ docId: n.data.run, nodeId: startOf(e.wfs[n.data.run]).id, loop: { items, idx: 0, elt: n.data.elt, node: n.id, collect: n.data.collect } });
      log(e, `${t.label} · boucle sur ${items.length} ${n.data.elt}(s) → ${n.data.run}`);
      continue;
    }
    if (n.type === 'fork') {
      n.data.branches.forEach((b, i) => {
        const edge = d.edges.find((x) => x.source === n.id && x.sourceHandle === b.id); if (!edge) return;
        const st = clone(t.stack); st[st.length - 1].nodeId = edge.target;
        const kid = mkThread(e, t.letter ? `${t.label} › ${b.label}` : b.label, i, t.id, st); kid.letter = (t.letter || '') + BR[i % 3].letter; kid.forkId = n.id; e.threads.push(kid);
      });
      t.status = 'parked'; t.screen = null;
      log(e, `Départ en parallèle : ${n.data.branches.map((b) => b.label).join(' + ')}`, 'fork');
      return;
    }
    if (n.type === 'join') { t.status = 'wait'; t.waitJoin = n.id; t.screen = null; log(e, `Branche « ${t.label} » prête, en attente`, 'wait'); return; }
  }
}

export function settle(e) {
  for (let guard = 0, changed = true; changed && guard < 500; guard++) {
    changed = false;
    for (const t of [...e.threads]) if (t.status === 'run' && !t.screen) { step(e, t); changed = true; }
    for (const p of e.threads.filter((x) => x.status === 'parked')) {
      const kids = e.threads.filter((k) => k.parent === p.id);
      if (kids.length && kids.every((k) => k.status === 'wait')) {
        const d = e.wfs[top(p).docId]; const jid = kids[0].waitJoin;
        top(p).nodeId = nextId(d, jid); e.visited.add(jid);
        e.threads = e.threads.filter((k) => k.parent !== p.id);
        p.status = 'run'; log(e, 'Branches synchronisées, le parcours reprend', 'ok'); changed = true;
      }
    }
  }
}

export function submit(e, t) {
  if (!t.screen || t.screen.complete) return;
  const f = top(t); const d = e.wfs[f.docId]; const n = nodeOf(d, f.nodeId);
  t.hist.push(clone(t.stack));
  if (f.docId === e.rootId) e.visited.add(n.id);
  const v = e.data[t.screen.key];
  if (n.data.kind === 'input' && v !== undefined && v !== '') log(e, `${t.label} · ${n.data.key} = ${fmt(v)}`);
  t.screen = null; f.nodeId = nextId(d, n.id);
  settle(e);
}

export function back(e, t) {
  if (!t.hist.length) return;
  t.stack = t.hist.pop(); t.screen = null; t.status = 'run'; t.waitJoin = null; e.done = false;
  settle(e);
}

export const fmt = (v) => (Array.isArray(v) ? v.join(', ') : v === true ? '✓' : String(v));
export const hasValue = (v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== '');

export function interp(e, t, view, text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{(\w+)\}/g, (_, k) => {
    if (view && view.param === k) return view.item;
    let v = view && view.item != null ? e.data[`${view.item}:${k}`] : undefined;
    if (v == null) v = e.data[k];
    return v == null ? '…' : fmt(v);
  });
}

export function demoValue(e, view) {
  const n = view.node.data; const o = n.options || [];
  switch (n.input) {
    case 'date': return '2026-11-10';
    case 'collect': return n.key === 'RAYONS' ? ['Boissons', 'Épicerie'] : n.key === 'PRODUITS' ? ['Coca-Cola 1,5 L', 'Evian 50 cl'] : o.slice(0, 2);
    case 'single': return o[0];
    case 'multi': return o.length ? [o[0]] : [];
    case 'slider': return n.def ?? 70;
    case 'number': return (n.def ?? 3) + 2;
    case 'stars': return 4;
    case 'photo': return true;
    case 'code': return '5449000000996';
    case 'geo': return '50.7169° N, 4.6089° E · ±8 m';
    case 'signature': return true;
    case 'text': return 'RAS';
    default: return undefined;
  }
}

/* rough "steps left" for a progress bar */
export function progressOf(e, t) {
  const done = t.hist.length;
  const count = (d, from, stopAt) => {
    let c = 0; const seen = new Set(); const q = from ? [from] : [];
    while (q.length) {
      const id = q.shift(); if (seen.has(id) || id === stopAt) continue; seen.add(id);
      const n = nodeOf(d, id); if (!n) continue;
      if (n.type === 'step') c++;
      if (n.type === 'loop') { const sub = e.wfs[n.data.run]; const items = arr(e.data[n.data.from]).length || 2; c += items * (sub ? sub.nodes.filter((x) => x.type === 'step').length : 0); }
      d.edges.filter((x) => x.source === id).forEach((x) => q.push(x.target));
    }
    return c;
  };
  let left = 0;
  t.stack.forEach((f, i) => {
    const d = e.wfs[f.docId];
    if (f.loop) { left += count(d, f.nodeId); left += (f.loop.items.length - f.loop.idx - 1) * d.nodes.filter((x) => x.type === 'step').length; }
    else left += count(d, i === t.stack.length - 1 ? f.nodeId : nextId(d, f.nodeId));
  });
  return Math.max(4, Math.min(98, Math.round((done / Math.max(1, done + left)) * 100)));
}
