# GVA — Genève Aéroport

Refonte de démonstration du site public de Genève Aéroport, réalisée dans le
cadre du projet semestriel de l'option WEB (CPNV, médiamatique 3e année).

> Projet d'école. Ce site n'est ni commandé ni validé par Genève Aéroport SA et
> n'utilise aucun élément de son identité visuelle officielle.

La maquette de référence est `../GVA - Maquette site web.dc.html`, le cahier des
charges `../Cahier_des_charges_GVA.docx`.

## Lancer le projet

Le site est statique et n'a besoin d'aucune compilation. Il lui faut simplement
un serveur, parce que le canvas lit les frames en HTTP :

```bash
npx serve GVA_SITE -l 4173
```

Puis ouvrir `http://localhost:4173`.

## État d'avancement

| Bloc | État |
| --- | --- |
| 0 · Design system | jetons CSS et boutons en place |
| 1 · Hero vidéo scrubbée | **fait** |
| 2 · Exploration du terminal | à faire — jalon J4 |
| 3 · Vos vols en temps réel | à faire — jalon J5 |
| 4 · Accès & Parking | à faire — jalon J5 |
| 5 · Boutiques & restaurants | à faire — jalon J5 |
| 6 · Pied de page | à faire — jalon J5 |

## Arborescence

```
GVA_SITE/
├── index.html
├── css/style.css          jetons de design, en-tête, hero, responsive
├── js/
│   ├── main.js            le scrub, le chargement des frames, le menu
│   └── vendor/            GSAP 3.13 et ScrollTrigger, en local
├── images/hero/
│   ├── 1920/000…119.avif  la séquence, version ordinateur
│   ├── 1080/000…119.avif  la séquence, version téléphone
│   └── poster*.avif|webp  l'affiche fixe, en deux tailles
└── outils/encode-frames.sh
```

## Le hero scrubbé

Le plateau du hero reste épinglé à l'écran pendant environ 2000 px de
défilement (1200 px sur téléphone). La progression du scroll dans cette zone
choisit la frame dessinée dans le canvas. Rien ne bouge tout seul : l'image
n'avance que si l'on défile, exactement comme le demande la maquette.

### Pourquoi une suite d'images et pas une vidéo

La maquette laissait le choix entre un MP4 à keyframes denses et une séquence de
120 images. Le scrub d'un `<video>` est irrégulier sur iOS, où le navigateur
décide seul du moment où il honore un changement de `currentTime`. Un canvas
dessine au contraire exactement la frame demandée, sans dépendre du décodeur
vidéo. C'est un peu plus lourd à télécharger, mais le mouvement est fidèle au
défilement sur tous les appareils testés.

### Les quatre paliers de titres

Les quatre titres de la maquette sont empilés au même endroit et alignés par le
bas : le bloc grandit vers le haut, ce qui reproduit les frames 01 à 04. Un seul
palier porte la classe `est-actif` à la fois, et le fondu croisé de 240 ms est
géré par une transition CSS.

| Progression | Palier |
| ---: | --- |
| 0 % | Genève · Bienvenue à Genève |
| 33 % | Votre porte vers le monde |
| 66 % | 180 destinations |
| 90 % | Prêt pour l'embarquement |
| 97 % | entrée des deux appels à l'action |

Le dernier titre est avancé à 90 % plutôt qu'à 100 % pour qu'il ait le temps
d'être lu avant la bascule.

### Le chargement progressif

Charger 120 images avant de rendre la main donnerait plusieurs secondes d'attente
sur un écran vide. Les frames sont donc téléchargées par passes de plus en plus
fines — une image sur 24, puis sur 12, 6, 3, et enfin toutes — six requêtes en
parallèle. Tant qu'une frame manque, le canvas dessine **la plus proche déjà
chargée** : le scrub est utilisable presque tout de suite et se précise à mesure.
La frame que l'on regarde passe par ailleurs devant la file d'attente.

L'affiche fixe, elle, est l'image LCP : elle est préchargée en
`fetchpriority="high"` et reste visible sous le canvas jusqu'à ce que celui-ci
ait dessiné sa première image.

### Le poids des médias

Deux jeux de frames sont produits, choisis au chargement selon la largeur de
l'écran. Un seul des deux est téléchargé.

