/* =========================================================
   Génère le modèle 3D PROVISOIRE de l'aéroport : modeles/terminal.glb

   C'est un diorama low-poly posé sur une île flottante : piste,
   terminal, jetée, tour de contrôle, hangar, parkings, gare, lac,
   forêts et champs. Il sert à faire tourner la section 2 en
   attendant le vrai modèle, réalisé dans Blender.

   Le fichier produit respecte les conventions attendues par le site
   (voir modeles/LISEZMOI.md) :
   - des nœuds vides « pastille-1 » à « pastille-6 » placent les points
     d'intérêt ;
   - un nœud vide « vue-5 » impose le cadrage de la caméra pour le point 5 ;
   - toutes les animations du fichier tournent en boucle ;
   - la géométrie n'a pas de normales : le chargeur de three.js passe
     alors en ombrage plat, ce qui donne le rendu à facettes.

   Usage :
     cd outils/modele-provisoire
     npm install
     node generer-terminal.mjs            (écrit ../../modeles/terminal.glb)
     node generer-terminal.mjs sortie.glb
   ========================================================= */

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

/* GLTFExporter lit ses données avec FileReader, absent de Node. */
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

const SORTIE = path.resolve(
  process.argv[2] ?? path.join(import.meta.dirname, '../../modeles/terminal.glb')
);


/* ---------------------------------------------------------
   1. Outils
   --------------------------------------------------------- */

/* Générateur pseudo-aléatoire à graine : le modèle est identique à
   chaque exécution. */
