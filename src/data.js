/**
 * data.js — Modèle de données, mise en page et helpers de graph.
 *
 * Structure d'un document (workflow ou sous-routine) :
 *   { id, kind ('main'|'sub'), title, noun, status, subtitle?,
 *     nodes: Node[], edges: Edge[] }
 *
 * Types de nœuds : start | end | step | loop | fork | join
 *   - step  : écran de saisie ou d'information (data.kind = 'input'|'info'|'summary')
 *   - loop  : boucle sur une liste, appelle une sous-routine par élément
 *   - fork  : nœud de divergence — crée N branches parallèles
 *   - join  : nœud de convergence — attend la fin de toutes les branches du fork associé
 *
 * @module data
 */
import dagre from 'dagre';

export const uid = (p = 'n') => p + Math.random().toString(36).slice(2, 8);
export const BR = [
  { color: 'var(--ba)', soft: 'var(--ba-soft)', on: 'var(--ba-on)', letter: 'A', mk: 'arr-a' },
  { color: 'var(--bb)', soft: 'var(--bb-soft)', on: 'var(--bb-on)', letter: 'B', mk: 'arr-b' },
  { color: 'var(--bc)', soft: 'var(--bc-soft)', on: 'var(--bc-on)', letter: 'C', mk: 'arr-c' },
];

export const INPUTS = {
  text: { label: 'Texte libre', ic: 'text' },
  number: { label: 'Nombre', ic: 'hash' },
  date: { label: 'Date', ic: 'calendar' },
  single: { label: 'Choix unique', ic: 'radio' },
  multi: { label: 'Choix multiple', ic: 'list' },
  collect: { label: 'Liste dynamique', ic: 'listplus' },
  slider: { label: 'Curseur', ic: 'sliders' },
  stars: { label: 'Étoiles', ic: 'star' },
  photo: { label: 'Photo', ic: 'camera' },
  code: { label: 'Code-barres / QR', ic: 'scan' },
  geo: { label: 'Position GPS', ic: 'pin' },
  signature: { label: 'Signature', ic: 'pen' },
};

export const SIZE = { start: [140, 40], end: [140, 40], step: [260, 66], loop: [260, 96], fork: [260, 64], join: [260, 50] };

export function layout(nodes, edges, dir = 'TB') {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: dir, nodesep: dir === 'TB' ? 56 : 30, ranksep: dir === 'TB' ? 54 : 80, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => { const [w, h] = SIZE[n.type]; g.setNode(n.id, { width: w, height: h }); });
  edges.forEach((e) => g.setEdge(e.source, e.target, {}, e.id));
  dagre.layout(g);
  return nodes.map((n) => { const p = g.node(n.id); const [w, h] = SIZE[n.type]; return { ...n, position: { x: Math.round(p.x - w / 2), y: Math.round(p.y - h / 2) } }; });
}

const E = (s, t, h) => ({ id: `e_${s}_${t}${h ? '_' + h : ''}`, source: s, target: t, ...(h ? { sourceHandle: h } : {}) });
const N = (id, type, data) => ({ id, type, position: { x: 0, y: 0 }, data });
const stp = (id, kind, data) => N(id, 'step', { kind, ...data });
const inp = (id, input, label, key, extra = {}) => N(id, 'step', { kind: 'input', input, label, key, ...extra });

function doc(o) { return { ...o, nodes: layout(o.nodes, o.edges, 'TB') }; }

