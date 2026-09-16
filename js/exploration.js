/* =========================================================
   GVA — Exploration 3D : l'interface

   Ce module gère tout ce qui n'est pas la 3D : la légende, les
   pastilles, le panneau d'information, les boutons et le plein
   écran. La scène three.js (exploration-3d.js) n'est importée
   qu'à l'approche de la section.

   Tout reste utilisable sans 3D : la légende ouvre le panneau
   même si le modèle ne charge pas.
   ========================================================= */

import { POINTS } from './donnees/points-interet.js';


/* ---------------------------------------------------------
   1. Éléments et réglages
   --------------------------------------------------------- */

const section = document.querySelector('.exploration');
const scene3d = section.querySelector('.scene3d');
const toile = section.querySelector('.scene3d__toile');
const couchePastilles = section.querySelector('.scene3d__pastilles');
const legende = section.querySelector('.legende');
const panneau = document.getElementById('panneau');
const boitePanneau = panneau.querySelector('.panneau__boite');
const corpsPanneau = panneau.querySelector('.panneau__corps');
const prisePanneau = panneau.querySelector('.panneau__prise');
const titrePanneau = panneau.querySelector('.panneau__titre');
const entete = document.getElementById('entete');

const boutonNoms = document.getElementById('bouton-noms');
const boutonAide = document.getElementById('bouton-aide');
const boutonPleinEcran = document.getElementById('bouton-plein-ecran');
const aide = document.getElementById('scene3d-aide');
const commandes = section.querySelector('.commandes');

const texteEtat = section.querySelector('.chargement__texte');
const pourcentage = section.querySelector('.chargement__pourcentage');

const MOBILE = window.matchMedia('(max-width: 767px)');
const TACTILE = window.matchMedia('(pointer: coarse)').matches;
const REDUIT = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Durées de la maquette, en millisecondes */
const DUREE_FERMETURE = 240;
const DUREE_FERMETURE_FEUILLE = 200;
const DUREE_FONDU = 180;

/* Glisser la feuille de plus de 120 px vers le bas la ferme. */
const SEUIL_GLISSER = 120;

let scene = null;          // interface de la scène 3D, une fois chargée
let pointActif = null;
let declencheur = null;    // bouton de légende à qui rendre le focus
let modeFeuille = false;   // panneau ouvert en feuille modale (téléphone)
let minuterieFermeture = 0;
let ratioVisible = 0;


/* ---------------------------------------------------------
   2. Légende et pastilles, construites depuis les données
   --------------------------------------------------------- */

const pastilles = new Map();
const boutonsLegende = new Map();

function creer(balise, classe, texte) {
  const el = document.createElement(balise);
  if (classe) el.className = classe;
  if (texte !== undefined) el.textContent = texte;
  return el;
}

POINTS.forEach((point, rang) => {
  const bouton = creer('button', 'legende__bouton');
  bouton.type = 'button';
  bouton.dataset.point = point.id;
  bouton.setAttribute('aria-controls', 'panneau');
  bouton.setAttribute('aria-expanded', 'false');
  bouton.append(creer('span', 'legende__numero', point.id), creer('span', 'legende__nom', point.nom));
  const item = creer('li');
  item.append(bouton);
  legende.append(item);
  boutonsLegende.set(point.id, bouton);

  /* Les pastilles doublent la légende pour la souris et le doigt :
     le clavier et les lecteurs d'écran passent par la légende. */
  const pastille = creer('button', 'pastille est-hors-champ');
  pastille.type = 'button';
  pastille.tabIndex = -1;
  pastille.dataset.point = point.id;
  pastille.style.setProperty('--rang', rang);
  pastille.append(creer('span', 'pastille__disque', point.id), creer('span', 'pastille__nom', point.nom));
  couchePastilles.append(pastille);
  pastilles.set(point.id, pastille);
});

function majEtats() {
  pastilles.forEach((el, id) => el.classList.toggle('est-active', id === pointActif));
  boutonsLegende.forEach((el, id) => {
    const actif = id === pointActif;
    el.classList.toggle('est-active', actif);
    el.setAttribute('aria-expanded', String(actif));
  });
}

