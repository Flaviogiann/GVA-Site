/* =========================================================
   GVA — Vos vols en temps réel

   Onglets Départs / Arrivées, recherche et tableau, avec une
   mise à jour toutes les 30 secondes (annotations de la maquette).

   Le site n'a pas de vrai système de vols derrière lui : le
   programme de la journée est dans donnees/vols.js, et le statut
   de chaque vol (À l'heure, Embarquement, Parti…) est déduit de
   l'heure de Genève. Pour que le tableau bouge comme un vrai, des
   retards sont en plus annoncés au fil des mises à jour.
   annoncerUnRetard() joue le rôle du serveur : pour brancher une
   API, c'est elle qu'il faudrait remplacer par un fetch.

   ?heure=05:50 dans l'adresse règle l'heure de départ, qui continue
   ensuite de s'écouler. À 05:50, le tableau montre la maquette.
   ========================================================= */

import { DEPARTS, ARRIVEES, COMPAGNIES } from './donnees/vols.js';


/* ---------------------------------------------------------
   1. Éléments et réglages
   --------------------------------------------------------- */

const section = document.getElementById('vols');
const corps = document.getElementById('vols-corps');
const listeOnglets = section.querySelector('.onglets');
const onglets = Array.from(listeOnglets.querySelectorAll('.onglet'));
const indicateur = listeOnglets.querySelector('.onglets__indicateur');
const formulaire = section.querySelector('.recherche');
const champ = document.getElementById('vols-recherche');
const tableau = section.querySelector('.vols__tableau');
const legendeTableau = tableau.querySelector('caption');
const enteteLieu = document.getElementById('vols-colonne-lieu');
const lignes = tableau.querySelector('tbody');
const cartes = section.querySelector('.vols__cartes');
const vide = document.getElementById('vols-vide');
const etat = document.getElementById('vols-etat');
const suite = section.querySelector('.vols__suite');
const boutonSuite = suite.querySelector('button');

const REDUIT = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Durées de la maquette, en millisecondes */
const INTERVALLE = 30000;      // « mise à jour auto · 30 s »
const DELAI_SAISIE = 250;      // le filtre attend la fin de la saisie
const DUREE_FONDU = 180;       // changement d'onglet (CSS : --duree-onglet)

const LIGNES_INITIALES = 6;    // la maquette montre six lignes
const HORIZON = 12 * 60;       // on affiche les 12 prochaines heures
const MEMOIRE_PARTIS = 10;     // un vol parti reste 10 minutes à l'écran
const MIN_EMBARQUEMENT = 30;   // l'embarquement ouvre 30 minutes avant
const MIN_APPROCHE = 20;       // « En approche » 20 minutes avant l'arrivée
const RETARD_MAX = 45;
const PROBA_RETARD = 0.4;      // chance d'annoncer un retard à chaque mise à jour

const TYPES = {
  departs: { libelle: 'Départs', lieu: 'Destination', tous: 'Tous les départs', vols: DEPARTS },
  arrivees: { libelle: 'Arrivées', lieu: 'Provenance', tous: 'Toutes les arrivées', vols: ARRIVEES },
};

let typeActif = 'departs';
let etendu = false;            // « Tous les départs » déplié
let instantane = { departs: [], arrivees: [] };
let minuterieSaisie = 0;
let minuterieFondu = 0;
let minuterieMiseAJour = 0;


/* ---------------------------------------------------------
   2. Les vols et l'horloge

   Le programme est le même chaque jour : un vol est donc
   toujours « le prochain vol de cette heure-là », y compris
   après minuit.
   --------------------------------------------------------- */

function enMinutes(heure) {
  const [h, m] = heure.split(':').map(Number);
  return h * 60 + m;
}