function aleatoire(graine) {
  return function () {
    graine = (graine + 0x6d2b79f5) | 0;
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hasard = aleatoire(1920);
const entre = (a, b) => a + hasard() * (b - a);
const choisir = (liste) => liste[Math.floor(hasard() * liste.length)];

const C = {
  herbe: '#6caa4c', herbeFonce: '#5e9b43',
  terre: '#8b5e3c', roche: '#6e4c36', rocheFonce: '#523a2c', rocheGrise: '#8f949b',
  beton: '#aeb5bd', asphalte: '#474e57', route: '#5a616a', taxiway: '#5f666e',
  marquage: '#f4f6f8', jaune: '#e8c33a', trottoir: '#c9ced4',
  facade: '#eef1f5', toit: '#d3dae2', vitre: '#86b9e3', vitreFonce: '#3e6a96',
  passerelle: '#c6cdd6', hangar: '#bcc5cf', hangarToit: '#8e99a6', porte: '#56606c',
  bleuNuit: '#0b1f3a', accent: '#e4002b', bleuQueue: '#2e7bbf', moteur: '#a9b1ba',
  train: '#f2f4f7', rail: '#6b7280', traverse: '#7a5a44', poteau: '#9aa2ab',
  tronc: '#7a5236',
  sapins: ['#2f6b3f', '#3a7a45', '#2c5f3a', '#356f40'],
  feuillus: ['#4f9150', '#5fa55a', '#468246', '#77a84e'],
  champs: ['#d9c46a', '#9cc766', '#b58a57', '#c3d27a', '#e0cf86'],
  eau: '#4f94d4', rive: '#cbbb8e',
  voitures: ['#e4002b', '#f7f8fa', '#0b1f3a', '#9aa3ad', '#f2c14e', '#2e7bbf', '#3d4a5c'],
  nuage: '#ffffff',
};

/* Toutes les pièces sont construites avec des Mesh ordinaires, puis
   « cuites » : couleur écrite dans les sommets, transformation
   appliquée, et fusion en une seule géométrie. */
const MATIERE_TEMP = new THREE.MeshBasicMaterial();

function piece(geo, couleur) {
  const m = new THREE.Mesh(geo, MATIERE_TEMP);
  m.userData.couleur = couleur;
  return m;
}

/* Boîte posée au sol : y désigne la base, pas le centre. */
function boite(l, h, p, couleur, x = 0, y = 0, z = 0) {
  const m = piece(new THREE.BoxGeometry(l, h, p), couleur);
  m.position.set(x, y + h / 2, z);
  return m;
}

function cylindre(rHaut, rBas, h, couleur, x = 0, y = 0, z = 0, segments = 8) {
  const m = piece(new THREE.CylinderGeometry(rHaut, rBas, h, segments), couleur);
  m.position.set(x, y + h / 2, z);
  return m;
}

/* Surface plate (forme 2D couchée sur le sol), face vers le haut. */
function aplat(forme, couleur, y, segments = 12) {
  const geo = new THREE.ShapeGeometry(forme, segments);
  geo.rotateX(-Math.PI / 2);
  const m = piece(geo, couleur);
  m.position.y = y;
  return m;
}

function rectangleArrondi(l, p, r) {
  const s = new THREE.Shape();
  const x = -l / 2, z = -p / 2;
  s.moveTo(x + r, z);
  s.lineTo(x + l - r, z);
  s.quadraticCurveTo(x + l, z, x + l, z + r);
  s.lineTo(x + l, z + p - r);
  s.quadraticCurveTo(x + l, z + p, x + l - r, z + p);
  s.lineTo(x + r, z + p);
  s.quadraticCurveTo(x, z + p, x, z + p - r);
  s.lineTo(x, z + r);
  s.quadraticCurveTo(x, z, x + r, z);
  return s;
}

function ellipse(rx, rz) {
  const s = new THREE.Shape();
  s.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
  return s;
}

function colorer(geo, couleur) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  if (g.attributes.color) return g;   // couleurs déjà écrites (île)

  const c = new THREE.Color(couleur);
  const n = g.attributes.position.count;
  const tab = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    tab[i * 3] = c.r;
    tab[i * 3 + 1] = c.g;
    tab[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(tab, 3));
  return g;
}

/* Fusionne tous les Mesh d'un groupe en une géométrie, exprimée dans
   le repère de ce groupe. */
function cuire(racine) {
  racine.updateMatrixWorld(true);
  const inverse = racine.matrixWorld.clone().invert();
  const geos = [];
  racine.traverse((o) => {
    if (!o.isMesh) return;
    const g = colorer(o.geometry, o.userData.couleur);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
    geos.push(g);
  });
  return mergeVertices(mergeGeometries(geos, false), 1e-4);
}


/* ---------------------------------------------------------
   2. L'île
   --------------------------------------------------------- */

const RX = 14;    // demi-largeur de l'île
const RZ = 11.5;  // demi-profondeur

function dansIle(x, z, marge = 1) {
  return (x / (RX * marge)) ** 2 + (z / (RZ * marge)) ** 2 < 1;
}

function ile() {
  const N = 34;
  const base = Array.from({ length: N }, () => 1 + entre(-0.03, 0.03));
  const anneaux = [
    { y: 0, f: 1, bruit: 0 },
    { y: -0.6, f: 1, bruit: 0 },      // bande de terre verticale
    { y: -1.8, f: 0.86, bruit: 0.05 },
    { y: -3.2, f: 0.55, bruit: 0.08 },
  ];
  const pts = anneaux.map((a) =>
    base.map((r0, i) => {
      const ang = (i / N) * Math.PI * 2;
      const r = r0 * a.f * (1 + entre(-a.bruit, a.bruit));
      const dy = a.bruit ? entre(-0.25, 0.25) : 0;
      return new THREE.Vector3(Math.cos(ang) * RX * r, a.y + dy, Math.sin(ang) * RZ * r);
    })
  );
  const pointe = new THREE.Vector3(entre(-0.8, 0.8), -4.6, entre(-0.8, 0.8));
  const centre = new THREE.Vector3(0, 0, 0);

  const positions = [];
  const couleurs = [];
  const tri = (a, b, c, couleur) => {
    const col = new THREE.Color(couleur).offsetHSL(0, 0, entre(-0.02, 0.02));
    for (const p of [a, b, c]) {
      positions.push(p.x, p.y, p.z);
      couleurs.push(col.r, col.g, col.b);
    }
  };

  const bandes = [C.terre, C.roche, C.rocheFonce];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    tri(centre, pts[0][j], pts[0][i], i % 2 ? C.herbe : C.herbeFonce);
    for (let k = 0; k < 3; k++) {
      const a = pts[k][i], c = pts[k][j], b = pts[k + 1][i], d = pts[k + 1][j];
      tri(a, c, b, bandes[k]);
      tri(c, d, b, bandes[k]);
    }
    tri(pts[3][i], pts[3][j], pointe, C.rocheFonce);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
  return piece(geo, null);
}


/* ---------------------------------------------------------
   3. Les bâtiments et les véhicules
   --------------------------------------------------------- */

/* Avion de ligne, nez vers +X, posé au sol. */
function avion(couleurQueue, couleurBande = null) {
  const g = new THREE.Group();

  const corps = piece(new THREE.CylinderGeometry(0.3, 0.3, 3.2, 10), C.facade);
  corps.rotation.z = Math.PI / 2;
  corps.position.set(0, 0.62, 0);

  const nez = piece(new THREE.ConeGeometry(0.3, 0.7, 10), C.facade);
  nez.rotation.z = -Math.PI / 2;
  nez.position.set(1.95, 0.62, 0);

  const arriere = piece(new THREE.ConeGeometry(0.3, 0.9, 10), C.facade);
  arriere.rotation.z = Math.PI / 2;
  arriere.position.set(-2.05, 0.66, 0);

  const cockpit = boite(0.22, 0.09, 0.36, C.bleuNuit, 1.9, 0.74, 0);
  cockpit.rotation.z = -0.35;

  const derive = piece(new THREE.BoxGeometry(0.75, 0.85, 0.06), couleurQueue);
  derive.position.set(-2.0, 1.12, 0);
  derive.rotation.z = 0.45;

  g.add(corps, nez, arriere, cockpit, derive);
  g.add(boite(0.08, 0.34, 0.08, C.porte, 1.45, 0, 0));

  for (const s of [-1, 1]) {
    const aile = piece(new THREE.BoxGeometry(0.95, 0.06, 2.1), C.facade);
    aile.position.set(-0.15, 0.5, s * 1.2);
    aile.rotation.y = -s * 0.38;

    const moteur = piece(new THREE.CylinderGeometry(0.15, 0.13, 0.62, 8), C.moteur);
    moteur.rotation.z = Math.PI / 2;
    moteur.position.set(0.25, 0.36, s * 0.95);

    const stab = piece(new THREE.BoxGeometry(0.45, 0.04, 0.8), C.facade);
    stab.position.set(-2.05, 0.72, s * 0.42);
    stab.rotation.y = -s * 0.4;

    g.add(aile, moteur, stab, boite(0.12, 0.34, 0.1, C.porte, -0.2, 0, s * 0.3));
  }

  if (couleurBande) g.add(boite(3.0, 0.07, 0.63, couleurBande, -0.1, 0.49, 0));
  g.scale.setScalar(0.7);
  return g;
}

function voiture(couleur) {
  const g = new THREE.Group();
  g.add(
    boite(0.36, 0.1, 0.18, couleur, 0, 0.03, 0),
    boite(0.2, 0.08, 0.16, C.vitreFonce, -0.02, 0.13, 0),
    boite(0.17, 0.025, 0.15, couleur, -0.02, 0.21, 0)
  );
  return g;
}

function bus() {
  const g = new THREE.Group();
  g.add(
    boite(0.95, 0.26, 0.24, C.accent, 0, 0.03, 0),
    boite(0.97, 0.08, 0.245, C.vitreFonce, 0, 0.16, 0),
    boite(0.9, 0.03, 0.2, C.facade, 0, 0.29, 0)
  );
  return g;
}

function sapin(echelle) {
  const g = new THREE.Group();
  const couleur = choisir(C.sapins);
  g.add(cylindre(0.06, 0.08, 0.3, C.tronc, 0, 0, 0, 6));
  [[0.46, 0.25], [0.36, 0.55], [0.25, 0.83]].forEach(([r, y]) => {
    g.add(cylindre(0, r, 0.6, couleur, 0, y, 0, 7));
  });
  g.scale.setScalar(echelle);
  g.rotation.y = entre(0, Math.PI);
  return g;
}

function feuillu(echelle) {
  const g = new THREE.Group();
  g.add(cylindre(0.05, 0.07, 0.35, C.tronc, 0, 0, 0, 6));
  const houppier = piece(new THREE.IcosahedronGeometry(0.42, 0), choisir(C.feuillus));
  houppier.position.y = 0.68;
  houppier.scale.set(1, entre(0.85, 1.15), 1);
  houppier.rotation.set(entre(0, 1), entre(0, 3), 0);
  g.add(houppier);
  g.scale.setScalar(echelle);
  return g;
}

function rocher() {
  const m = piece(new THREE.DodecahedronGeometry(entre(0.15, 0.32), 0), C.rocheGrise);
  m.scale.set(1, entre(0.5, 0.8), entre(0.8, 1.2));
  m.rotation.set(entre(0, 3), entre(0, 3), entre(0, 3));
  return m;
}

function nuage() {
  const g = new THREE.Group();
  const n = 3 + Math.floor(hasard() * 3);
  for (let i = 0; i < n; i++) {
    const r = entre(0.45, 0.85);
    const b = piece(new THREE.IcosahedronGeometry(r, 0), C.nuage);
    b.position.set((i - (n - 1) / 2) * 0.7, entre(-0.1, 0.25), entre(-0.25, 0.25));
    b.scale.y = 0.72;
    g.add(b);
  }
  return g;
}


/* ---------------------------------------------------------
   4. La scène
   Tout ce qui touche à l'aéroport est construit dans le repère de
   la piste, puis tourné de −6° pour casser l'alignement.
   --------------------------------------------------------- */

const ROTATION_AEROPORT = THREE.MathUtils.degToRad(-6);

const statique = new THREE.Group();          // sera cuit en un seul mesh
const aeroportStatique = new THREE.Group();  // idem, dans le repère de la piste
aeroportStatique.rotation.y = ROTATION_AEROPORT;
statique.add(ile(), aeroportStatique);

const A = aeroportStatique;
const Z_PISTE = -5.4;

/* Zones où l'on ne plante pas d'arbre, dans le repère de la piste :
   [xmin, xmax, zmin, zmax] */
const zonesInterdites = [];
const interdire = (x1, x2, z1, z2) => zonesInterdites.push([x1, x2, z1, z2]);

// --- Piste 05/23
A.add(boite(18.5, 0.03, 1.3, C.asphalte, -1, 0, Z_PISTE));
for (const s of [-1, 1]) A.add(boite(18.2, 0.006, 0.05, C.marquage, -1, 0.03, Z_PISTE + s * 0.56));
for (let x = -8.6; x <= 6.6; x += 1.1) A.add(boite(0.55, 0.006, 0.06, C.marquage, x, 0.03, Z_PISTE));
for (const bout of [-9.85, 7.85]) {
  for (let k = -3; k <= 3; k++) A.add(boite(0.7, 0.006, 0.07, C.marquage, bout, 0.03, Z_PISTE + k * 0.15));
}
for (const x of [-7.6, 5.6]) {
  for (const s of [-1, 1]) A.add(boite(0.9, 0.006, 0.13, C.marquage, x, 0.03, Z_PISTE + s * 0.3));
}
interdire(-11, 9, -6.9, -3.9);

// --- Taxiway et bretelles
A.add(boite(15, 0.026, 0.5, C.taxiway, -1, 0, -3.4));
A.add(boite(15, 0.006, 0.04, C.jaune, -1, 0.026, -3.4));
for (const x of [-7.5, 5.5]) A.add(boite(0.5, 0.026, 1.5, C.taxiway, x, 0, -4.35));
for (const x of [-3.2, 3.8]) A.add(boite(0.5, 0.026, 0.5, C.taxiway, x, 0, -2.95));

// --- Tarmac
const tarmac = aplat(rectangleArrondi(18, 4.6, 0.8), C.beton, 0.02);
tarmac.position.set(-1.4, 0.02, -0.6);
A.add(tarmac);
interdire(-11, 8.2, -3.9, 1.9);

// --- Terminal (x de −6 à 3)
const TX = -1.5;
A.add(
  boite(9, 1.05, 1.7, C.facade, TX, 0, 2.5),
  boite(8.6, 0.42, 0.04, C.vitre, TX, 0.3, 3.36),
  boite(8.6, 0.42, 0.04, C.vitre, TX, 0.3, 1.64),
  boite(9.5, 0.12, 2.1, C.toit, TX, 1.05, 2.5),
  boite(7.2, 0.05, 0.5, C.vitre, TX - 0.2, 1.17, 2.5)
);
// portes du hall
for (const x of [-4.6, -3.2, -1.8]) A.add(boite(0.5, 0.36, 0.05, C.vitreFonce, x, 0, 3.38));
// auvent de la dépose-minute et ses colonnes
A.add(boite(5.2, 0.07, 0.95, C.toit, -2.2, 0.82, 3.82));
for (let x = -4.5; x <= 0.2; x += 1.55) A.add(cylindre(0.04, 0.04, 0.82, C.poteau, x, 0, 4.2, 6));
// salons, à l'étage, sur l'aile est
A.add(
  boite(2.1, 0.55, 1.2, C.facade, 1.9, 1.17, 2.5),
  boite(2.14, 0.28, 1.24, C.vitre, 1.9, 1.3, 2.5),
  boite(2.35, 0.07, 1.42, C.toit, 1.9, 1.72, 2.5)
);
interdire(-6.7, 3.9, 1.5, 4.7);

// --- Jetée (x = 1.8) et passerelles
A.add(
  boite(1.0, 0.78, 3.8, C.facade, 1.8, 0, -0.25),
  boite(0.04, 0.3, 3.6, C.vitre, 1.29, 0.32, -0.25),
  boite(0.04, 0.3, 3.6, C.vitre, 2.31, 0.32, -0.25),
  boite(1.2, 0.08, 4.0, C.toit, 1.8, 0.78, -0.25)
);
const passerelle = (x1, x2, z) => {
  A.add(boite(Math.abs(x2 - x1), 0.26, 0.28, C.passerelle, (x1 + x2) / 2, 0.36, z));
  A.add(cylindre(0.05, 0.05, 0.36, C.poteau, x2, 0, z, 6));
};
passerelle(2.3, 3.55, -1.7);
passerelle(2.3, 3.55, 1.1);
passerelle(1.3, 0.15, -0.8);

// --- Avions au contact et au large
const avionsParques = [
  { x: 5.2, z: -1.7, cap: Math.PI, queue: C.bleuNuit },
  { x: 5.2, z: 1.1, cap: Math.PI, queue: C.bleuQueue, bande: C.accent },
  { x: -1.55, z: -0.8, cap: 0, queue: C.bleuNuit, bande: C.bleuQueue },
  { x: -5.8, z: -1.5, cap: 0.35, queue: C.accent },
];
for (const p of avionsParques) {
  const av = avion(p.queue, p.bande);
  av.position.set(p.x, 0.02, p.z);
  av.rotation.y = p.cap;
  A.add(av);
}
// lignes de guidage au sol
for (const z of [-1.7, 1.1]) A.add(boite(3.2, 0.004, 0.035, C.jaune, 5.0, 0.021, z));
A.add(boite(3.0, 0.004, 0.035, C.jaune, -1.4, 0.021, -0.8));
// véhicules de piste
[[4.1, -0.3], [6.4, -0.3], [0.4, 0.5], [-4.2, -0.2]].forEach(([x, z]) => {
  const v = voiture(choisir([C.jaune, C.facade, C.accent]));
  v.position.set(x, 0.02, z);
  v.rotation.y = entre(0, Math.PI);
  A.add(v);
});

// --- Hangar
A.add(
  boite(2.3, 0.9, 1.9, C.hangar, -9.1, 0.02, -0.4),
  boite(0.04, 0.72, 1.5, C.porte, -7.93, 0.02, -0.4)
);
const voute = piece(new THREE.CylinderGeometry(0.95, 0.95, 2.3, 12, 1, false, 0, Math.PI), C.hangarToit);
voute.rotation.set(0, 0, Math.PI / 2);
voute.scale.set(1, 1, 0.5);
voute.position.set(-9.1, 0.92, -0.4);
A.add(voute);

// --- Tour de contrôle
const TOUR = { x: -7.0, z: 2.9 };
A.add(
  boite(1.1, 0.45, 0.8, C.facade, TOUR.x, 0, TOUR.z),
  cylindre(0.18, 0.27, 3.1, C.facade, TOUR.x, 0.45, TOUR.z),
  cylindre(0.42, 0.42, 0.06, C.facade, TOUR.x, 3.4, TOUR.z, 10),
  cylindre(0.5, 0.36, 0.46, C.vitre, TOUR.x, 3.46, TOUR.z, 10),
  cylindre(0.56, 0.56, 0.08, C.bleuNuit, TOUR.x, 3.92, TOUR.z, 10),
  cylindre(0.02, 0.02, 0.6, C.poteau, TOUR.x, 4.0, TOUR.z, 4)
);
interdire(-7.8, -6.2, 2.2, 3.6);

// --- Routes
A.add(
  boite(9.6, 0.026, 0.9, C.route, -1.4, 0, 4.05),       // dépose-minute
  boite(9.6, 0.03, 0.22, C.trottoir, -1.4, 0, 3.49),
  boite(0.8, 0.026, 1.2, C.route, 3.75, 0, 4.9),         // bretelle
  boite(19.4, 0.026, 1.1, C.route, 0.2, 0, 5.6)          // autoroute A1
);
for (let x = -9; x <= 9.4; x += 0.9) A.add(boite(0.4, 0.005, 0.04, C.marquage, x, 0.026, 5.6));
interdire(-10, 10.4, 4.7, 6.3);

// --- Parking P1, sur trois niveaux
const P1 = { x: -3.6, z: 7.3 };
for (const [i, y] of [0, 0.45, 0.9, 1.35].entries()) {
  A.add(boite(3.2, 0.1, 2.0, i ? C.trottoir : C.beton, P1.x, y, P1.z));
}
for (const dx of [-1.45, 1.45]) {
  for (const dz of [-0.85, 0.85]) A.add(cylindre(0.06, 0.06, 1.35, C.poteau, P1.x + dx, 0, P1.z + dz, 6));
}
for (let i = 0; i < 12; i++) {
  if (hasard() < 0.25) continue;
  const v = voiture(choisir(C.voitures));
  v.position.set(P1.x - 1.2 + (i % 6) * 0.48, 1.45, P1.z + (i < 6 ? -0.45 : 0.45));
  v.rotation.y = Math.PI / 2;
  A.add(v);
}
A.add(boite(0.7, 0.026, 0.6, C.route, P1.x, 0, 6.3));
interdire(-5.6, -1.6, 6.0, 8.6);

// --- Parking P26, en surface
const P26 = { x: 2.6, z: 7.4 };
A.add(boite(5.2, 0.02, 2.4, C.route, P26.x, 0, P26.z));
for (const zr of [-0.55, 0.55]) {
  for (let k = 0; k <= 10; k++) {
    A.add(boite(0.03, 0.004, 0.7, C.marquage, P26.x - 2.3 + k * 0.46, 0.02, P26.z + zr));
  }
  for (let k = 0; k < 10; k++) {
    if (hasard() < 0.3) continue;
    const v = voiture(choisir(C.voitures));
    v.position.set(P26.x - 2.07 + k * 0.46, 0.02, P26.z + zr);
    v.rotation.y = Math.PI / 2;
    A.add(v);
  }
}
A.add(boite(0.7, 0.026, 0.6, C.route, P26.x, 0, 6.3));
interdire(-0.3, 5.5, 5.9, 8.9);

// --- Gare et voie ferrée
A.add(
  boite(1.4, 0.5, 0.9, C.facade, -8.6, 0, 4.2),
  boite(1.7, 0.06, 1.2, C.toit, -8.6, 0.5, 4.2),
  boite(0.9, 0.3, 0.04, C.vitreFonce, -8.6, 0, 4.66)
);
interdire(-9.6, -7.6, 3.4, 5.0);
for (const dz of [-0.13, 0.13]) A.add(boite(4.4, 0.03, 0.03, C.rail, -8.0, 0.02, 6.95 + dz));
for (let x = -10.1; x <= -5.9; x += 0.3) A.add(boite(0.08, 0.02, 0.38, C.traverse, x, 0, 6.95));
for (const x of [-8.9, -7.05]) {
  A.add(
    boite(1.75, 0.42, 0.36, C.train, x, 0.05, 6.95),
    boite(1.77, 0.12, 0.365, C.vitreFonce, x, 0.26, 6.95),
    boite(1.77, 0.04, 0.365, C.accent, x, 0.12, 6.95)
  );
}
interdire(-10.8, -5.6, 6.4, 7.5);

// --- Champs au nord de la piste
const champs = [];
for (let x = -7.4; x <= 6.2; x += entre(2.2, 2.8)) {
  const l = entre(1.7, 2.3);
  const p = entre(1.2, 1.8);
  const z = entre(-8.2, -7.8);
  const coins = [[x - l / 2, z - p / 2], [x + l / 2, z - p / 2], [x - l / 2, z + p / 2], [x + l / 2, z + p / 2]];
  const monde = coins.map(([cx, cz]) => new THREE.Vector3(cx, 0, cz).applyAxisAngle(new THREE.Vector3(0, 1, 0), ROTATION_AEROPORT));
  if (!monde.every((v) => dansIle(v.x, v.z, 0.88))) continue;
  const couleur = choisir(C.champs);
  A.add(boite(l, 0.008, p, couleur, x, 0, z));
  // sillons
  for (let k = -p / 2 + 0.2; k < p / 2 - 0.1; k += 0.3) {
    A.add(boite(l - 0.1, 0.006, 0.04, new THREE.Color(couleur).offsetHSL(0, 0, -0.06), x, 0.008, z + k));
  }
  champs.push([x - l / 2 - 0.2, x + l / 2 + 0.2, z - p / 2 - 0.2, z + p / 2 + 0.2]);
}
champs.forEach((c) => interdire(...c));

// --- Lac, à l'est (repère de l'île)
const LAC = { x: 10.6, z: 0.6, rx: 2.2, rz: 1.6 };
const rive = aplat(ellipse(LAC.rx + 0.3, LAC.rz + 0.28), C.rive, 0.006, 24);
rive.position.set(LAC.x, 0.006, LAC.z);
statique.add(rive);

// --- Arbres et rochers
statique.updateMatrixWorld(true);
const versPiste = new THREE.Matrix4().copy(aeroportStatique.matrixWorld).invert();
const arbres = [];
const libre = (x, z, rayon) => {
  if (!dansIle(x, z, 0.93)) return false;
  if (((x - LAC.x) / (LAC.rx + 0.8)) ** 2 + ((z - LAC.z) / (LAC.rz + 0.8)) ** 2 < 1) return false;
  const local = new THREE.Vector3(x, 0, z).applyMatrix4(versPiste);
  if (zonesInterdites.some(([x1, x2, z1, z2]) => local.x > x1 && local.x < x2 && local.z > z1 && local.z < z2)) {
    return false;
  }
  return arbres.every((a) => (a.x - x) ** 2 + (a.z - z) ** 2 > (a.r + rayon) ** 2);
};

for (let essai = 0; essai < 9000 && arbres.length < 170; essai++) {
  // On favorise le pourtour, comme sur la référence.
  const ang = entre(0, Math.PI * 2);
  const r = Math.sqrt(entre(0.08, 1)) * 0.93;
  const x = Math.cos(ang) * RX * r;
  const z = Math.sin(ang) * RZ * r;
  const echelle = entre(0.75, 1.3);
  const rayon = 0.3 * echelle;
  if (!libre(x, z, rayon)) continue;
  const arbre = hasard() < 0.6 ? sapin(echelle) : feuillu(echelle);
  arbre.position.set(x, 0, z);
  statique.add(arbre);
  arbres.push({ x, z, r: rayon });
}
for (let essai = 0, n = 0; essai < 2000 && n < 16; essai++) {
  const x = entre(-RX, RX), z = entre(-RZ, RZ);
  if (!dansIle(x, z, 0.95) || dansIle(x, z, 0.8) || !libre(x, z, 0.35)) continue;
  const r = rocher();
  r.position.set(x, 0.05, z);
  statique.add(r);
  n++;
}


/* ---------------------------------------------------------
   5. Assemblage des nœuds exportés
   --------------------------------------------------------- */

const materiau = new THREE.MeshStandardMaterial({
  name: 'diorama', vertexColors: true, roughness: 0.85, metalness: 0,
});
const materiauEau = new THREE.MeshStandardMaterial({
  name: 'eau', color: C.eau, roughness: 0.18, metalness: 0.05,
});

const scene = new THREE.Scene();

const diorama = new THREE.Mesh(cuire(statique), materiau);
diorama.name = 'diorama';
scene.add(diorama);

const lac = new THREE.Mesh(new THREE.ShapeGeometry(ellipse(LAC.rx, LAC.rz), 24), materiauEau);
lac.geometry.rotateX(-Math.PI / 2);
lac.geometry.deleteAttribute('normal');
lac.geometry.deleteAttribute('uv');
lac.name = 'lac';
lac.position.set(LAC.x, 0.014, LAC.z);
scene.add(lac);

/* Groupe « aeroport » : repère de la piste, pour les animations et
   les points d'intérêt. */
const aeroport = new THREE.Group();
aeroport.name = 'aeroport';
aeroport.rotation.y = ROTATION_AEROPORT;
scene.add(aeroport);

function meshAnime(nom, groupe) {
  const racine = new THREE.Group();
  racine.add(groupe);
  const m = new THREE.Mesh(cuire(racine), materiau);
  m.name = nom;
  return m;
}

const avionDecollage = meshAnime('avion-decollage', avion(C.bleuNuit, C.accent));
const voitureAutoroute = meshAnime('voiture-autoroute', voiture(C.accent));
const busNavette = meshAnime('bus-navette', bus());
aeroport.add(avionDecollage, voitureAutoroute, busNavette);

// Points d'intérêt : nœuds vides dont seule la position compte.
const PASTILLES = {
  1: [-4.4, 1.55, 3.1],   // enregistrement, hall côté ville
  2: [-2.0, 1.6, 2.5],    // contrôle de sécurité, cœur du terminal
  3: [0.1, 1.55, 1.85],   // duty free, côté pistes
  4: [1.9, 2.2, 2.5],     // salons, à l'étage
  5: [1.8, 1.3, -1.9],    // bout de la jetée
  6: [P1.x, 2.05, P1.z],  // parking P1
};
for (const [n, [x, y, z]] of Object.entries(PASTILLES)) {
  const o = new THREE.Object3D();
  o.name = `pastille-${n}`;
  o.position.set(x, y, z);
  aeroport.add(o);
}

// Cadrage imposé pour le point 5 : vue depuis le nord-est, par-dessus
// les avions au contact. La caméra se place exactement ici.
const vue5 = new THREE.Object3D();
vue5.name = 'vue-5';
vue5.position.set(15.5, 13, -15);
aeroport.add(vue5);

const nuages = new THREE.Group();
nuages.name = 'nuages';
scene.add(nuages);
const POSITIONS_NUAGES = [
  [-10, 6.6, -6], [4, 7.6, -10], [12, 6.2, -3], [-13, 7.2, 4], [9, 8.2, 7],
];
const meshNuages = POSITIONS_NUAGES.map(([x, y, z], i) => {
  const m = meshAnime(`nuage-${i + 1}`, nuage());
  m.position.set(x, y, z);
  nuages.add(m);
  return m;
});


/* ---------------------------------------------------------
   6. Les animations
   --------------------------------------------------------- */

function clip(nom, noeud, cles) {
  const temps = cles.map((k) => k.t);
  const pos = cles.flatMap((k) => k.p);
  const rot = cles.flatMap((k) =>
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...(k.r ?? [0, 0, 0]))).toArray()
  );
  const ech = cles.flatMap((k) => Array(3).fill(k.s ?? 1));
  return new THREE.AnimationClip(nom, -1, [
    new THREE.VectorKeyframeTrack(`${noeud.name}.position`, temps, pos),
    new THREE.QuaternionKeyframeTrack(`${noeud.name}.quaternion`, temps, rot),
    new THREE.VectorKeyframeTrack(`${noeud.name}.scale`, temps, ech),
  ]);
}

