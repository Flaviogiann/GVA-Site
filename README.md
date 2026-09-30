# GVA — Genève Aéroport

Refonte de démonstration du site public de Genève Aéroport, réalisée dans le
cadre du projet semestriel de l'option WEB (CPNV, médiamatique 3e année).

> Projet d'école. Ce site n'est ni commandé ni validé par Genève Aéroport SA et
> n'utilise aucun élément de son identité visuelle officielle.

La maquette de référence, le cahier des charges et la présentation sont dans
`dossier-projet/`.

> **Historique du dépôt.** Le projet a d'abord été développé hors de Git. Les
> commits antérieurs au 30 septembre 2026 ont été reconstitués après coup à
> partir des journaux de travail : leur contenu et leurs dates correspondent aux
> modifications réelles, mais ils n'ont pas été enregistrés au fil de l'eau.

## Lancer le projet

Le site est statique et n'a besoin d'aucune compilation. Il lui faut simplement
un serveur, parce que le canvas et la 3D lisent leurs fichiers en HTTP :

```bash
npx serve . -l 4173
```

Puis ouvrir `http://localhost:4173`. Le fichier `serve.json` désactive le cache
du navigateur pendant le développement.

Deux paramètres d'adresse aident à travailler sur la 3D :

| Paramètre | Effet |
| --- | --- |
| `?modele=modeles/autre.glb` | charge un autre modèle sans toucher au HTML |
| `?debug` | expose la scène dans la console : `window.gva3d` |

## État d'avancement

| Bloc | État |
| --- | --- |
| 0 · Design system | jetons CSS et boutons en place |
| 1 · Hero vidéo scrubbée | **fait** |
| 2 · Exploration du terminal | **fait**, avec un modèle 3D provisoire |
| 3 · Vos vols en temps réel | à faire — jalon J5 |
| 4 · Accès & Parking | à faire — jalon J5 |
| 5 · Boutiques & restaurants | à faire — jalon J5 |
| 6 · Pied de page | à faire — jalon J5 |

## Arborescence