/* Minuscules, sans accents ni ponctuation : « Côte d'Azur » → « cote d azur ». */
function normaliser(texte) {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const vols = [];
Object.entries(TYPES).forEach(([type, config]) => {
  config.vols.forEach((vol) => {
    vols.push({
      ...vol,
      id: `${type}:${vol.vol}`,
      type,
      retard: vol.retard || 0,
      annule: Boolean(vol.annule),
      prevu: enMinutes(vol.heure),
      /* Tout ce que la recherche sait trouver : « lx 348 », « lx348 »,
         « londres », « heathrow », « lhr », « swiss »… */
      recherche: normaliser([
        vol.vol, vol.vol.replace(/\s/g, ''), vol.lieu, vol.court, vol.code,
        COMPAGNIES[vol.vol.slice(0, 2)],
      ].join(' ')),
    });
  });
});

/* L'heure est celle de Genève, où que soit le visiteur. */
const formatGeneve = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function minutesReelles() {
  return enMinutes(formatGeneve.format(new Date()));
}

const heureForcee = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(location.search).get('heure') || '');
const decalage = heureForcee ? Number(heureForcee[1]) * 60 + Number(heureForcee[2]) - minutesReelles() : 0;

function maintenant() {
  return (((minutesReelles() + decalage) % 1440) + 1440) % 1440;
}

/* Minutes qui séparent maintenant de l'heure effective du vol
   (heure prévue + retard), à sa prochaine occurrence : de -10
   (parti depuis 10 minutes) à presque 24 heures. */
function ecartEffectif(vol, minutes) {
  let ecart = vol.prevu + vol.retard - minutes;
  while (ecart < -MEMOIRE_PARTIS) ecart += 1440;
  while (ecart >= 1440 - MEMOIRE_PARTIS) ecart -= 1440;
  return ecart;
}

function statutDe(vol, ecart) {
  let texte = "À l'heure";
  let ton = '';

  if (vol.annule) {
    texte = 'Annulé';
    ton = 'alerte';
  } else if (vol.type === 'departs' && ecart < 0) {
    texte = 'Parti';
  } else if (vol.type === 'departs' && ecart <= MIN_EMBARQUEMENT) {
    texte = 'Embarquement';
    ton = 'actif';
  } else if (vol.type === 'arrivees' && ecart < 0) {
    texte = 'Atterri';
  } else if (vol.type === 'arrivees' && ecart <= MIN_APPROCHE) {
    texte = 'En approche';
    ton = 'actif';
  } else if (vol.retard > 0) {
    texte = `Retard ${vol.retard} min`;
    ton = 'alerte';
  }

  /* Les cartes du téléphone abrègent le retard : « Retard 25′ ». */
  return { texte, court: texte.replace(' min', '′'), ton };
}

/* Les vols à afficher pour un onglet, dans l'ordre des heures prévues. */
function construire(type, minutes) {
  return vols
    .filter((vol) => vol.type === type)
    .map((vol) => {
      const ecart = ecartEffectif(vol, minutes);
      return { vol, ecart, ordre: ecart - vol.retard, statut: statutDe(vol, ecart) };
    })
    .filter((ligne) => ligne.ecart <= HORIZON)
    .sort((a, b) => a.ordre - b.ordre);
}

/* Joue le rôle du serveur : de temps en temps, un vol encore loin
   de l'embarquement voit son retard annoncé ou allongé. */
function annoncerUnRetard() {
  if (Math.random() > PROBA_RETARD) return;

  const minutes = maintenant();
  const candidats = vols.filter((vol) => {
    const ecart = ecartEffectif(vol, minutes);
    return !vol.annule && vol.retard < RETARD_MAX
      && ecart > MIN_EMBARQUEMENT + 10 && ecart <= HORIZON;
  });
  if (!candidats.length) return;

  const vol = candidats[Math.floor(Math.random() * candidats.length)];
  vol.retard = Math.min(RETARD_MAX, vol.retard + 5 * (2 + Math.floor(Math.random() * 4)));
}


/* ---------------------------------------------------------
   3. Affichage

   Le tableau (ordinateur) et les cartes (tablette, téléphone)
   sont construits ensemble depuis les mêmes lignes ; le CSS
   n'en montre qu'un. Ainsi chacun garde sa vraie sémantique.
   --------------------------------------------------------- */

