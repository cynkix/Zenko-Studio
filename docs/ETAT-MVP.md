# Zenko Studio — état du MVP (12 nov. 2026)

Prototype validé par l'équipe. Ce document permet de reprendre le travail sans l'historique de conversation.

## Ce que fait le prototype
- **Tableau de bord** : onglet *Équipe* (période Jour/Semaine/Mois/Année/Perso, comparaison, KPI, graphique, « Par workflow », bascule *Exécutions / Workflows*, « Workflows à surveiller », export CSV) et onglet *Mes workflows* (gestion de mes créations : Brouillon → En relecture → Activé, cartes cliquables, activer / relecture / dupliquer / archiver / assigner, filtres, tableau ou liste).
- **Studio** : éditeur React Flow, blocs parallèles imbriqués (profondeur 2), boucles sur sous-routines dépliables, bibliothèque de blocs, inspecteur unifié, contrôles (pill « Valide »), activation + versions, collaboration (commentaires, validation client) et assistant bot (règles locales), aperçu live, Play (simulateur).
- **App mobile (démo)** : boîte de réception avec statuts (Assigné / En cours / Terminé / Synchro), démarrage en équipe, progression, retour arrière avec confirmation, bouton Quitter, stockage local, synchro en arrière-plan, file d'envoi des médias, onglet Données (catalogues et listes de prix hors ligne), mode en ligne / hors ligne simulé.
- **Côté studio pour le terrain** : assignation à un utilisateur ou à un groupe dynamique (filtres de tags), import CSV de jeux de données et poussée vers les appareils.

## Organisation du code
- `src/app.jsx` : shell, état global, TopBar, Sidebar, Inspector, Dashboard (+ MyWorkflows), MobileDemo, NewFlow. **C'est le fichier réellement construit.**
- `src/data.js` (modèle, `layout` dagre + `orderBranches`, `expandDoc`, `validate`), `src/engine.js` (moteur Play), `src/ops.js`, `src/flow.jsx` (nœuds et arêtes React Flow), `src/phone.jsx`, `src/collab.jsx`, `src/admin.jsx` (assignation, jeux de données), `src/demo.js` (données de démo), `src/styles.css`.
- `src/views/*` et `src/editor/Inspector.jsx` : copies de découpage **non importées et périmées** → à supprimer ou à reprendre avant une vraie base de code.
- Build : `node build.mjs` produit `dist/studio.html` (un seul fichier, ~630 Ko). `vercel.json` sert `dist/` en statique (sans étape de build).

## Limites connues (démo)
- Aucune donnée réelle : exécutions, tâches, graphiques et synchronisation sont simulés. L'assistant est un jeu de règles locales, sans modèle. La collaboration est locale (un seul navigateur).
- Reprise d'un workflow mis en pause : relance depuis le début.
- Export CSV : ne télécharge pas dans l'artifact Claude (permission de téléchargement) ; fonctionne sur Vercel.
- Vercel : l'état du déploiement n'a pas pu être vérifié depuis la session (logs inaccessibles).

## Pièges rencontrés
- Remplacements Python : attention à l'apostrophe typographique `’` dans les sources.
- Collisions de classes CSS (`.bot`, `.bm`, `.lnk`) : préfixer.
- Une réécriture de bloc a supprimé `parseLine` par erreur : comparer les noms de fonctions avant/après (`grep ^function`).
- L'artifact publié se met à jour en republiant le même fichier ; `edits` ne s'applique pas au HTML minifié.

## Suites possibles
1. Nettoyage : supprimer les copies `src/views` et `src/editor`, découper `app.jsx` (≈ 1 000 lignes) en modules réellement importés, tests.
2. Branchement réel : API pour workflows / exécutions / jeux de données, authentification, vraie synchronisation hors ligne (IndexedDB + file d'envoi).
3. Transfert du dépôt vers l'organisation `zenika-dev` quand le code est nettoyé.
4. Reprise exacte d'un workflow mis en pause ; collaboration temps réel ; assistant relié à un modèle.