const CACHE = 0.0001;   // échelle quasi nulle : l'objet disparaît
const rad = THREE.MathUtils.degToRad;
const animations = [];

// Décollage vers l'est, en 16 secondes, puis retour en bout de piste.
avionDecollage.position.set(-9.2, 0.03, Z_PISTE);
animations.push(clip('decollage', avionDecollage, [
  { t: 0, p: [-9.2, 0.03, Z_PISTE], s: CACHE },
  { t: 0.6, p: [-9.2, 0.03, Z_PISTE] },
  { t: 2.5, p: [-8.1, 0.03, Z_PISTE] },
  { t: 4.5, p: [-4.8, 0.03, Z_PISTE] },
  { t: 6.0, p: [-0.6, 0.03, Z_PISTE] },
  { t: 7.2, p: [3.4, 0.3, Z_PISTE], r: [0, 0, rad(7)] },
  { t: 8.6, p: [8.0, 1.4, Z_PISTE - 0.1], r: [0, 0, rad(11)] },
  { t: 10.4, p: [13.5, 3.6, Z_PISTE - 0.4], r: [rad(-4), 0, rad(11)] },
  { t: 12.2, p: [19.5, 6.1, Z_PISTE - 1.0], r: [rad(-6), 0, rad(9)] },
  { t: 12.8, p: [21.2, 6.8, Z_PISTE - 1.2], r: [rad(-6), 0, rad(9)], s: CACHE },
  { t: 16, p: [-9.2, 0.03, Z_PISTE], s: CACHE },
]));