export function initialDocs() {
  const inventory = doc({
    id: 'inventory', kind: 'main', title: 'Inventaire magasin', noun: 'Inventaire', status: 'Brouillon · v3', subtitle: 'Carrefour Wavre · rayons et réserve',
    nodes: [
      N('start', 'start', {}),
      stp('intro', 'info', { label: 'Inventaire magasin', body: 'Carrefour Wavre. Rayon par rayon, puis la réserve (chambre froide et quai en parallèle), puis signature du responsable.' }),
      inp('date', 'date', 'Date de l’inventaire', 'DATE_INVENTAIRE', { required: true, def: '2026-11-12' }),
      inp('rooms', 'collect', 'Quels rayons inventorier ?', 'RAYONS', { required: true, allowOther: true, options: ['Boissons', 'Épicerie', 'Frais', 'Surgelés', 'Hygiène'], help: 'Choisissez dans la liste ou ajoutez un rayon.' }),
      N('fork', 'fork', { branches: [{ id: 'bA', label: 'Rayons' }, { id: 'bB', label: 'Réserve' }] }),
      N('loop', 'loop', { elt: 'rayon', from: 'RAYONS', collect: 'RAYONS_INVENTORIES', run: 'inspect_aisle' }),
      N('fork2', 'fork', { branches: [{ id: 'bA', label: 'Chambre froide' }, { id: 'bB', label: 'Quai' }] }),
      inp('m1', 'number', 'Température de la chambre froide', 'TEMP_CHAMBRE_FROIDE', { required: true, unit: '°C', def: 3 }),
      inp('m1p', 'photo', 'Photo de la chambre froide', 'PHOTO_CHAMBRE_FROIDE'),
      inp('m2', 'number', 'Palettes en attente au quai', 'PALETTES_QUAI', { unit: 'palettes', def: 6 }),
      inp('m2p', 'photo', 'Photo du quai', 'PHOTO_QUAI'),
      N('join2', 'join', { forkId: 'fork2', mode: 'all' }),
      N('join', 'join', { forkId: 'fork', mode: 'all' }),
      stp('review', 'summary', { label: 'Relecture avant signature', from: 'RAYONS', fields: [{ label: 'État', key: 'ETAT' }, { label: 'Écarts', key: 'REMARQUES' }, { label: 'Remplissage', key: 'REMPLISSAGE' }] }),
      inp('sign', 'signature', 'Signature du responsable magasin', 'SIGNATURE_RESPONSABLE', { required: true, help: 'En signant, le responsable confirme l’inventaire.' }),
      N('end', 'end', {}),
    ],
    edges: [E('start', 'intro'), E('intro', 'date'), E('date', 'rooms'), E('rooms', 'fork'),
      E('fork', 'loop', 'bA'), E('loop', 'join'),
      E('fork', 'fork2', 'bB'), E('fork2', 'm1', 'bA'), E('m1', 'm1p'), E('m1p', 'join2'), E('fork2', 'm2', 'bB'), E('m2', 'm2p'), E('m2p', 'join2'), E('join2', 'join'),
      E('join', 'review'), E('review', 'sign'), E('sign', 'end')],
  });

  const merch = doc({
    id: 'merch', kind: 'main', title: 'Visite stock hebdo', noun: 'Visite', status: 'Actif · v7', subtitle: 'Carrefour · Wavre',
    nodes: [
      N('start', 'start', {}),
      stp('intro', 'info', { label: 'Visite stock hebdomadaire', body: 'Carrefour Wavre. Travail hors ligne, tout se synchronise au retour du réseau.' }),
      inp('geo', 'geo', 'Confirmez votre présence sur site', 'POSITION', {}),
      inp('skus', 'collect', 'Quels produits contrôler ?', 'PRODUITS', { required: true, allowOther: true, options: ['Coca-Cola 1,5 L', 'Evian 50 cl', 'Lay’s Paprika 120 g', 'Sprite 33 cl'], help: 'Planogramme pré-chargé. Ajoutez un produit hors liste si besoin.' }),
      N('fork', 'fork', { branches: [{ id: 'bA', label: 'Rayon' }, { id: 'bB', label: 'Vitrine' }] }),
      N('loop', 'loop', { elt: 'produit', from: 'PRODUITS', collect: 'RELEVES', run: 'inspect_sku' }),
      inp('v1', 'photo', 'Photo de la vitrine', 'PHOTO_VITRINE', { required: true }),
      inp('v2', 'single', 'PLV conforme au plan ?', 'PLV', { required: true, options: ['Conforme', 'Partielle', 'Absente'] }),
      N('join', 'join', { forkId: 'fork', mode: 'all' }),
      inp('notes', 'text', 'Autre chose à signaler ?', 'NOTES', { placeholder: 'Notes de visite (facultatif)…' }),
      N('end', 'end', {}),
    ],
    edges: [E('start', 'intro'), E('intro', 'geo'), E('geo', 'skus'), E('skus', 'fork'),
      E('fork', 'loop', 'bA'), E('loop', 'join'),
      E('fork', 'v1', 'bB'), E('v1', 'v2'), E('v2', 'join'),
      E('join', 'notes'), E('notes', 'end')],
  });

  const inspect_aisle = doc({
    id: 'inspect_aisle', kind: 'sub', title: 'inspect_aisle', param: 'rayon', status: 'Sous-routine',
    nodes: [
      N('start', 'start', {}),
      stp('i', 'info', { label: '{rayon}', body: 'Parcourez le rayon {rayon} et vérifiez les références en rayon.' }),
      inp('etat', 'single', '{rayon} : état du rayon', 'ETAT', { required: true, options: ['Complet', 'Trous de rayon', 'Rupture importante'] }),
      inp('rem', 'multi', 'Écarts constatés dans {rayon}', 'REMARQUES', { options: ['DLC dépassée', 'Produits abîmés', 'Étiquette manquante', 'Mauvais emplacement', 'Aucun'] }),
      inp('clean', 'slider', 'Taux de remplissage de {rayon}', 'REMPLISSAGE', { def: 80, unit: '%' }),
      inp('ph', 'photo', 'Photo du rayon {rayon}', 'PHOTO'),
      N('end', 'end', {}),
    ],
    edges: [E('start', 'i'), E('i', 'etat'), E('etat', 'rem'), E('rem', 'clean'), E('clean', 'ph'), E('ph', 'end')],
  });

  const inspect_sku = doc({
    id: 'inspect_sku', kind: 'sub', title: 'inspect_sku', param: 'produit', status: 'Sous-routine',
    nodes: [
      N('start', 'start', {}),
      inp('scan', 'code', 'Scannez le code de {produit}', 'CODE', { required: true }),
      inp('fac', 'number', 'Facings de {produit}', 'FACINGS', { unit: 'facings', def: 4 }),
      inp('note', 'stars', 'Note du rayon {produit}', 'NOTE_RAYON'),
      inp('stock', 'single', '{produit} : en stock ?', 'STOCK', { required: true, options: ['En stock', 'Faible', 'Rupture'] }),
      N('end', 'end', {}),
    ],
    edges: [E('start', 'scan'), E('scan', 'fac'), E('fac', 'note'), E('note', 'stock'), E('stock', 'end')],
  });

  const stock_in = doc({
    id: 'stock_in', kind: 'main', title: 'Entrée de stock', noun: 'Réception', status: 'Brouillon · v1', subtitle: 'Entrepôt · réception mobile',
    nodes: [
      N('start', 'start', {}),
      stp('intro', 'info', { label: 'Entrée de stock', body: 'Scannez le produit reçu, indiquez ses SKU, puis enregistrez. Tout se synchronise à la fin.' }),
      inp('prod', 'code', 'Scannez le produit reçu', 'PRODUIT', { required: true }),
      inp('nsku', 'number', 'Nombre de SKU pour ce produit', 'NB_SKU', { required: true, def: 1, unit: 'SKU', help: 'Par défaut : 1 SKU = 1 produit.' }),
      inp('skus', 'collect', 'SKU à enregistrer', 'SKUS', { required: true, allowOther: true, options: ['SKU-0001', 'SKU-0002', 'SKU-0003'], help: 'Un seul SKU suffit ; ajoutez-en si le produit en a plusieurs.' }),
      N('loop', 'loop', { elt: 'sku', from: 'SKUS', collect: 'SKU_ENREGISTRES', run: 'receive_sku' }),
      stp('rec', 'summary', { label: 'Récapitulatif de la réception', from: 'SKU_ENREGISTRES', fields: [{ label: 'Quantité', key: 'QTE' }, { label: 'Emplacement', key: 'EMPLACEMENT' }] }),
      stp('sync', 'info', { label: 'Synchronisation des données', body: 'Les entrées sont envoyées au stock central. Si le réseau manque, elles partent dès son retour.' }),
      N('end', 'end', {}),
    ],
    edges: [E('start', 'intro'), E('intro', 'prod'), E('prod', 'nsku'), E('nsku', 'skus'), E('skus', 'loop'), E('loop', 'rec'), E('rec', 'sync'), E('sync', 'end')],
  });

  const receive_sku = doc({
    id: 'receive_sku', kind: 'sub', title: 'receive_sku', param: 'sku', status: 'Sous-routine',
    nodes: [
      N('start', 'start', {}),
      inp('qte', 'number', 'Quantité reçue pour {sku}', 'QTE', { required: true, def: 1, unit: 'unités' }),
      inp('loc', 'single', 'Emplacement de {sku}', 'EMPLACEMENT', { options: ['Quai A', 'Allée 3 · Rack B', 'Zone tampon', 'Étage 2'], help: 'Facultatif : vous pouvez ignorer cette étape.' }),
      N('end', 'end', {}),
    ],
    edges: [E('start', 'qte'), E('qte', 'loc'), E('loc', 'end')],
  });

  return { inventory, merch, stock_in, inspect_aisle, inspect_sku, receive_sku };
}