/* Survoler une ligne de la légende montre le nom de sa pastille. */
function survoler(id) {
  pastilles.forEach((el, cle) => el.classList.toggle('est-survolee', cle === id));
}
const idDepuis = (cible) => {
  const bouton = cible.closest?.('.legende__bouton');
  return bouton ? Number(bouton.dataset.point) : null;
};
legende.addEventListener('pointerover', (e) => survoler(idDepuis(e.target)));
legende.addEventListener('pointerleave', () => survoler(null));
legende.addEventListener('focusin', (e) => survoler(idDepuis(e.target)));
legende.addEventListener('focusout', () => survoler(null));

legende.addEventListener('click', (e) => {
  const bouton = e.target.closest('.legende__bouton');
  if (bouton) basculer(Number(bouton.dataset.point), bouton);
});

couchePastilles.addEventListener('click', (e) => {
  const pastille = e.target.closest('.pastille');
  if (pastille) basculer(Number(pastille.dataset.point), null);
});


/* ---------------------------------------------------------
   3. Le panneau d'information

   C'est un <dialog> :
   - sur ordinateur, ouvert avec show() : non modal, on peut
     cliquer une autre pastille sans le fermer ;
   - sur téléphone, ouvert avec showModal() : feuille du bas,
     le reste de la page est inerte et un tap à côté la ferme.
   --------------------------------------------------------- */

const champ = (selecteur) => panneau.querySelector(selecteur);

function remplir(point) {
  champ('.panneau__numero').textContent = point.id;
  champ('.panneau__zone').textContent = point.zone;
  titrePanneau.textContent = point.nom;
  champ('.panneau__texte').textContent = point.texte;

  const photo = champ('.panneau__photo');
  photo.replaceChildren();
  if (point.photo) {
    const image = new Image();
    image.src = point.photo;
    image.alt = point.legendePhoto;
    image.decoding = 'async';
    photo.append(image);
  } else {
    // Emplacement réservé, comme sur la maquette
    const repere = creer('span', null, `photo — ${point.legendePhoto}`);
    repere.setAttribute('aria-hidden', 'true');
    photo.append(repere);
  }
  photo.classList.toggle('est-vide', !point.photo);

  champ('.panneau__infos').replaceChildren(
    ...point.infos.map(([intitule, valeur]) => {
      const bloc = creer('div');
      bloc.append(creer('dt', null, intitule), creer('dd', null, valeur));
      return bloc;
    })
  );

  const lien = champ('.panneau__lien');
  lien.textContent = point.lien.texte;
  lien.href = point.lien.href;

  corpsPanneau.scrollTop = 0;
}

/* Changement de point sans fermer : fondu de 180 ms. */
function fondu(changer) {
  if (REDUIT) {
    changer();
    return;
  }
  boitePanneau.classList.add('est-en-fondu');
  setTimeout(() => {
    changer();
    boitePanneau.classList.remove('est-en-fondu');
  }, DUREE_FONDU);
}

const panneauVisible = () => panneau.open && !panneau.classList.contains('est-fermant');

function basculer(id, source) {
  masquerAide();
  if (id === pointActif && panneauVisible()) {
    fermer();
  } else {
    ouvrir(id, source);
  }
}

function ouvrir(id, source) {
  const point = POINTS.find((p) => p.id === id);
  if (!point) return;

  const dejaOuvert = panneauVisible();
  declencheur = source;
  pointActif = id;
  majEtats();

  if (dejaOuvert) {
    fondu(() => remplir(point));
  } else {
    remplir(point);
    afficherPanneau();
  }

  scene?.focaliser(id);
  majDecalage();
}

function afficherPanneau() {
  clearTimeout(minuterieFermeture);
  panneau.classList.remove('est-fermant');
  panneau.style.transform = '';

  if (!panneau.open) {
    modeFeuille = MOBILE.matches;
    if (modeFeuille) {
      cadrerPourFeuille();
      panneau.showModal();
    } else {
      panneau.show();
    }
    titrePanneau.focus({ preventScroll: true });
    if (!modeFeuille) cadrerSection();
    panneau.getBoundingClientRect();   // fixe l'état de départ avant la transition
  }

  panneau.classList.add('est-ouvert');
  section.classList.add('exploration--panneau-ouvert');
}