```
GVA-Site/
├── index.html
├── css/style.css              jetons de design, en-tête, hero, 3D, responsive
├── js/
│   ├── main.js                le scrub, le chargement des frames, le menu
│   ├── exploration.js         section 2 : légende, pastilles, panneau
│   ├── exploration-3d.js      section 2 : scène three.js, chargée à la demande
│   ├── donnees/
│   │   └── points-interet.js  textes des six points d'intérêt
│   └── vendor/
│       ├── gsap.min.js, ScrollTrigger.min.js
│       └── three/             three.js 0.186, minifié, et ses modules
├── images/hero/
│   ├── 1920/000…119.avif      la séquence, version ordinateur
│   ├── 1080/000…119.avif      la séquence, version téléphone
│   └── poster*.avif|webp      l'affiche fixe, en deux tailles
├── modeles/
│   ├── terminal.glb           le modèle 3D (provisoire)
│   └── LISEZMOI.md            comment intégrer le vrai modèle
├── outils/
│   ├── encode-frames.sh       encodage des frames du hero
│   └── modele-provisoire/     génération du modèle 3D provisoire
└── dossier-projet/            cahier des charges, maquette, présentation
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

## L'exploration 3D

Une maquette 3D de l'aéroport, posée sur une île flottante, que l'on fait
pivoter à la souris, au doigt ou au clavier. Six pastilles numérotées ouvrent un
panneau d'information. L'interaction s'inspire de la carte de
[TheWood & fils](https://www.thewoodetfils.com/a-propos#notre-monde) ; la mise
en page et le design suivent les frames 06, 07 et 07-M de la maquette.

### Ce qui se passe

| Action | Effet |
| --- | --- |
| Section visible à plus de 30 % | la caméra entre en orbite lente |
| Glisser, molette, pincer | pivoter, zoomer ; l'orbite s'arrête |
| Survol d'une pastille | elle grossit et affiche son nom |
| Clic sur une pastille ou une ligne de la légende | la caméra vole vers le point, le panneau s'ouvre |
| Clic sur une autre pastille, panneau ouvert | le contenu change en fondu |
| Croix, Échap, ou « Voir sur le plan » | le panneau se ferme |
| Bouton œil | affiche tous les noms, placés pour ne pas se chevaucher |
| Bouton « i » | réaffiche l'aide gestuelle |
| Boutons ↺ ↻ − + | pivotent de 45° et zooment |
| « Réinitialiser la vue » | retour au cadrage de départ, orbite relancée |
| Clavier sur la vue | flèches pour pivoter et incliner, + et − pour zoomer, 0 pour revenir |

Sur téléphone, le panneau devient une feuille qui monte du bas sur 70 % de
l'écran. On la ferme en la glissant vers le bas, en touchant à côté ou avec la
croix. La vue 3D remonte sous l'en-tête pour rester visible au-dessus de la
feuille, et la page revient à sa place à la fermeture.

### Comment c'est construit

- **Chargement à la demande.** three.js pèse environ 800 Ko minifié. Le module
  `exploration-3d.js` n'est importé que lorsque la section approche de l'écran,
  il ne ralentit donc pas l'arrivée sur le hero.
- **Un modèle interchangeable.** Le site charge un fichier `.glb`, le recentre et
  le ramène toujours à la même taille. Les pastilles se posent sur les objets
  vides `pastille-1` à `pastille-6` du modèle. Tout est expliqué dans
  `modeles/LISEZMOI.md`.
- **Des pastilles en HTML.** Elles sont projetées depuis la 3D à chaque image.
  Une pastille cachée derrière un bâtiment est atténuée.
- **La caméra vole en coordonnées sphériques.** GSAP anime la cible, la distance
  et les deux angles, pour que la caméra tourne autour du modèle au lieu de le
  traverser.
- **Le point regardé reste visible.** Quand le panneau couvre une partie de la
  vue, l'image est décalée pour centrer le point dans la partie libre.
- **Le panneau est un `<dialog>`.** Non modal sur ordinateur, pour changer de
  point sans le fermer. Modal sur téléphone, où le reste de la page devient
  inerte.
- **La scène ne tourne que visible.** La boucle de rendu s'arrête quand la
  section sort de l'écran ou que l'onglet passe en arrière-plan.

### Le modèle provisoire

Faute de modèle définitif, `modeles/terminal.glb` est généré par script :
piste, terminal, jetée, tour de contrôle, hangar, parkings, gare, lac, forêts,
champs, nuages, et un avion qui décolle en boucle. 15 800 triangles, 361 Ko.

```bash
cd outils/modele-provisoire
npm install
node generer-terminal.mjs
```

### Replis

- **Mouvements réduits** : pas d'orbite, pas d'animation du décor, déplacements
  de caméra instantanés.
- **Modèle absent ou WebGL indisponible** : un message remplace la vue, et la
  légende ouvre toujours les panneaux.

### Accessibilité

- La légende est la porte d'entrée au clavier et aux lecteurs d'écran : ses
  boutons indiquent l'état du panneau (`aria-expanded`). Les pastilles la
  doublent pour la souris et le doigt, et sont masquées aux lecteurs d'écran.
- À l'ouverture, le focus va au titre du panneau ; à la fermeture, il revient au
  bouton qui l'a ouvert.
- La vue 3D se pilote au clavier, et ses raccourcis sont décrits pour les
  lecteurs d'écran.
- Les boutons à icône ont un nom accessible, affiché aussi en bulle au survol.

## À faire

- [ ] Remplacer le modèle provisoire par le modèle Blender (voir `modeles/LISEZMOI.md`).
- [ ] Ajouter les photos des six points dans `js/donnees/points-interet.js`.
- [ ] Trancher la question du filigrane « Google Earth » (voir Crédits).
- [ ] Auto-héberger la police Inter (aujourd'hui chargée depuis Google Fonts,
      alors que le cahier des charges la demande auto-hébergée).
- [ ] Mesurer avec Lighthouse et consigner le résultat.
- [ ] Tester sur iPhone et sur Android réels.
- [ ] Écrire `CREDITS.md` avec les licences des images.

## Crédits et licences

Les rushes du hero sont un export **Google Earth Studio**. Ils ne sont pas dans
le dépôt, seules les images encodées le sont. Les fournisseurs de données sont
listés dans le fichier `ImagerySources.txt` livré avec l'export : Vexcel
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

Bibliothèques, toutes chargées depuis `js/vendor/` :

| Bibliothèque | Licence |
| --- | --- |
| GSAP 3.13 et ScrollTrigger | licence standard GreenSock, gratuite |
| three.js 0.186 | MIT, texte dans `js/vendor/three/LICENSE` |
| Décodeur Draco (Google) | Apache 2.0 |
| Décodeur Meshopt | MIT |

Le modèle 3D provisoire est produit par script pour ce projet : aucune
ressource tierce.

---

Option WEB · M06 · CPNV
