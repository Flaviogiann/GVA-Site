# GVA — Genève Aéroport

Projet semestriel de l'option WEB (CPNV, médiamatique 3e année). Refonte de
démonstration du site public de Genève Aéroport, d'après la maquette
`dossier-projet/GVA - Maquette site web.dc.html`. Le cahier des charges est dans
`dossier-projet/Cahier_des_charges_GVA_v2.docx`.

## Contraintes du projet

- HTML5, CSS3 et JavaScript ES6 **sans framework** (ni React, ni Vue, ni Bootstrap).
- GSAP 3.13 + ScrollTrigger et three.js 0.186, chargés depuis `js/vendor/` (pas de CDN).
- Aucun outil de compilation : le site doit tourner derrière un simple serveur statique.
  Les bibliothèques sont minifiées une fois pour toutes et versionnées telles quelles.
- Page unique. Pas de PWA : abandonnée en version N°2 du cahier des charges (09.09.2026).
- Textes de l'interface et commentaires du code **en français**.

## Support navigateurs

**Firefox n'est pas une cible.** Décision du 09.09.2026.
Cibles : dernières versions de Chrome, Edge et Safari, sur ordinateur et téléphone.

Conséquences pratiques :

- Les 120 frames du hero sont en **AVIF** (jeux 1920 px et 1080 px), sans jumeau
  WebP par frame. Seules les affiches statiques ont un repli WebP.
- Les fonctionnalités « Baseline newly available » sont utilisables sans repli
  dès lors qu'elles sont gérées par Chrome, Edge et Safari.
- Un repli reste obligatoire pour ce qui touche à l'accessibilité
  (`prefers-reduced-motion`) et pour le cas où une ressource ne charge pas.
- `interestfor`, `popover="hint"` et le positionnement par ancre ne sont pas
  utilisés : Safari ne les gère pas tous.

## Organisation du JavaScript

- `js/main.js` : script classique (hero, menu). Il doit rester chargé avant les modules.
- `js/exploration.js` : module ES, interface de la section 2.
- `js/exploration-3d.js` : module ES importé dynamiquement à l'approche de la section.
  Il utilise `window.gsap`.
- La carte d'import (`index.html`, fin du `<body>`) fait correspondre `three` et
  `three/addons/` aux fichiers de `js/vendor/three/`.
- `js/vols.js` : module ES, tableau des vols (section 3). Les vols sont simulés :
  le programme est dans `js/donnees/vols.js`, le statut vient de l'heure de Genève
  et `annoncerUnRetard()` joue le rôle du serveur. `?heure=HH:MM` règle l'horloge.
- Les textes des points d'intérêt sont dans `js/donnees/points-interet.js`.

## Conventions

- Classes CSS en français, nommage type BEM : `.hero__titre`, `.hero--statique`,
  `.est-actif`, `.est-masque`.
- Jetons de design dans `:root` (`css/style.css`, section 1). Les couleurs,
  marges et durées viennent du design system de la maquette : ne pas écrire de
  valeur en dur ailleurs.
- Les durées d'animation reprennent les annotations de la maquette
  (`--duree-palier: 240ms`, `--duree-cta: 320ms`, etc.).
- Les fichiers CSS et JS sont découpés en sections numérotées et commentées.

## Modèle 3D

- Le fichier chargé est `modeles/terminal.glb` (attribut `data-modele`).
- Conventions du fichier : objets vides `pastille-1` à `pastille-6`, `vue-<n>`
  facultatifs, toutes les animations jouées en boucle. Détails dans
  `modeles/LISEZMOI.md`.
- Le modèle actuel est **provisoire** : `outils/modele-provisoire/generer-terminal.mjs`.
- `?modele=…` dans l'adresse charge un autre fichier ; `?debug` expose
  `window.gva3d` (caméra, contrôles, scène).

## Encoder les frames du hero

Le script est `outils/encode-frames.sh`.

**Piège important** : il faut le muxer `-f avif` de ffmpeg, avec **un appel par
image**. Avec `-f image2` et un motif `%03d.avif`, ffmpeg encode la suite comme
une vidéo : les frames sont inter-codées, les fichiers paraissent légers mais le
navigateur ne peut pas les décoder isolément (`naturalWidth` vaut 0).

## Pièges déjà rencontrés

- **three.js 0.186** : `THREE.Clock` est déprécié (utiliser `THREE.Timer`),
  `PCFSoftShadowMap` n'existe plus (`PCFShadowMap` + `shadow.radius`).
- Après avoir changé le cadre d'une caméra d'ombre, appeler
  `shadow.camera.updateProjectionMatrix()`.
- Une caméra déplacée hors de la boucle de rendu doit être réorientée
  (`lookAt`) avant un rendu : `OrbitControls.update()` ne passe qu'à l'image suivante.
- En colonne flex, `flex: 1` annule la hauteur fixée : `.exploration__vue` passe
  en `flex: none` sous 1024 px.
- L'épinglage du hero rallonge la page après chargement : une ancre dans
  l'adresse est visée à nouveau par `viserAncre()` dans `main.js`.
- **`scroll-behavior: smooth` et ScrollTrigger** : pour se recalculer (chargement,
  redimensionnement), ScrollTrigger coupe le défilement doux puis appelle
  `scrollTo(0, 0)`. Chrome ne relit pas le style pour cette position : la remontée
  reste animée et le scrub démarre décalé (bande bleu nuit sous l'en-tête en fin de
  hero). `couperDefilementDoux()` (écouteur `refreshInit`, `main.js`) force le
  recalcul. Test : redimensionner en plein scrub, `ScrollTrigger.getAll()[0].start`
  doit rester à 0.
