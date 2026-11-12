# Zenko Studio

Éditeur de workflows mobiles pour la gestion des opérations terrain (inventaire, entrée de stock, visites…).

## Stack
- React 18 + React Flow 11
- Dagre (mise en page automatique)
- Build : esbuild → un seul fichier HTML auto-contenu (`dist/studio.html`)

## Démarrage

```bash
npm install
npm run build
# Ouvrir dist/studio.html dans un navigateur
```

## Structure
```
src/
  app.jsx      – Shell, état global, vues (dashboard, studio, play)
  flow.jsx     – Canvas React Flow (nœuds, arêtes)
  phone.jsx    – Simulateur app mobile (Play)
  engine.js    – Moteur d'exécution des workflows
  data.js      – Modèle de données, layout, branchInfo
  ops.js       – Opérations d'édition (insert, delete, fork…)
  collab.jsx   – Collaboration et assistant
  icons.jsx    – Icônes SVG
  styles.css   – Tokens CSS (thème clair/sombre, charte Zenika)
  logo.jsx     – Emblème Zenika
build.mjs      – Script de build esbuild
dist/
  studio.html  – Build auto-contenu (prêt à ouvrir)
```
