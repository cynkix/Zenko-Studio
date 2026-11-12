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

/** Utilisateurs de l'espace de travail (démo) avec leurs tags — sert à l'assignation par groupe dynamique. */
export const USERS = [
  { n: 'Cyril R.', tags: ['rôle:responsable', 'site:Wavre', 'équipe:matin'] },
  { n: 'Marie D.', tags: ['rôle:équipier', 'site:Wavre', 'équipe:matin'] },
  { n: 'Paul M.', tags: ['rôle:équipier', 'site:Wavre', 'équipe:après-midi'] },
  { n: 'Sophie L.', tags: ['rôle:responsable', 'site:Namur', 'équipe:matin'] },
  { n: 'Marc T.', tags: ['rôle:équipier', 'site:Ottignies', 'équipe:matin'] },
];
export const SPACES = ['Carrefour Belgique', 'Entrepôts Liège'];

/** Extrait de catalogue produits (aperçu consultable hors ligne). */
export const PRODUCTS = [
  ['Lait demi-écrémé 1 L', '5400101234561', 'Frais', '1,19 €'], ['Yaourt nature x8', '5400101234578', 'Frais', '2,35 €'],
  ['Beurre doux 250 g', '5400101234585', 'Frais', '2,79 €'], ['Jambon cuit 4 tr.', '5400101234592', 'Charcuterie', '2,49 €'],
  ['Pâtes penne 500 g', '5400101234608', 'Épicerie', '1,05 €'], ['Riz basmati 1 kg', '5400101234615', 'Épicerie', '2,89 €'],
  ['Huile d’olive 75 cl', '5400101234622', 'Épicerie', '6,99 €'], ['Pommes Jonagold 1 kg', '5400101234639', 'Fruits & légumes', '2,19 €'],
  ['Tomates grappe 500 g', '5400101234646', 'Fruits & légumes', '2,49 €'], ['Eau minérale 6 x 1,5 L', '5400101234653', 'Boissons', '3,29 €'],
  ['Café moulu 250 g', '5400101234660', 'Boissons', '3,99 €'], ['Lessive liquide 2 L', '5400101234677', 'Entretien', '7,45 €'],
];
/** Jeux de données déjà poussés vers les appareils (démo). */
export const DATASETS0 = [
  { id: 'ds1', name: 'Catalogue produits', type: 'Catalogue produits', cols: ['Produit', 'EAN', 'Rayon', 'Prix'], data: PRODUCTS, rows: 1240, size: '2,4 Mo', updated: '9 nov.', pushed: true, devices: 12 },
  { id: 'ds2', name: 'Liste de prix magasin', type: 'Liste de prix', cols: ['Produit', 'Prix HT', 'TVA'], data: PRODUCTS.map((p) => [p[0], (parseFloat(p[3].replace(',', '.')) / 1.06).toFixed(2).replace('.', ',') + ' €', '6 %']), rows: 860, size: '0,9 Mo', updated: '5 nov.', pushed: true, devices: 12 },
];
