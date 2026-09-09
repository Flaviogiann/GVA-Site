/* =========================================================
   GVA — Hero vidéo scrubbée au scroll

   Principe : le plateau du hero reste épinglé à l'écran pendant
   environ 2000 px de défilement. La progression du scroll dans
   cette zone choisit la frame dessinée dans le canvas. Rien ne
   bouge tout seul : l'image n'avance que si l'on défile.

   La séquence est une suite de 120 images AVIF plutôt qu'une
   vidéo : le scrub d'un <video> est irrégulier sur iOS, alors
   qu'un canvas dessine exactement la frame demandée.

   GSAP et ScrollTrigger sont chargés avant ce fichier.
   ========================================================= */

gsap.registerPlugin(ScrollTrigger);


/* ---------------------------------------------------------
   1. Réglages
   --------------------------------------------------------- */

const NB_FRAMES = 120;

/* Distance de scrub, reprise de la frame de spécification de la
   maquette : 2000 px sur ordinateur, 1200 px sur téléphone. */
const SCRUB_BUREAU = 2000;
const SCRUB_MOBILE = 1200;
const SEUIL_MOBILE = 768;

/* Seuils des quatre paliers de titres, en progression du scrub
   (0 → 1). La maquette place les titres à 0, 33, 66 et 100 % ;
   le dernier est avancé à 0.90 pour qu'il ait le temps d'être lu
   avant la bascule. */
const PALIERS = [0, 0.33, 0.66, 0.90];

/* Les deux appels à l'action entrent tout en fin de scrub. */
const SEUIL_ACTIONS = 0.97;

/* Le repère « Scrollez pour découvrir » part dès 40 px de scroll. */
const SEUIL_INDICE = 40;

/* Nombre de frames téléchargées en parallèle. */
const CHARGEMENTS_PARALLELES = 6;


/* ---------------------------------------------------------
   2. Éléments de la page
   --------------------------------------------------------- */

const hero = document.querySelector('.hero');
const plateau = document.querySelector('.hero__plateau');
const canvas = document.querySelector('.hero__canvas');
const barre = document.getElementById('hero-barre');
const indice = document.getElementById('hero-indice');
const entete = document.getElementById('entete');
const paliers = Array.from(document.querySelectorAll('.hero__palier'));

const ctx = canvas.getContext('2d');

const mouvementsReduits =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;


/* ---------------------------------------------------------
   3. Les frames

   Deux jeux d'images sont disponibles : 1920 px de large pour
   l'ordinateur — la résolution native des rushes — et 1080 px
   pour le téléphone. Le jeu est choisi une fois pour toutes au
   chargement ; en changer après coup obligerait à retélécharger
   toute la séquence.
   --------------------------------------------------------- */

const dossier = window.innerWidth < SEUIL_MOBILE
  ? 'images/hero/1080'
  : 'images/hero/1920';

const images = new Array(NB_FRAMES);

/* 0 = pas demandée, 1 = en cours, 2 = prête */
const etats = new Uint8Array(NB_FRAMES);

let indexVoulu = 0;
let derniereDessinee = -1;
let canvasPret = false;

function adresse(i) {
  return dossier + '/' + String(i).padStart(3, '0') + '.avif';
}

/* Renvoie une promesse résolue à true si la frame est utilisable.
   C'est aussi ce qui sert de test de prise en charge de l'AVIF :
   un navigateur qui ne sait pas le lire déclenche onerror. */
function charger(i) {
  return new Promise(function (resoudre) {
    if (etats[i] === 2) return resoudre(true);
    if (etats[i] === 1) return resoudre(false);

    etats[i] = 1;
    const img = new Image();
    img.decoding = 'async';

    img.onload = function () {
      etats[i] = 2;
      images[i] = img;
      /* Une frame qui vient d'arriver peut être meilleure que
         celle affichée : on redessine si elle est plus proche. */
      if (i === indexVoulu || !canvasPret) dessiner();
      resoudre(true);
    };

    img.onerror = function () {
      etats[i] = 0;
      resoudre(false);
    };

    img.src = adresse(i);
  });
}