function fermer() {
  if (!panneauVisible()) return;

  const aRendre = declencheur;
  const focusDedans = panneau.contains(document.activeElement);

  panneau.classList.remove('est-ouvert');
  panneau.classList.add('est-fermant');
  panneau.style.transform = '';
  section.classList.remove('exploration--panneau-ouvert');

  pointActif = null;
  declencheur = null;
  majEtats();
  scene?.decaler(0, 0);

  const duree = REDUIT ? 0 : modeFeuille ? DUREE_FERMETURE_FEUILLE : DUREE_FERMETURE;
  minuterieFermeture = setTimeout(() => {
    panneau.classList.remove('est-fermant');
    panneau.close();
    // Le focus revient après close() : tant que la feuille modale
    // est ouverte, le reste de la page est inerte.
    if (aRendre?.isConnected) aRendre.focus({ preventScroll: true });
    else if (focusDedans && panneau.contains(document.activeElement)) document.activeElement.blur();
  }, duree);
}

function fermerSansAnimation() {
  if (!panneau.open) return;
  clearTimeout(minuterieFermeture);
  panneau.classList.remove('est-ouvert', 'est-fermant');
  panneau.style.transform = '';
  panneau.close();
  section.classList.remove('exploration--panneau-ouvert');
  pointActif = null;
  declencheur = null;
  majEtats();
  scene?.decaler(0, 0);
}

panneau.querySelector('.panneau__fermer').addEventListener('click', fermer);

// Échap : natif pour la feuille modale (événement cancel), manuel sinon.
panneau.addEventListener('cancel', (e) => {
  e.preventDefault();
  fermer();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && panneauVisible() && !modeFeuille) fermer();
});

// Tap sur le fond assombri : la cible est alors le <dialog> lui-même.
panneau.addEventListener('click', (e) => {
  if (e.target === panneau) fermer();
});

// « Voir sur le plan » : on ferme et on signale la pastille.
champ('[data-action="voir-sur-plan"]').addEventListener('click', () => {
  const pastille = pastilles.get(pointActif);
  fermer();
  if (!pastille) return;
  pastille.classList.add('est-signalee');
  setTimeout(() => pastille.classList.remove('est-signalee'), 2600);
});

champ('.panneau__lien').addEventListener('click', fermer);

// Passage d'un gabarit à l'autre panneau ouvert : on referme.
MOBILE.addEventListener('change', fermerSansAnimation);


/* ---------------------------------------------------------
   4. Glisser la feuille vers le bas pour la fermer (téléphone)
   --------------------------------------------------------- */

let glisser = null;

prisePanneau.addEventListener('pointerdown', (e) => {
  if (!modeFeuille || e.target.closest('button')) return;
  glisser = { depart: e.clientY, ecart: 0, pointeur: e.pointerId };
  prisePanneau.setPointerCapture(e.pointerId);
  panneau.classList.add('est-glisse');
});

prisePanneau.addEventListener('pointermove', (e) => {
  if (!glisser || e.pointerId !== glisser.pointeur) return;
  glisser.ecart = Math.max(0, e.clientY - glisser.depart);
  panneau.style.transform = `translateY(${glisser.ecart}px)`;
});

function lacher() {
  if (!glisser) return;
  const { ecart } = glisser;
  glisser = null;
  panneau.classList.remove('est-glisse');
  if (ecart > SEUIL_GLISSER) fermer();
  else panneau.style.transform = '';
}
prisePanneau.addEventListener('pointerup', lacher);
prisePanneau.addEventListener('pointercancel', lacher);


/* ---------------------------------------------------------
   5. Cadrage et décalage de la vue
   --------------------------------------------------------- */

const comportement = REDUIT ? 'instant' : 'smooth';

/* Sur ordinateur, le panneau occupe toute la hauteur de la section :
   on aligne la section sous l'en-tête pour que rien ne soit caché. */
function cadrerSection() {
  if (document.fullscreenElement) return;
  const ecart = section.getBoundingClientRect().top - entete.getBoundingClientRect().bottom;
  if (Math.abs(ecart) > 40) window.scrollBy({ top: ecart, behavior: comportement });
}

