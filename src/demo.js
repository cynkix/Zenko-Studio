/**
 * demo.js — Données de démonstration uniquement.
 * Remplacer par une API ou un store réel en production.
 */

/** Activité journalière (nombre de workflows lancés sur les 14 derniers jours) */
export const DAYS = [38, 42, 35, 51, 47, 22, 14, 44, 49, 53, 46, 58, 25, 17];

/** Dernières exécutions affichées dans le tableau de bord */
export const RECENT = [
  ['Inventaire magasin',  'Carrefour Wavre',   'Terminé',            '6 min 12', true],
  ['Visite stock hebdo',  'Carrefour Wavre',   'Terminé',            '9 min 40', true],
  ['Visite stock hebdo',  'Carrefour Namur',   'En cours',           '—',        true],
  ['Entrée de stock',     'Entrepôt Liège',    'En attente de sync', '7 min 03', false],
  ['Visite stock hebdo',  'Delhaize Ottignies','Terminé',            '8 min 51', false],
];

/**
 * Personnes de démo pour le mode collaboration.
 * @typedef {{ id: string, name: string, mail: string, role: string, tone: string, client?: boolean, online?: boolean }} Person
 * @type {Person[]}
 */
export const PEOPLE0 = [
  { id: 'me',    name: 'Vous',         mail: 'me@zenika.com',           role: 'owner',   tone: 'var(--accent)' },
  { id: 'marie', name: 'Marie Dupont', mail: 'marie.dupont@client.com', role: 'comment', tone: 'var(--ba)', client: true, online: true },
];

/**
 * Commentaires de démo rattachés aux étapes (clé = "docId:nodeId").
 * @type {Record<string, Array<{id:string,who:string,text:string,at:string,done:boolean}>>}
 */
export const COMMENTS0 = {
  'stock_in:nsku': [
    { id: 'c1', who: 'marie', text: 'On peut garder 1 par défaut, mais masquer ce champ pour les produits simples ?', at: '09:42', done: false },
  ],
  'stock_in:loc': [
    { id: 'c2', who: 'marie', text: "L'emplacement doit rester facultatif (option « Ignorer »).", at: '09:47', done: true },
  ],
};