function creer(balise, classe, texte) {
  const el = document.createElement(balise);
  if (classe) el.className = classe;
  if (texte !== undefined) el.textContent = texte;
  return el;
}

function classeStatut(statut) {
  return statut.ton ? ` statut--${statut.ton}` : '';
}

function ligneTableau({ vol, statut }, modifiee) {
  const tr = creer('tr', modifiee ? 'est-modifiee' : '');
  tr.append(
    creer('td', 'ligne__heure', vol.heure),
    creer('td', 'ligne__lieu', vol.lieu),
    creer('td', 'ligne__vol', vol.vol),
    creer('td', 'ligne__porte', vol.porte),
    creer('td', 'ligne__terminal', vol.terminal),
    creer('td', `ligne__statut${classeStatut(statut)}`, statut.texte),
  );
  return tr;
}

function carte({ vol, statut }, modifiee) {
  const texte = creer('div');
  texte.append(
    creer('p', 'carte-vol__titre', `${vol.heure} · ${vol.court} ${vol.code}`),
    creer('p', 'carte-vol__detail', `${vol.vol} · Porte ${vol.porte}`),
  );
  const li = creer('li', modifiee ? 'carte-vol est-modifiee' : 'carte-vol');
  li.append(texte, creer('p', `carte-vol__statut${classeStatut(statut)}`, statut.court));
  return li;
}

function phraseEtat(nombre, filtre) {
  if (nombre === 0) return 'Aucun vol trouvé.';
  const accord = nombre > 1 ? 's' : '';
  return `${TYPES[typeActif].libelle} : ${nombre} vol${accord} ${filtre ? 'trouvé' : 'affiché'}${accord}.`;
}

/* `modifies` : les vols dont une ligne vient de changer, à faire
   clignoter. `annoncer` : dire le résultat aux lecteurs d'écran
   (après une saisie ou un changement d'onglet, pas à chaque mise
   à jour automatique). */
function afficher(modifies = new Set(), annoncer = false) {
  const jetons = normaliser(champ.value).split(' ').filter(Boolean);
  const filtre = jetons.length > 0;

  const trouvees = filtre
    ? instantane[typeActif].filter((ligne) => jetons.every((j) => ligne.vol.recherche.includes(j)))
    : instantane[typeActif];
  const visibles = filtre || etendu ? trouvees : trouvees.slice(0, LIGNES_INITIALES);
  const aucun = visibles.length === 0;

  lignes.replaceChildren(...visibles.map((l) => ligneTableau(l, modifies.has(l.vol.id))));
  cartes.replaceChildren(...visibles.map((l) => carte(l, modifies.has(l.vol.id))));

  tableau.hidden = aucun;
  cartes.hidden = aucun;
  vide.hidden = !aucun;
  vide.textContent = !aucun ? ''
    : filtre ? `Aucun vol ne correspond à « ${champ.value.trim()} ». Vérifiez le numéro, la ville ou la compagnie.`
    : 'Aucun vol à afficher pour le moment.';
  champ.setAttribute('aria-invalid', String(aucun && filtre));

  suite.hidden = filtre || trouvees.length <= LIGNES_INITIALES;
  boutonSuite.textContent = etendu ? 'Réduire la liste' : TYPES[typeActif].tous;

  if (annoncer) etat.textContent = phraseEtat(visibles.length, filtre);
}

/* La « mise à jour » : relit les vols, repère les lignes dont le
   contenu a changé depuis la fois précédente, puis redessine. */
const signatures = new Map();

function actualiser() {
  const minutes = maintenant();
  const modifies = new Set();

  Object.keys(TYPES).forEach((type) => {
    instantane[type] = construire(type, minutes);
    instantane[type].forEach(({ vol, statut }) => {
      const signature = `${vol.heure}|${vol.porte}|${statut.texte}`;
      const avant = signatures.get(vol.id);
      if (avant !== undefined && avant !== signature) modifies.add(vol.id);
      signatures.set(vol.id, signature);
    });
  });

  afficher(modifies);
}

