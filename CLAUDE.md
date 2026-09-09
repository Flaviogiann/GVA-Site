# GVA — Genève Aéroport

Projet semestriel de l'option WEB (CPNV, médiamatique 3e année). Refonte de
démonstration du site public de Genève Aéroport, d'après la maquette
`../GVA - Maquette site web.dc.html`. Le cahier des charges est dans
`../Cahier_des_charges_GVA.docx`.

## Contraintes du projet

- HTML5, CSS3 et JavaScript ES6 **sans framework** (ni React, ni Vue, ni Bootstrap).
- GSAP 3.13 + ScrollTrigger, chargés depuis `js/vendor/` (pas de CDN).
- Aucun outil de compilation : le site doit tourner derrière un simple serveur statique.
- Page unique. Les fichiers PWA viendront à la racine au jalon J6.
- Textes de l'interface et commentaires du code **en français**.

## Support navigateurs

**Firefox n'est pas une cible.** Décision du 09.09.2026.
Cibles : dernières versions de Chrome, Edge et Safari, sur ordinateur et téléphone.

Conséquences pratiques :

- Les frames du hero sont en **AVIF**, sans jumeau WebP par frame. Seules les
  affiches statiques ont un repli WebP.
- Les fonctionnalités « Baseline newly available » sont utilisables sans repli
  dès lors qu'elles sont gérées par Chrome, Edge et Safari.
- Un repli reste obligatoire pour ce qui touche à l'accessibilité
  (`prefers-reduced-motion`) et pour le cas où une ressource ne charge pas.

## Conventions

- Classes CSS en français, nommage type BEM : `.hero__titre`, `.hero--statique`,
  `.est-actif`, `.est-masque`.
- Jetons de design dans `:root` (`css/style.css`, section 1). Les couleurs,
  marges et durées viennent du design system de la maquette : ne pas écrire de
  valeur en dur ailleurs.
- Les durées d'animation reprennent les annotations de la maquette
  (`--duree-palier: 240ms`, `--duree-cta: 320ms`, etc.).
- Les fichiers CSS et JS sont découpés en sections numérotées et commentées.

## Encoder les frames du hero

Le script est `../../../../AppData/Local/Temp/…/encode-frames.sh` ; sa version de
référence est recopiée dans `outils/encode-frames.sh`.

**Piège important** : il faut le muxer `-f avif` de ffmpeg, avec **un appel par
image**. Avec `-f image2` et un motif `%03d.avif`, ffmpeg encode la suite comme
une vidéo : les frames sont inter-codées, les fichiers paraissent légers mais le
navigateur ne peut pas les décoder isolément (`naturalWidth` vaut 0).