/* ---------- graph helpers ---------- */
export const outsOf = (d, id) => d.edges.filter((e) => e.source === id);
export const insOf = (d, id) => d.edges.filter((e) => e.target === id);
export const nextId = (d, id, handle) => { const e = d.edges.find((x) => x.source === id && (handle === undefined || x.sourceHandle === handle)); return e ? e.target : null; };
export const nodeOf = (d, id) => d.nodes.find((n) => n.id === id);
export const startOf = (d) => d.nodes.find((n) => n.type === 'start');

/* show a sub-routine in place: its steps become read-only "ghost" nodes chained after the loop node */
/**
 * Insère les étapes d'une sous-routine "à la place" du nœud de boucle dans le graphe,
 * pour permettre l'affichage déplié sur le canvas principal.
 * Les nœuds insérés sont marqués _ghost: true et sont en lecture seule.
 *
 * @param {Object} d       - Document principal.
 * @param {Object} wfs     - Dictionnaire de tous les documents.
 * @param {Function} isOpen - (nodeId: string) => boolean — indique si ce nœud est déplié.
 * @param {string} dir     - Direction de mise en page ('TB'|'LR').
 * @returns {{ nodes, edges, ghostOf }}  ghostOf[loopId] = [ghostNodeIds]
 */
export function expandDoc(d, wfs, isOpen, dir) {
  const loops = d.nodes.filter((n) => n.type === 'loop' && isOpen(n.id) && wfs[n.data.run]);
  if (!loops.length) return { nodes: d.nodes, edges: d.edges, ghostOf: {} };
  let ns = [...d.nodes]; let es = [...d.edges]; const ghostOf = {};
  loops.forEach((L) => {
    const S = wfs[L.data.run]; const st = startOf(S); const en = S.nodes.find((n) => n.type === 'end');
    const gid = (id) => `${L.id}::${id}`; ghostOf[L.id] = [];
    const outs = es.filter((e) => e.source === L.id); es = es.filter((e) => e.source !== L.id);
    S.nodes.filter((n) => n.type !== 'start' && n.type !== 'end').forEach((n) => { ghostOf[L.id].push(gid(n.id)); ns.push({ ...n, id: gid(n.id), draggable: false, data: { ...n.data, _ghost: L.id, _gsub: S.id, _gnode: n.id, _gelt: L.data.elt } }); });
    S.edges.forEach((e) => {
      const fromL = e.source === st.id; const from = fromL ? L.id : gid(e.source); const sh = fromL ? undefined : e.sourceHandle;
      if (e.target === en.id) outs.forEach((o) => es.push({ ...o, id: `g_${L.id}_${e.id}_${o.id}`, source: from, sourceHandle: sh, ghost: !fromL }));
      else es.push({ id: `g_${L.id}_${e.id}`, source: from, target: gid(e.target), sourceHandle: sh, ghost: true });
    });
  });
  return { nodes: layout(ns, es, dir), edges: es, ghostOf };
}
/**
 * Compte les usages d'une sous-routine dans tous les workflows.
 * @param {Object} wfs   - Dictionnaire de tous les documents.
 * @param {string} subId - Id de la sous-routine à chercher.
 * @returns {{ uses: number, docs: number }}  uses = nombre d'occurrences, docs = nombre de workflows distincts.
 */