/* Sur téléphone, la feuille couvre 70 % de l'écran : on remonte la
   vue 3D juste sous l'en-tête pour en garder le haut visible. */
function margeHaute() {
  return entete.getBoundingClientRect().bottom + 8;
}
function cadrerPourFeuille() {
  const ecart = scene3d.getBoundingClientRect().top - margeHaute();
  if (Math.abs(ecart) > 4) window.scrollBy({ top: ecart, behavior: comportement });
}

function positionDans(el, ancetre) {
  let gauche = 0;
  for (let n = el; n && n !== ancetre; n = n.offsetParent) gauche += n.offsetLeft;
  return gauche;
}

/* Le point regardé doit rester au centre de la partie de la vue
   que le panneau ne couvre pas. On calcule les positions finales à
   partir de la mise en page (offset…), que les animations en cours
   ne faussent pas. */
function majDecalage() {
  if (!scene) return;
  if (pointActif === null || !panneauVisible()) {
    scene.decaler(0, 0);
    return;
  }

  if (modeFeuille) {
    const hauteur = toile.clientHeight;
    const haut = margeHaute();
    const bas = Math.min(haut + hauteur, window.innerHeight * 0.3);
    if (bas - haut < 60) {
      scene.decaler(0, hauteur * 0.25);
      return;
    }
    scene.decaler(0, hauteur / 2 - (bas - haut) / 2);
    return;
  }

  const glissement = parseFloat(getComputedStyle(section).getPropertyValue('--glissement-panneau')) || 0;
  const gauche = positionDans(scene3d, section) - glissement;
  const droite = gauche + scene3d.offsetWidth;
  const bordPanneau = section.clientWidth - panneau.offsetWidth;
  const visibleGauche = Math.max(gauche, 0);
  const visibleDroite = Math.min(droite, bordPanneau);
  if (visibleDroite - visibleGauche < 80) {
    scene.decaler(0, 0);
    return;
  }
  scene.decaler((gauche + droite) / 2 - (visibleGauche + visibleDroite) / 2, 0);
}

let minuterieTaille = 0;
window.addEventListener('resize', () => {
  clearTimeout(minuterieTaille);
  minuterieTaille = setTimeout(majDecalage, 120);
});


/* ---------------------------------------------------------
   6. Outils de la vue : noms, aide, plein écran, commandes
   --------------------------------------------------------- */

boutonNoms.addEventListener('click', () => {
  const actif = boutonNoms.getAttribute('aria-pressed') !== 'true';
  boutonNoms.setAttribute('aria-pressed', String(actif));
  scene3d.classList.toggle('scene3d--noms', actif);
});

/* L'aide gestuelle s'efface à la première interaction ; le bouton
   « i » la fait revenir. Les textes s'adaptent au doigt. */
if (TACTILE) {
  aide.querySelectorAll('[data-tactile]').forEach((el) => { el.textContent = el.dataset.tactile; });
}

function montrerAide(oui) {
  aide.classList.toggle('est-masquee', !oui);
  boutonAide.setAttribute('aria-expanded', String(oui));
}
function masquerAide() {
  if (!aide.classList.contains('est-masquee')) montrerAide(false);
}
boutonAide.addEventListener('click', () => montrerAide(aide.classList.contains('est-masquee')));

// Plein écran (préfixe webkit pour Safari sur iPad ; absent sur iPhone)
const pleinEcran = {
  possible: Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled),
  element: () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null,
  entrer: (el) => (el.requestFullscreen ?? el.webkitRequestFullscreen).call(el),
  sortir: () => (document.exitFullscreen ?? document.webkitExitFullscreen).call(document),
};

if (!pleinEcran.possible) boutonPleinEcran.hidden = true;

boutonPleinEcran.addEventListener('click', async () => {
  try {
    if (pleinEcran.element()) await pleinEcran.sortir();
    else await pleinEcran.entrer(section);
  } catch (erreur) {
    console.warn('[GVA 3D] Plein écran refusé :', erreur);
  }
});

function majPleinEcran() {
  const actif = pleinEcran.element() === section;
  section.classList.toggle('exploration--plein-ecran', actif);
  boutonPleinEcran.querySelector('.outil__bulle').textContent = actif ? 'Quitter le plein écran' : 'Plein écran';
  boutonPleinEcran.classList.toggle('est-actif', actif);
  requestAnimationFrame(majDecalage);
}
document.addEventListener('fullscreenchange', majPleinEcran);
document.addEventListener('webkitfullscreenchange', majPleinEcran);