function planifier() {
  clearInterval(minuterieMiseAJour);
  minuterieMiseAJour = setInterval(() => {
    annoncerUnRetard();
    actualiser();
  }, INTERVALLE);
}

/* Inutile de mettre à jour un onglet caché : on rattrape à son retour. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(minuterieMiseAJour);
  } else {
    actualiser();
    planifier();
  }
});


/* ---------------------------------------------------------
   4. Onglets

   Fondu de 180 ms sur le tableau, et un indicateur qui glisse
   (200 ms, voir le CSS) sous l'onglet actif.
   --------------------------------------------------------- */

function majIndicateur() {
  const actif = onglets.find((onglet) => onglet.dataset.type === typeActif);
  indicateur.style.width = `${actif.offsetWidth}px`;
  indicateur.style.transform = `translateX(${actif.offsetLeft}px)`;
}

/* Le premier placement se fait sans glissement. */
majIndicateur();
listeOnglets.getBoundingClientRect();
listeOnglets.classList.add('est-pret');

/* La largeur des onglets change avec l'écran, et avec le chargement de la police. */
new ResizeObserver(majIndicateur).observe(listeOnglets);

function fondu(action) {
  clearTimeout(minuterieFondu);
  if (REDUIT) {
    action();
    return;
  }
  corps.classList.add('est-en-fondu');
  minuterieFondu = setTimeout(() => {
    action();
    corps.classList.remove('est-en-fondu');
  }, DUREE_FONDU / 2);
}

function choisirType(type) {
  if (type === typeActif) return;

  typeActif = type;
  etendu = false;
  onglets.forEach((onglet) => {
    const actif = onglet.dataset.type === type;
    onglet.setAttribute('aria-selected', String(actif));
    onglet.tabIndex = actif ? 0 : -1;
  });
  corps.setAttribute('aria-labelledby', `onglet-${type}`);
  majIndicateur();

  fondu(() => {
    enteteLieu.textContent = TYPES[type].lieu;
    legendeTableau.textContent = `${TYPES[type].libelle}, heure de Genève`;
    cartes.setAttribute('aria-label', TYPES[type].libelle);
    afficher(new Set(), true);
  });
}

listeOnglets.addEventListener('click', (e) => {
  const onglet = e.target.closest('.onglet');
  if (onglet) choisirType(onglet.dataset.type);
});

/* Flèches, Début et Fin déplacent l'onglet actif, comme dans un
   groupe d'onglets natif. */
listeOnglets.addEventListener('keydown', (e) => {
  const rang = onglets.indexOf(document.activeElement);
  if (rang < 0) return;

  let cible = null;
  if (e.key === 'ArrowRight') cible = onglets[(rang + 1) % onglets.length];
  else if (e.key === 'ArrowLeft') cible = onglets[(rang - 1 + onglets.length) % onglets.length];
  else if (e.key === 'Home') cible = onglets[0];
  else if (e.key === 'End') cible = onglets[onglets.length - 1];
  if (!cible) return;

  e.preventDefault();
  cible.focus();
  choisirType(cible.dataset.type);
});


/* ---------------------------------------------------------
   5. Recherche et dépliage de la liste
   --------------------------------------------------------- */

champ.addEventListener('input', () => {
  clearTimeout(minuterieSaisie);
  minuterieSaisie = setTimeout(() => afficher(new Set(), true), DELAI_SAISIE);
});

/* Entrée n'envoie rien, mais applique tout de suite le filtre. */
formulaire.addEventListener('submit', (e) => {
  e.preventDefault();
  clearTimeout(minuterieSaisie);
  afficher(new Set(), true);
});

boutonSuite.addEventListener('click', () => {
  etendu = !etendu;
  afficher(new Set(), true);
});


/* ---------------------------------------------------------
   6. Démarrage
   --------------------------------------------------------- */

actualiser();
planifier();