// Une voiture vers l'est et la navette vers l'ouest, sur l'autoroute.
voitureAutoroute.position.set(-9.4, 0.026, 5.85);
animations.push(clip('voiture', voitureAutoroute, [
  { t: 0, p: [-9.4, 0.026, 5.85], s: CACHE },
  { t: 0.4, p: [-9.0, 0.026, 5.85] },
  { t: 7.6, p: [9.4, 0.026, 5.85] },
  { t: 8.0, p: [9.8, 0.026, 5.85], s: CACHE },
  { t: 9.0, p: [-9.4, 0.026, 5.85], s: CACHE },
]));

busNavette.position.set(9.8, 0.026, 5.35);
animations.push(clip('navette', busNavette, [
  { t: 0, p: [9.8, 0.026, 5.35], r: [0, Math.PI, 0], s: CACHE },
  { t: 0.5, p: [9.3, 0.026, 5.35], r: [0, Math.PI, 0] },
  { t: 11.5, p: [-8.9, 0.026, 5.35], r: [0, Math.PI, 0] },
  { t: 12.0, p: [-9.4, 0.026, 5.35], r: [0, Math.PI, 0], s: CACHE },
  { t: 14.0, p: [9.8, 0.026, 5.35], r: [0, Math.PI, 0], s: CACHE },
]));