// Barre de commandes sous la vue
const boutonsCommandes = commandes.querySelectorAll('button');
boutonsCommandes.forEach((b) => { b.disabled = true; });

commandes.addEventListener('click', (e) => {
  const bouton = e.target.closest('[data-action]');
  if (!bouton || !scene) return;
  masquerAide();
  switch (bouton.dataset.action) {
    case 'tourner-gauche': scene.tourner(-1); break;
    case 'tourner-droite': scene.tourner(1); break;
    case 'zoom-arriere': scene.zoomer(-1); break;
    case 'zoom-avant': scene.zoomer(1); break;
    case 'reinitialiser':
      fermer();
      scene.reinitialiser();
      break;
  }
});

toile.addEventListener('pointerdown', masquerAide);
toile.addEventListener('wheel', masquerAide, { passive: true });


/* ---------------------------------------------------------
   7. Chargement différé de la scène 3D
   --------------------------------------------------------- */

function webglDisponible() {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

let dernierPalier = -1;
function suivreChargement(etat, progression) {
  if (etat !== 'chargement') return;
  if (progression === null) {
    scene3d.classList.add('scene3d--indetermine');
    pourcentage.textContent = '';
    return;
  }
  scene3d.style.setProperty('--progression', progression.toFixed(3));
  pourcentage.textContent = `${Math.round(progression * 100)} %`;
  // Le lecteur d'écran n'est prévenu que tous les 25 %.
  const palier = Math.floor(progression * 4);
  if (palier !== dernierPalier && palier < 4) {
    dernierPalier = palier;
    texteEtat.textContent = `Chargement de la maquette 3D, ${palier * 25} %`;
  }
}

function signalerEchec(message) {
  scene3d.classList.add('scene3d--echec');
  texteEtat.textContent = message;
  pourcentage.textContent = '';
  pastilles.forEach((el) => el.classList.add('est-absente'));
}

async function chargerScene() {
  if (!webglDisponible()) {
    signalerEchec("La vue 3D n'est pas disponible sur cet appareil. Les points d'intérêt restent consultables dans la liste.");
    return;
  }

  try {
    const { creerScene3D } = await import('./exploration-3d.js');
    scene = await creerScene3D({
      conteneur: scene3d,
      toile,
      modele: scene3d.dataset.modele,
      points: POINTS,
      pastilles,
      surEtat: suivreChargement,
      surInteraction: masquerAide,
      mouvementsReduits: REDUIT,
    });
  } catch (erreur) {
    console.error('[GVA 3D]', erreur);
    signalerEchec("La maquette 3D n'a pas pu être chargée. Les points d'intérêt restent consultables dans la liste.");
    return;
  }

  scene3d.classList.add('scene3d--pret');
  texteEtat.textContent = 'Maquette 3D prête';
  pastilles.forEach((el, id) => el.classList.toggle('est-absente', !scene.connait(id)));
  boutonsCommandes.forEach((b) => { b.disabled = false; });

  scene.definirVisible(ratioVisible > 0);
  scene.definirOrbite(ratioVisible >= 0.3);
  if (pointActif !== null) {
    scene.focaliser(pointActif);
    majDecalage();
  }
}

/* Visibilité : la scène ne tourne que si la section est à l'écran,
   et la caméra n'entre en orbite qu'au-delà de 30 % (maquette). */
new IntersectionObserver((entrees) => {
  const entree = entrees.at(-1);
  ratioVisible = entree.isIntersecting ? entree.intersectionRatio : 0;
  scene?.definirVisible(ratioVisible > 0);
  scene?.definirOrbite(ratioVisible >= 0.3);
}, { threshold: [0, 0.3] }).observe(section);

/* Téléchargement : dès que la section approche de l'écran. */
const approche = new IntersectionObserver((entrees) => {
  if (!entrees.some((e) => e.isIntersecting)) return;
  approche.disconnect();
  chargerScene();
}, { rootMargin: '600px 0px' });
approche.observe(section);