export const usageOf = (wfs, subId) => { let uses = 0; const docs = new Set(); Object.values(wfs).forEach((w) => w.nodes.forEach((n) => { if (n.type === 'loop' && n.data.run === subId) { uses++; docs.add(w.id); } })); return { uses, docs: docs.size }; };

/* branch membership (nested forks allowed): byNode[id] = innermost branch + tag; paths[id] = outer -> inner */
/**
 * Calcule l'appartenance de chaque nœud à une branche parallèle.
 * Gère l'imbrication (fork dans une branche d'un fork parent).
 *
 * @param {Object} d - Document (workflow).
 * @returns {{ byNode: Object, forks: Array, paths: Object }}
 *   byNode[id] = { forkId, idx, branchId, label, tag, path }  — branche la plus imbriquée
 *   forks      = liste des blocs parallèles avec leurs branches et leur profondeur
 *   paths[id]  = chemin complet de branches (outer → inner)
 */
export function branchInfo(d) {
  const byNode = {}; const forks = []; const paths = {};
  const letters = (p) => p.map((x) => BR[x.idx].letter).join('·');
  d.nodes.filter((n) => n.type === 'fork').forEach((f) => {
    const join = d.nodes.find((n) => n.type === 'join' && n.data.forkId === f.id);
    const entry = { fork: f, join, branches: [] };
    f.data.branches.forEach((b, idx) => {
      const ids = []; const seen = new Set();
      const q = outsOf(d, f.id).filter((e) => e.sourceHandle === b.id).map((e) => e.target);
      while (q.length) {
        const id = q.shift();
        if (seen.has(id) || (join && id === join.id)) continue;
        seen.add(id); ids.push(id);
        outsOf(d, id).forEach((e) => q.push(e.target));
      }
      entry.branches.push({ ...b, idx, ids });
    });
    forks.push(entry);
  });
  // outer forks first so the innermost branch wins
  const size = (f) => f.branches.reduce((a, b) => a + b.ids.length, 0);
  [...forks].sort((a, b) => size(b) - size(a)).forEach((f) => f.branches.forEach((b) => b.ids.forEach((id) => {
    const step = { forkId: f.fork.id, idx: b.idx, branchId: b.id, label: b.label };
    paths[id] = [...(paths[id] || []), step]; byNode[id] = { ...step, tag: '', path: paths[id] };
  })));
  Object.keys(byNode).forEach((id) => { byNode[id].tag = letters(paths[id]); });
  forks.forEach((f) => { f.depth = (paths[f.fork.id] || []).length; });
  return { byNode, forks, paths };
}