// Les nuages dérivent et ondulent, en boucle parfaite.
meshNuages.forEach((m, i) => {
  const duree = 26 + i * 4;
  const amplitude = 1.2 + (i % 3) * 0.5;
  const [x0, y0, z0] = POSITIONS_NUAGES[i];
  const cles = [];
  for (let k = 0; k <= 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    cles.push({ t: (k / 12) * duree, p: [x0 + Math.sin(a) * amplitude, y0 + Math.sin(a * 2) * 0.15, z0] });
  }
  animations.push(clip(`nuage-${i + 1}`, m, cles));
});


/* ---------------------------------------------------------
   7. Contrôles et export
   --------------------------------------------------------- */

const boiteDiorama = new THREE.Box3().setFromObject(diorama);
const triangles = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
let total = 0;
scene.traverse((o) => { if (o.isMesh) total += triangles(o.geometry); });

console.log('arbres plantés   :', arbres.length);
console.log('champs           :', champs.length);
console.log('triangles        :', total);
console.log('sommets diorama  :', diorama.geometry.attributes.position.count);
console.log('emprise diorama  :', boiteDiorama.min.toArray().map((v) => v.toFixed(1)).join(' '),
  '→', boiteDiorama.max.toArray().map((v) => v.toFixed(1)).join(' '));

const exporteur = new GLTFExporter();
const glb = await exporteur.parseAsync(scene, { binary: true, animations, onlyVisible: true });

fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, Buffer.from(glb));
console.log('écrit            :', SORTIE, `(${(glb.byteLength / 1024).toFixed(0)} Ko)`);