/* Ordre de téléchargement : d'abord une frame sur 24, puis on
   resserre le pas. Le scrub est donc utilisable très tôt — on
   dessine la frame chargée la plus proche — et la séquence se
   précise à mesure que les images arrivent. */
function ordreDeChargement() {
  const ordre = [];
  const vus = new Set();

  [24, 12, 6, 3, 1].forEach(function (pas) {
    for (let i = 0; i < NB_FRAMES; i += pas) {
      if (!vus.has(i)) {
        vus.add(i);
        ordre.push(i);
      }
    }
  });

  /* La toute dernière frame ferme la séquence : on la veut tôt. */
  if (!vus.has(NB_FRAMES - 1)) ordre.unshift(NB_FRAMES - 1);
  return ordre;
}

function lancerChargement() {
  const file = ordreDeChargement();
  let curseur = 0;

  function ouvrier() {
    if (curseur >= file.length) return Promise.resolve();
    return charger(file[curseur++]).then(ouvrier);
  }

  for (let n = 0; n < CHARGEMENTS_PARALLELES; n++) ouvrier();
}


/* ---------------------------------------------------------
   4. Le dessin
   --------------------------------------------------------- */

/* Tant que toutes les frames ne sont pas là, on affiche la plus
   proche de celle demandée plutôt que de laisser un trou. */
function frameLaPlusProche(i) {
  if (etats[i] === 2) return i;
  for (let d = 1; d < NB_FRAMES; d++) {
    if (i - d >= 0 && etats[i - d] === 2) return i - d;
    if (i + d < NB_FRAMES && etats[i + d] === 2) return i + d;
  }
  return -1;
}

/* Le canvas remplit le plateau en « cover » : on calcule
   l'échelle à la main, drawImage ne connaît pas object-fit. */
function dessiner(forcer) {
  const i = frameLaPlusProche(indexVoulu);
  if (i < 0) return;
  if (i === derniereDessinee && !forcer) return;

  const img = images[i];
  const largeurCanvas = canvas.width;
  const hauteurCanvas = canvas.height;

  const echelle = Math.max(
    largeurCanvas / img.naturalWidth,
    hauteurCanvas / img.naturalHeight
  );
  const largeur = img.naturalWidth * echelle;
  const hauteur = img.naturalHeight * echelle;

  ctx.drawImage(
    img,
    (largeurCanvas - largeur) / 2,
    (hauteurCanvas - hauteur) / 2,
    largeur,
    hauteur
  );

  derniereDessinee = i;

  if (!canvasPret) {
    canvasPret = true;
    hero.classList.add('hero--canvas-pret');
  }
}

/* On dessine à la résolution réelle de l'écran, plafonnée à 2 :
   au-delà, le gain est invisible et la mémoire double. */
function dimensionnerCanvas() {
  const densite = Math.min(window.devicePixelRatio || 1, 2);
  const largeur = Math.round(plateau.clientWidth * densite);
  const hauteur = Math.round(plateau.clientHeight * densite);

  if (canvas.width === largeur && canvas.height === hauteur) return;

  canvas.width = largeur;
  canvas.height = hauteur;
  dessiner(true);
}


/* ---------------------------------------------------------
   5. Les états du hero pendant le scrub
   --------------------------------------------------------- */

let palierActif = -1;

function majPalier(progression) {
  let actif = 0;
  for (let i = 0; i < PALIERS.length; i++) {
    if (progression >= PALIERS[i]) actif = i;
  }
  if (actif === palierActif) return;

  palierActif = actif;
  paliers.forEach(function (el, i) {
    el.classList.toggle('est-actif', i === actif);
  });
}

/* scaleX plutôt que width : la propriété est prise en charge par
   le compositeur, l'animation ne relance pas la mise en page. */
function majProgression(progression) {
  barre.style.transform = 'scaleX(' + progression + ')';
}

function majIndice() {
  indice.classList.toggle('est-masque', window.scrollY > SEUIL_INDICE);
}

function distanceScrub() {
  return window.innerWidth < SEUIL_MOBILE ? SCRUB_MOBILE : SCRUB_BUREAU;
}


/* ---------------------------------------------------------
   6. Le scrub
   --------------------------------------------------------- */