/* nesting depth of the spot an edge sits in (0 = trunk) */
export function edgeDepth(d, e, info) {
  const src = nodeOf(d, e.source);
  if (src.type === 'fork') return (info.paths[src.id] || []).length + 1;
  if (src.type === 'join') return (info.paths[src.data.forkId] || []).length;
  return (info.paths[src.id] || []).length;
}

/* reading-order outline with branch indentation */
/**
 * Parcours linéaire du graphe (DFS) pour produire la liste du plan du workflow.
 * @param {Object} d - Document.
 * @returns {Array<{ n: Node, depth: number, br: BranchInfo|null }>}
 */
export function outline(d) {
  const rows = []; const start = startOf(d);
  const walk = (id, depth, br, stop) => {
    let cur = id; let g = 0;
    while (cur && cur !== stop && g++ < 200) {
      const n = nodeOf(d, cur); if (!n) break;
      rows.push({ n, depth, br });
      if (n.type === 'fork') {
        const j = d.nodes.find((x) => x.type === 'join' && x.data.forkId === n.id);
        n.data.branches.forEach((b, i) => { const e = d.edges.find((x) => x.source === n.id && x.sourceHandle === b.id); if (e) walk(e.target, depth + 1, { ...b, idx: i }, j && j.id); });
        if (j) { rows.push({ n: j, depth, br }); cur = nextId(d, j.id); continue; }
        break;
      }
      cur = nextId(d, cur);
    }
  };
  if (start) walk(start.id, 0, null, null);
  return rows;
}

/**
 * Valide un document et retourne la liste des points de contrôle.
 * @param {Object} wfs - Dictionnaire de tous les documents (pour vérifier les sous-routines).
 * @param {Object} d   - Document à valider.
 * @returns {Array<{ label: string, ok: boolean }>}
 */
