/**
 * ops.js — Opérations d'édition sur un document (toutes pures : reçoivent un doc, retournent un doc ou null).
 * Null signifie que l'opération est interdite (ex. suppression de début/fin, nesting > 2 niveaux).
 *
 * @module ops
 */
import { uid, nodeOf, outsOf, insOf, branchInfo, edgeDepth, layout, makeKey } from './data.js';

export const relay = (d, dir) => ({ ...d, nodes: layout(d.nodes, d.edges, dir) });

/**
 * Insère un nœud sur un lien existant.
 * @param {Object} d      - Document courant.
 * @param {string} edgeId - Id du lien sur lequel insérer.
 * @param {Object} node   - Nœud à insérer.
 * @returns {Object|null} Nouveau document, ou null si impossible.
 */
export function insertOnEdge(d, edgeId, node) {
  const i = d.edges.findIndex((x) => x.id === edgeId); if (i < 0) return null;
  const e = d.edges[i];
  const a = { id: uid('e'), source: e.source, target: node.id, ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}) };
  const b = { id: uid('e'), source: node.id, target: e.target };
  const edges = [...d.edges]; edges.splice(i, 1, a, b);
  const si = d.nodes.findIndex((n) => n.id === e.source); const nodes = [...d.nodes]; nodes.splice(si + 1, 0, node);
  return { ...d, nodes, edges };
}

/**
 * Insère un bloc parallèle (fork + join + 2 branches vides) sur un lien.
 * Limité à 2 niveaux d'imbrication.
 * @param {Object} d      - Document courant.
 * @param {string} edgeId - Id du lien cible.
 * @returns {Object|null} Nouveau document, ou null si déjà 2 niveaux.
 */
export function insertFork(d, edgeId) {
  const i = d.edges.findIndex((x) => x.id === edgeId); if (i < 0) return null;
  const e = d.edges[i]; const info = branchInfo(d);
  if (edgeDepth(d, e, info) >= 2) return null;
  const F = uid('f'), J = uid('j'), A = uid('n'), B = uid('n');
  const mk = (id, label) => ({ id, type: 'step', position: { x: 0, y: 0 }, data: { kind: 'info', label, body: '' } });
  const nodes = [...d.nodes];
  const si = nodes.findIndex((n) => n.id === e.source);
  nodes.splice(si + 1, 0, { id: F, type: 'fork', position: { x: 0, y: 0 }, data: { branches: [{ id: 'bA', label: 'Branche A' }, { id: 'bB', label: 'Branche B' }] } }, mk(A, 'Étape de la branche A'), mk(B, 'Étape de la branche B'), { id: J, type: 'join', position: { x: 0, y: 0 }, data: { forkId: F, mode: 'all' } });
  const edges = [...d.edges];
  edges.splice(i, 1,
    { id: uid('e'), source: e.source, target: F, ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}) },
    { id: uid('e'), source: F, target: A, sourceHandle: 'bA' }, { id: uid('e'), source: A, target: J },
    { id: uid('e'), source: F, target: B, sourceHandle: 'bB' }, { id: uid('e'), source: B, target: J },
    { id: uid('e'), source: J, target: e.target });
  return { d: { ...d, nodes, edges }, focus: A };
}

/**
 * Supprime un nœud et recâble les liens.
 * Refuse start, end et les fork/join (suppression du bloc complet non implémentée).
 * @param {Object} d  - Document courant.
 * @param {string} id - Id du nœud à supprimer.
 * @returns {Object|null} Nouveau document, ou null si refusé.
 */
export function deleteNode(d, id) {
  const n = nodeOf(d, id); if (!n || n.type === 'start' || n.type === 'end') return null;
  const info = branchInfo(d); let remove = new Set([id]); let ins, out;
  if (n.type === 'fork' || n.type === 'join') {
    const fid = n.type === 'fork' ? n.id : n.data.forkId; const entry = info.forks.find((f) => f.fork.id === fid);
    remove = new Set([fid]); if (entry.join) remove.add(entry.join.id); entry.branches.forEach((b) => b.ids.forEach((x) => remove.add(x)));
    ins = insOf(d, fid); out = entry.join ? outsOf(d, entry.join.id)[0] : null;
  } else { ins = insOf(d, id); const o = outsOf(d, id); out = o.length === 1 ? o[0] : null; }
  const keep = d.edges.filter((e) => !remove.has(e.source) && !remove.has(e.target));
  const add = out ? ins.filter((e) => !remove.has(e.source)).map((e) => ({ id: uid('e'), source: e.source, target: out.target, ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}) })) : [];
  return { ...d, nodes: d.nodes.filter((x) => !remove.has(x.id)), edges: [...keep, ...add] };
}

export function duplicateNode(d, id) {
  const n = nodeOf(d, id); if (!n || !['step', 'loop'].includes(n.type)) return null;
  const o = outsOf(d, id)[0]; if (!o) return null;
  const copy = { ...n, id: uid('n'), data: { ...n.data, label: n.data.label ? n.data.label + ' (copie)' : n.data.label } };
  if (n.data.key) copy.data.key = makeKey(n.data.key, d);
  const r = insertOnEdge(d, o.id, copy); return r && { d: r, focus: copy.id };
}

export function addBranch(d, forkId) {
  const f = nodeOf(d, forkId); if (!f || f.data.branches.length >= 3) return null;
  const join = d.nodes.find((n) => n.type === 'join' && n.data.forkId === forkId);
  const bid = 'b' + uid('').slice(1, 5); const nid = uid('n');
  const label = 'Branche ' + 'ABC'[f.data.branches.length];
  const nodes = d.nodes.map((n) => (n.id === forkId ? { ...n, data: { ...n.data, branches: [...n.data.branches, { id: bid, label }] } } : n));
  nodes.push({ id: nid, type: 'step', position: { x: 0, y: 0 }, data: { kind: 'info', label: 'Étape de la ' + label.toLowerCase(), body: '' } });
  return { d: { ...d, nodes, edges: [...d.edges, { id: uid('e'), source: forkId, target: nid, sourceHandle: bid }, { id: uid('e'), source: nid, target: join.id }] }, focus: nid };
}

export function removeBranch(d, forkId, branchId) {
  const f = nodeOf(d, forkId); if (!f || f.data.branches.length <= 2) return null;
  const entry = branchInfo(d).forks.find((x) => x.fork.id === forkId); const b = entry.branches.find((x) => x.id === branchId);
  const rm = new Set(b.ids);
  return { ...d,
    nodes: d.nodes.filter((n) => !rm.has(n.id)).map((n) => (n.id === forkId ? { ...n, data: { ...n.data, branches: n.data.branches.filter((x) => x.id !== branchId) } } : n)),
    edges: d.edges.filter((e) => !rm.has(e.source) && !rm.has(e.target) && !(e.source === forkId && e.sourceHandle === branchId)) };
}

/* first / last edge of a branch (same edge when the branch is empty) */
export function branchEdges(d, forkId, b) {
  const first = d.edges.find((e) => e.source === forkId && e.sourceHandle === b.id);
  const join = d.nodes.find((n) => n.type === 'join' && n.data.forkId === forkId);
  const last = d.edges.find((e) => e.target === join.id && (b.ids.includes(e.source) || (e.source === forkId && e.sourceHandle === b.id)));
  return { first, last };
}