| Jeu | Frames | Par frame | Total |
| --- | ---: | ---: | ---: |
| 1920 px (ordinateur) | 120 | 127 Ko | 15,0 Mo |
| 1080 px (téléphone) | 120 | 27 Ko | 3,2 Mo |
| affiche 1920 (AVIF / WebP) | 1 | — | 273 / 356 Ko |
| affiche 1080 (AVIF / WebP) | 1 | — | 75 / 106 Ko |

**Le jeu ordinateur dépasse le plafond de 6 Mo fixé par le cahier des charges.**
Un premier encodage en 1440 px tenait dans 5,2 Mo, mais l'image était visiblement
dégradée : bâtiments et arbres partaient en bouillie dès que le hero occupait
tout l'écran. Le passage à 1920 px — la résolution native des rushes — corrige le
problème et multiplie le poids par trois.

Trois leviers permettent de revenir en arrière, dans `outils/encode-frames.sh` :

| Levier | Effet |
| --- | --- |
| `CRF_BUREAU` 38 → 43 | environ 5 Mo, mais l'image redevient molle |
| passer à 90 frames au lieu de 120 | environ 11 Mo, scrub encore fluide (22 px par frame) |
| `LARGEUR_BUREAU` 1920 → 1600 | environ 10 Mo, léger flou sur écran 1440 |

Le poids total compte moins qu'il n'y paraît : les frames arrivent en tâche de
fond après le premier rendu, et c'est l'affiche seule qui détermine le LCP.
Le point reste à arbitrer avec l'enseignant, et le chiffre du cahier des charges
à corriger en conséquence.

### Les replis

Le scrub ne démarre pas dans deux cas, et le hero devient alors une section
normale avec une image fixe :

- **Mouvements réduits** (`prefers-reduced-motion`) : la maquette demande une
  image fixe et le titre final. On charge la dernière frame, on la dessine, et le
  palier « Prêt pour l'embarquement » est affiché d'emblée avec ses appels à
  l'action.
- **Frames indisponibles** : le chargement de la frame 0 sert de test. S'il
  échoue, on garde l'affiche et le premier titre.

### Accessibilité

- Le titre `h1` est celui du premier palier.
- Les paliers inactifs sont en `visibility: hidden`, ce qui évite que les liens
  d'un palier invisible restent atteignables au clavier.
- Le canvas est décoratif (`aria-hidden`) : c'est l'affiche qui porte le texte
  alternatif.
- La barre de progression est décorative et masquée aux lecteurs d'écran.
- Au clavier, la barre d'espace et Page suivante font défiler la page, donc
  avancent le scrub et rendent les appels à l'action atteignables.
- Un lien d'évitement mène directement au contenu.

## À faire

- [ ] Trancher la question du filigrane « Google Earth » (voir Crédits).
- [ ] Auto-héberger la police Inter (aujourd'hui chargée depuis Google Fonts,
      alors que le cahier des charges la demande auto-hébergée).
- [ ] Remplacer la section 2 provisoire par l'exploration du terminal.
- [ ] Mesurer avec Lighthouse et consigner le résultat.
- [ ] Tester sur iPhone et sur Android réels.
- [ ] Écrire `CREDITS.md` avec les licences des images.

## Crédits et licences

Les rushes du hero sont un export **Google Earth Studio**. Les fournisseurs de
données sont listés dans `../gva_hero/gva_hero/ImagerySources.txt` : Vexcel
Imaging US Inc., Airbus, Landsat / Copernicus, ©swisstopo, Data SIO, NOAA,
U.S. Navy, NGA, GEBCO.

**Point à trancher** : un filigrane « Google Earth » est incrusté dans les
images, vers le centre droit du cadre. Il est bien visible pendant tout le
scrub. Ce filigrane **est** l'attribution exigée par Google : le retirer ou le
recadrer hors champ contreviendrait aux conditions d'utilisation de Google Earth
Studio, qui limitent par ailleurs cet usage au non commercial et à l'éditorial.

Trois options, à décider avec l'enseignant :

1. Le garder tel quel et citer Google Earth Studio dans les crédits — conforme,
   mais le filigrane reste visible dans le hero.
2. Recomposer le mouvement avec des images sous une autre licence
   (photographies libres, ou rendu 3D maison).
3. Demander à Genève Aéroport des visuels utilisables.

---

Option WEB · M06 · CPNV