export function validate(wfs, d) {
  const out = []; const ok = (o, label) => out.push({ ok: o, label });
  const start = startOf(d); const end = d.nodes.find((n) => n.type === 'end');
  const reach = new Set(); const q = start ? [start.id] : [];
  while (q.length) { const id = q.shift(); if (reach.has(id)) continue; reach.add(id); outsOf(d, id).forEach((e) => q.push(e.target)); }
  const toEnd = new Set(); const rq = end ? [end.id] : [];
  while (rq.length) { const id = rq.shift(); if (toEnd.has(id)) continue; toEnd.add(id); insOf(d, id).forEach((e) => rq.push(e.source)); }
  const dead = d.nodes.filter((n) => !toEnd.has(n.id)).length;
  const orphan = d.nodes.filter((n) => !reach.has(n.id)).length;
  ok(!!end && reach.has(end.id) && dead === 0, dead ? `${dead} étape(s) n’atteignent jamais la fin` : 'La fin est atteinte sur chaque chemin');
  ok(orphan === 0, orphan ? `${orphan} étape(s) inaccessibles depuis le début` : 'Aucune étape orpheline');
  const forks = d.nodes.filter((n) => n.type === 'fork');
  const badFork = forks.filter((f) => !d.nodes.some((n) => n.type === 'join' && n.data.forkId === f.id) || f.data.branches.length < 2).length;
  ok(badFork === 0, badFork ? 'Un bloc parallèle n’a pas de synchronisation ou moins de 2 branches' : forks.length ? `${forks.length} bloc(s) parallèle(s), branches synchronisées` : 'Aucun bloc parallèle');
  const keys = d.nodes.filter((n) => n.type === 'step' && n.data.key).map((n) => n.data.key);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  const noKey = d.nodes.filter((n) => n.type === 'step' && n.data.kind === 'input' && !n.data.key).length;
  ok(!dup.length && !noKey, dup.length ? `Clé de données en double : ${dup[0]}` : noKey ? 'Une saisie n’a pas de clé de données' : 'Clés de données uniques');
  const collects = new Set(d.nodes.filter((n) => n.type === 'step' && n.data.input === 'collect').map((n) => n.data.key));
  const badLoop = d.nodes.filter((n) => n.type === 'loop' && (!wfs[n.data.run] || !collects.has(n.data.from))).length;
  ok(badLoop === 0, badLoop ? 'Une boucle pointe vers une sous-routine ou une liste introuvable' : 'Toutes les boucles se résolvent');
  return out;
}

export function makeKey(label, d) {
  const base = (label || 'DONNEE').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 22) || 'DONNEE';
  const used = new Set(d.nodes.map((n) => n.data.key)); let k = base, i = 2;
  while (used.has(k)) k = base + '_' + i++;
  return k;
}

export const ADD_TYPES = [
  { id: 'info', group: 'Structure', label: 'Information', ic: 'info', hint: 'Écran de consigne ou d’accueil' },
  { id: 'loop', group: 'Structure', label: 'Boucle', ic: 'loop', hint: 'Exécute une sous-routine par élément' },
  { id: 'fork', group: 'Structure', label: 'Branches parallèles', ic: 'branch', hint: 'Deux parcours en même temps' },
  { id: 'summary', group: 'Structure', label: 'Synthèse', ic: 'file', hint: 'Relecture avant signature' },
  ...Object.entries(INPUTS).map(([id, v]) => ({ id, group: 'Saisie', label: v.label, ic: v.ic })),
];

export function makeNode(typeId, d, wfs) {
  const id = uid('n');
  if (typeId === 'info') return N(id, 'step', { kind: 'info', label: 'Nouvelle information', body: '' });
  if (typeId === 'summary') { const c = d.nodes.find((n) => n.data.input === 'collect'); return N(id, 'step', { kind: 'summary', label: 'Relecture', from: c ? c.data.key : '', fields: [] }); }
  if (typeId === 'loop') { const c = d.nodes.find((n) => n.data.input === 'collect'); const sub = Object.values(wfs).find((x) => x.kind === 'sub'); return N(id, 'loop', { elt: 'element', from: c ? c.data.key : '', collect: 'RESULTATS', run: sub ? sub.id : '' }); }
  const label = INPUTS[typeId].label;
  const extra = {};
  if (['single', 'multi', 'collect'].includes(typeId)) extra.options = ['Option 1', 'Option 2'];
  if (typeId === 'collect') extra.allowOther = true;
  if (typeId === 'slider') extra.def = 50;
  if (typeId === 'number') extra.def = 0;
  return N(id, 'step', { kind: 'input', input: typeId, label: 'Nouvelle saisie · ' + label.toLowerCase(), key: makeKey('SAISIE_' + label, d), ...extra });
}