function demarrerScrub() {
  /* L'objet animé ne sert qu'à porter un numéro de frame : c'est
     GSAP qui le fait avancer, et onUpdate qui le lit. */
  const sequence = { index: 0 };

  gsap.to(sequence, {
    index: NB_FRAMES - 1,
    ease: 'none',

    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: function () { return '+=' + distanceScrub(); },
      pin: plateau,
      /* scrub: true = la timeline suit exactement la barre de
         défilement, sans retard ni interpolation. */
      scrub: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,

      onUpdate: function (self) {
        majProgression(self.progress);
        majPalier(self.progress);
        hero.classList.toggle('hero--fin', self.progress >= SEUIL_ACTIONS);
      },

      /* La barre de navigation ne passe en fond blanc qu'une fois
         le scrub terminé et le plateau désépinglé. */
      onLeave: function () { entete.classList.add('entete--solide'); },
      onEnterBack: function () { entete.classList.remove('entete--solide'); }
    },

    onUpdate: function () {
      const i = Math.min(NB_FRAMES - 1, Math.max(0, Math.round(sequence.index)));
      if (i === indexVoulu) return;

      indexVoulu = i;
      charger(i);   /* la frame regardée passe devant la file */
      dessiner();
    }
  });

  window.addEventListener('scroll', majIndice, { passive: true });
  majIndice();

  ScrollTrigger.addEventListener('refresh', dimensionnerCanvas);
  window.addEventListener('resize', dimensionnerCanvas);
}


/* ---------------------------------------------------------
   7. Le repli sans scrub

   Deux cas : les mouvements réduits sont demandés, ou les frames
   ne se chargent pas. Le hero devient alors une section normale
   avec une image fixe, comme le prévoit la maquette.
   --------------------------------------------------------- */

function modeFige(indexPalier) {
  hero.classList.add('hero--statique');
  hero.classList.toggle('hero--fin', indexPalier === paliers.length - 1);

  palierActif = indexPalier;
  paliers.forEach(function (el, i) {
    el.classList.toggle('est-actif', i === indexPalier);
  });

  /* Sans ScrollTrigger, on surveille nous-mêmes la sortie du hero
     pour poser le fond blanc de la barre de navigation. */
  function majEntete() {
    const passe = window.scrollY > plateau.clientHeight - 88;
    entete.classList.toggle('entete--solide', passe);
  }
  window.addEventListener('scroll', majEntete, { passive: true });
  majEntete();
}


/* ---------------------------------------------------------
   8. Démarrage
   --------------------------------------------------------- */

function demarrer() {
  dimensionnerCanvas();

  /* La première frame sert de test : si elle ne charge pas, le
     navigateur ne lit pas l'AVIF et on garde l'affiche. */
  charger(0).then(function (ok) {
    if (!ok) {
      modeFige(0);
      return;
    }

    if (mouvementsReduits) {
      /* La maquette demande une image fixe et le titre final. */
      return charger(NB_FRAMES - 1).then(function (finOk) {
        indexVoulu = finOk ? NB_FRAMES - 1 : 0;
        dessiner(true);
        modeFige(finOk ? paliers.length - 1 : 0);
      });
    }

    dessiner(true);
    demarrerScrub();
    lancerChargement();
  });
}

demarrer();


/* ---------------------------------------------------------
   9. Menu mobile
   --------------------------------------------------------- */

const burger = document.querySelector('.burger');
const navPrincipale = document.getElementById('nav-principale');

burger.addEventListener('click', function () {
  const ouvert = burger.getAttribute('aria-expanded') === 'true';
  burger.setAttribute('aria-expanded', String(!ouvert));
  burger.setAttribute('aria-label', ouvert ? 'Ouvrir le menu' : 'Fermer le menu');
  navPrincipale.classList.toggle('est-ouverte', !ouvert);
});

/* Un lien choisi referme le panneau. */
navPrincipale.addEventListener('click', function (e) {
  if (e.target.closest('a')) {
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Ouvrir le menu');
    navPrincipale.classList.remove('est-ouverte');
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && navPrincipale.classList.contains('est-ouverte')) {
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Ouvrir le menu');
    navPrincipale.classList.remove('est-ouverte');
    burger.focus();
  }
});
