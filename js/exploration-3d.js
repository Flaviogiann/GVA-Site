/* =========================================================
   GVA — Exploration 3D : la scène three.js

   Ce module n'est importé qu'à l'approche de la section (voir
   exploration.js) : les ~800 Ko de three.js ne pèsent donc pas
   sur le premier affichage de la page.

   Il charge un fichier .glb, le recentre, l'éclaire, le rend
   orientable à la souris, au doigt et au clavier, et place les
   pastilles HTML sur les nœuds « pastille-<id> » du modèle.

   GSAP (chargé par la page) anime les déplacements de caméra.
   ========================================================= */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';


/* ---------------------------------------------------------
   1. Réglages
   --------------------------------------------------------- */

/* Quel que soit son échelle d'origine, le modèle est ramené à ce
   rayon : les distances ci-dessous restent donc valables pour tout
   fichier .glb. */
const RAYON = 10;

/* Cadrage de départ : caméra au sud-est, en plongée. */
const AZIMUT_DEPART = THREE.MathUtils.degToRad(34);
const PLONGEE_DEPART = THREE.MathUtils.degToRad(56);

/* Distance de la caméra quand elle se pose sur un point. */
const DISTANCE_POINT = RAYON * 1.25;
const PLONGEE_POINT = THREE.MathUtils.degToRad(50);

const DUREE_VOL = 1.1;          // s, vol vers un point ou retour au départ
const DUREE_ROTATION = 0.7;     // s, boutons ↺ ↻
const DUREE_ZOOM = 0.45;        // s, boutons − +
const PAS_ROTATION = Math.PI / 4;

/* Rotation automatique lente (la maquette : « orbite lente »).
   Unité d'OrbitControls : 1 = un tour par minute. */
const VITESSE_ORBITE = 0.55;

/* Amortissement demandé par la maquette. */
const AMORTISSEMENT = 0.08;

/* Chemin des décodeurs, relatif à ce fichier. */
const DOSSIER_DRACO = new URL('./vendor/three/addons/libs/draco/gltf/', import.meta.url).href;

const gsap = window.gsap;


/* ---------------------------------------------------------
   2. Petits outils
   --------------------------------------------------------- */

/* Anime les propriétés d'un objet avec GSAP, ou les pose d'un coup
   si GSAP manque ou si la durée est nulle. Renvoie une promesse. */
function animer(cible, proprietes, duree, options = {}) {
  if (!gsap || duree === 0) {
    Object.assign(cible, proprietes);
    options.onUpdate?.();
    return Promise.resolve();
  }
  return new Promise((resoudre) => {
    gsap.to(cible, {
      ...proprietes,
      duration: duree,
      ease: options.ease ?? 'power2.inOut',
      overwrite: 'auto',
      onUpdate: options.onUpdate,
      onComplete: resoudre,
      onInterrupt: resoudre,
    });
  });
}

/* Télécharge un fichier en signalant la progression (0 → 1), ou
   null quand le serveur ne donne pas la taille. */
async function telecharger(url, progression) {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error(`Modèle 3D introuvable (${reponse.status}) : ${url}`);

  const total = Number(reponse.headers.get('Content-Length')) || 0;
  if (!reponse.body || !total) {
    progression(null);
    return reponse.arrayBuffer();
  }

  const lecteur = reponse.body.getReader();
  const morceaux = [];
  let recu = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    morceaux.push(value);
    recu += value.length;
    // Min : avec la compression gzip, le serveur annonce la taille compressée.
    progression(Math.min(1, recu / total));
  }

  const tout = new Uint8Array(recu);
  let decalage = 0;
  for (const m of morceaux) {
    tout.set(m, decalage);
    decalage += m.length;
  }
  return tout.buffer;
}

/* Lit la liste des extensions glTF utilisées, pour ne charger un
   décodeur (Draco, Meshopt) que si le fichier en a besoin. */
function extensionsUtilisees(tampon) {
  try {
    const vue = new DataView(tampon);
    let texte;
    if (vue.getUint32(0, true) === 0x46546c67) {          // « glTF » : fichier binaire
      const longueur = vue.getUint32(12, true);
      texte = new TextDecoder().decode(new Uint8Array(tampon, 20, longueur));
    } else {
      texte = new TextDecoder().decode(tampon);            // fichier .gltf en JSON
    }
    return JSON.parse(texte).extensionsUsed ?? [];
  } catch {
    return [];
  }
}

/* Tache d'ombre douce sous l'île, dessinée une fois dans un canvas. */
function textureOmbre() {
  const taille = 256;
  const c = document.createElement('canvas');
  c.width = c.height = taille;
  const g = c.getContext('2d');
  const d = g.createRadialGradient(taille / 2, taille / 2, 0, taille / 2, taille / 2, taille / 2);
  d.addColorStop(0, 'rgba(2, 8, 20, 0.85)');
  d.addColorStop(0.45, 'rgba(2, 8, 20, 0.45)');
  d.addColorStop(1, 'rgba(2, 8, 20, 0)');
  g.fillStyle = d;
  g.fillRect(0, 0, taille, taille);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}


/* ---------------------------------------------------------
   3. La scène
   --------------------------------------------------------- */

export async function creerScene3D(options) {
  const {
    conteneur,           // la vue (.scene3d), qui porte les classes d'état
    toile,               // élément qui reçoit la souris et le clavier
    modele,              // adresse du fichier .glb
    points,              // données des points d'intérêt
    pastilles,           // Map id → élément HTML de la pastille
    surEtat = () => {},  // ('chargement', p) | ('pret') ; les erreurs sont levées
    surInteraction = () => {},
    mouvementsReduits = false,
  } = options;

  const canvas = toile.querySelector('canvas');
  const tactile = window.matchMedia('(pointer: coarse)').matches;

  /* --- Rendu --- */
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tactile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;   // filtré, adouci par shadow.radius

  const scene = new THREE.Scene();

  // Un environnement neutre donne des reflets aux vitres et au métal.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environnement = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environnement;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);

  /* --- Lumières : un soleil de fin d'après-midi et un contre-jour bleuté --- */
  scene.add(new THREE.HemisphereLight('#dfe9ff', '#1d2f4d', 1.1));

  const soleil = new THREE.DirectionalLight('#fff1dc', 2.7);
  soleil.position.set(-11, 21, 13);
  soleil.castShadow = true;
  soleil.shadow.mapSize.setScalar(tactile ? 1024 : 2048);
  Object.assign(soleil.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 70 });
  soleil.shadow.bias = -0.0005;
  soleil.shadow.radius = 3;
  scene.add(soleil);

  const contreJour = new THREE.DirectionalLight('#9dc2ff', 0.8);
  contreJour.position.set(14, 7, -12);
  scene.add(contreJour);

  /* --- Contrôles --- */
  const controles = new OrbitControls(camera, toile);
  controles.enableDamping = true;
  controles.dampingFactor = AMORTISSEMENT;
  controles.rotateSpeed = 0.65;
  controles.zoomSpeed = 0.8;
  controles.panSpeed = 0.7;
  controles.screenSpacePanning = false;       // on se déplace parallèlement au sol
  controles.minPolarAngle = THREE.MathUtils.degToRad(15);
  controles.maxPolarAngle = THREE.MathUtils.degToRad(80);
  controles.minDistance = RAYON * 0.45;
  controles.autoRotateSpeed = 0;

  /* Sur téléphone, un glissement vertical doit faire défiler la page :
     seul le glissement horizontal fait pivoter la maquette. */
  if (tactile) toile.style.touchAction = 'pan-y';

  /* --- Chargement du modèle --- */
  surEtat('chargement', 0);
  const tampon = await telecharger(modele, (p) => surEtat('chargement', p));

  const chargeur = new GLTFLoader();
  const extensions = extensionsUtilisees(tampon);
  if (extensions.includes('KHR_draco_mesh_compression')) {
    const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
    const draco = new DRACOLoader();
    draco.setDecoderPath(DOSSIER_DRACO);
    draco.setDecoderConfig({ type: 'wasm' });
    chargeur.setDRACOLoader(draco);
  }
  if (extensions.includes('EXT_meshopt_compression')) {
    const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
    chargeur.setMeshoptDecoder(MeshoptDecoder);
  }

  const dossierModele = new URL('.', new URL(modele, document.baseURI)).href;
  const gltf = await chargeur.parseAsync(tampon, dossierModele);
  const modele3d = gltf.scene;

  /* Les objets animés (avion, nuages…) ne comptent pas dans le
     cadrage : un avion parti loin fausserait le centrage. */
  const nomsAnimes = new Set(
    gltf.animations.flatMap((clip) =>
      clip.tracks.map((piste) => THREE.PropertyBinding.parseTrackName(piste.name).nodeName)
    )
  );
  const estAnime = (objet) => {
    for (let o = objet; o; o = o.parent) if (nomsAnimes.has(o.name)) return true;
    return false;
  };

  modele3d.updateMatrixWorld(true);
  const boite = new THREE.Box3();
  const occultants = [];
  modele3d.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (estAnime(o)) return;
    occultants.push(o);
    o.geometry.computeBoundingBox();
    boite.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
  });
  if (boite.isEmpty()) boite.setFromObject(modele3d);

  const sphere = boite.getBoundingSphere(new THREE.Sphere());
  const echelle = RAYON / sphere.radius;

  const racine = new THREE.Group();
  racine.add(modele3d);
  racine.scale.setScalar(echelle);
  racine.position.copy(sphere.center).multiplyScalar(-echelle);
  scene.add(racine);
  racine.updateMatrixWorld(true);

  const boiteMonde = boite.clone().applyMatrix4(racine.matrixWorld);
  const centre = boiteMonde.getCenter(new THREE.Vector3());

  // Ombre douce sous le modèle
  const ombre = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: textureOmbre(), transparent: true, depthWrite: false })
  );
  const tailleOmbre = boiteMonde.getSize(new THREE.Vector3());
  ombre.rotation.x = -Math.PI / 2;
  ombre.scale.set(tailleOmbre.x * 1.5, tailleOmbre.z * 1.5, 1);
  ombre.position.set(centre.x, boiteMonde.min.y - RAYON * 0.12, centre.z);
  ombre.renderOrder = -1;
  scene.add(ombre);

  /* --- Animations du fichier : toutes jouées en boucle --- */
  const melangeur = new THREE.AnimationMixer(modele3d);
  if (!mouvementsReduits) {
    gltf.animations.forEach((clip) => melangeur.clipAction(clip).play());
  }

  /* --- Points d'intérêt --- */
  const cibles = new Map();
  const manquants = [];
  for (const p of points) {
    const noeud = modele3d.getObjectByName(`pastille-${p.id}`) ?? null;
    const vue = modele3d.getObjectByName(`vue-${p.id}`) ?? null;
    const repli = p.position ? new THREE.Vector3(...p.position) : null;
    if (!noeud && !repli) manquants.push(`pastille-${p.id}`);
    cibles.set(p.id, { noeud, vue, repli });
  }
  if (manquants.length) {
    console.warn(
      `[GVA 3D] Nœuds absents du modèle : ${manquants.join(', ')}. ` +
      'Les pastilles correspondantes restent masquées (voir modeles/LISEZMOI.md).'
    );
  }

  const tampon3 = new THREE.Vector3();
  function positionPoint(cible, sortie = new THREE.Vector3()) {
    if (cible.noeud) return cible.noeud.getWorldPosition(sortie);
    if (cible.repli) return sortie.copy(cible.repli);
    return null;
  }


  /* ---------------------------------------------------------
     4. La caméra
     La caméra est décrite par sa cible et des coordonnées
     sphériques autour de celle-ci : c'est ce que GSAP anime, pour
     que les vols tournent autour du modèle au lieu de le traverser.
     --------------------------------------------------------- */

  const etat = { cx: 0, cy: 0, cz: 0, rayon: 1, theta: 0, phi: 1 };
  const spherique = new THREE.Spherical();

  function lireEtat() {
    spherique.setFromVector3(tampon3.copy(camera.position).sub(controles.target));
    return {
      cx: controles.target.x, cy: controles.target.y, cz: controles.target.z,
      rayon: spherique.radius, theta: spherique.theta, phi: spherique.phi,
    };
  }

  function appliquerEtat() {
    controles.target.set(etat.cx, etat.cy, etat.cz);
    camera.position
      .setFromSphericalCoords(etat.rayon, etat.phi, etat.theta)
      .add(controles.target);
    // Sans cela, un rendu fait hors de la boucle (redimensionnement)
    // partirait d'une caméra mal orientée.
    camera.lookAt(controles.target);
    camera.updateMatrixWorld();
  }

  /* Distance à laquelle le modèle remplit le cadre de départ.
     On projette un échantillon de ses sommets depuis la direction de
     départ et on cherche, par dichotomie, la distance où ils touchent
     les bords utiles (le haut et le bas sont réservés aux outils).
     Les coins de la boîte englobante seraient trop prudents : sur une
     île ronde, ils tombent dans le vide. */
  const echantillon = [];
  const totalSommets = occultants.reduce((n, m) => n + m.geometry.attributes.position.count, 0);
  const pas = Math.max(1, Math.floor(totalSommets / 2000));
  for (const mesh of occultants) {
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += pas) {
      echantillon.push(new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld));
    }
  }
  const coins = echantillon.length ? echantillon : [boiteMonde.min.clone(), boiteMonde.max.clone()];
  const cameraEssai = new THREE.PerspectiveCamera();
  const pointEssai = new THREE.Vector3();

  function distanceIdeale() {
    const cible = new THREE.Vector3(centre.x, centre.y, centre.z);
    const direction = new THREE.Vector3().setFromSphericalCoords(1, PLONGEE_DEPART, AZIMUT_DEPART);
    cameraEssai.fov = camera.fov;
    cameraEssai.aspect = camera.aspect;
    cameraEssai.updateProjectionMatrix();

    const tient = (distance) => {
      cameraEssai.position.copy(direction).multiplyScalar(distance).add(cible);
      cameraEssai.lookAt(cible);
      cameraEssai.updateMatrixWorld();
      return coins.every((c) => {
        pointEssai.copy(c).project(cameraEssai);
        return Math.abs(pointEssai.x) <= 0.9 && Math.abs(pointEssai.y) <= 0.78 && pointEssai.z < 1;
      });
    };

    let proche = RAYON * 0.5;
    let loin = RAYON * 8;
    for (let i = 0; i < 18; i++) {
      const milieu = (proche + loin) / 2;
      if (tient(milieu)) loin = milieu;
      else proche = milieu;
    }
    return loin;
  }

  function vueDepart() {
    return {
      cx: centre.x, cy: centre.y, cz: centre.z,
      rayon: distanceIdeale(), theta: AZIMUT_DEPART, phi: PLONGEE_DEPART,
    };
  }

  let derniereDestination = null;
  const volActif = () => Boolean(gsap?.isTweening(etat));

  /* Point de départ d'un mouvement relatif (↺, +…) : si un vol est
     en cours, on part de sa destination, pour que des clics rapides
     s'additionnent au lieu de repartir d'une position intermédiaire. */
  function base() {
    return volActif() && derniereDestination ? { ...derniereDestination } : lireEtat();
  }

  function voler(destination, duree = DUREE_VOL) {
    if (volActif()) {
      stopperVol();
    } else {
      // Annule l'élan résiduel d'un glisser précédent.
      controles.enableDamping = false;
      controles.update();
      controles.enableDamping = true;
    }
    Object.assign(etat, lireEtat());

    // Plus court chemin autour du modèle
    const ecart = destination.theta - etat.theta;
    const theta = etat.theta + Math.atan2(Math.sin(ecart), Math.cos(ecart));

    derniereDestination = {
      ...destination,
      theta,
      rayon: THREE.MathUtils.clamp(destination.rayon, controles.minDistance, controles.maxDistance),
      phi: THREE.MathUtils.clamp(destination.phi, controles.minPolarAngle, controles.maxPolarAngle),
    };

    return animer(etat, derniereDestination, mouvementsReduits ? 0 : duree, { onUpdate: appliquerEtat });
  }

  function stopperVol() {
    gsap?.killTweensOf(etat);
  }


  /* ---------------------------------------------------------
     5. Rotation automatique
     --------------------------------------------------------- */

  let visible = false;
  let orbiteVoulue = false;   // la section est visible à plus de 30 %
  let orbiteSuspendue = false; // l'utilisateur a pris la main

  function majOrbite() {
    const active = orbiteVoulue && visible && !orbiteSuspendue && !mouvementsReduits;
    gsap?.killTweensOf(controles);
    if (active) {
      controles.autoRotate = true;
      animer(controles, { autoRotateSpeed: VITESSE_ORBITE }, 0.6, { ease: 'power1.out' });
    } else {
      controles.autoRotate = false;
      controles.autoRotateSpeed = 0;
    }
  }

  function suspendreOrbite() {
    orbiteSuspendue = true;
    majOrbite();
  }

  /* L'utilisateur prend la main : on arrête tout mouvement automatique. */
  controles.addEventListener('start', () => {
    stopperVol();
    aBouge = true;
    suspendreOrbite();
    surInteraction();
  });


  /* ---------------------------------------------------------
     6. Pastilles : projection et occultation
     --------------------------------------------------------- */

  const projete = new THREE.Vector3();
  const lanceur = new THREE.Raycaster();
  const matricePrecedente = new THREE.Matrix4();
  let derniereOccultation = 0;
  const places = [];   // positions à l'écran de l'image courante

  function placerPastilles() {
    const largeur = toile.clientWidth;
    const hauteur = toile.clientHeight;
    places.length = 0;

    for (const [id, cible] of cibles) {
      const el = pastilles.get(id);
      if (!el) continue;
      if (!positionPoint(cible, projete)) {
        el.classList.add('est-hors-champ');
        continue;
      }
      projete.project(camera);
      const x = (projete.x + 1) / 2 * largeur;
      const y = (1 - projete.y) / 2 * hauteur;
      const horsChamp = projete.z > 1 || x < -24 || x > largeur + 24 || y < -24 || y > hauteur + 24;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.classList.toggle('est-hors-champ', horsChamp);
      if (!horsChamp) places.push({ el, x, y });
    }

    placerNoms(largeur, hauteur);
  }


  /* Placement des noms
     Par défaut, le nom s'affiche à droite de sa pastille. Il passe à
     gauche s'il sortirait du cadre. Quand tous les noms sont affichés
     (bouton œil), chacun cherche une place libre parmi quelques
     positions voisines, pour ne recouvrir ni un autre nom ni une
     autre pastille. La place trouvée est gardée tant qu'elle reste
     libre, pour que les noms ne sautent pas pendant la rotation. */

  const ECART_NOM = 34;          // du centre de la pastille au bord du nom
  const RAYON_DISQUE = 22;
  const MARGE_NOM = 4;
  const ESSAIS = [
    ['droite', 0], ['gauche', 0],
    ['droite', -28], ['droite', 28], ['gauche', -28], ['gauche', 28],
    ['droite', -56], ['droite', 56], ['gauche', -56], ['gauche', 56],
  ];
  const tailles = new WeakMap();
  const choix = new WeakMap();

  function tailleNom(el) {
    let t = tailles.get(el);
    if (!t) {
      const nom = el.querySelector('.pastille__nom');
      t = { l: nom.offsetWidth, h: nom.offsetHeight };
      if (t.l) tailles.set(el, t);
    }
    return t;
  }
  document.fonts?.ready.then(() => { pastilles.forEach((el) => tailles.delete(el)); });

  function boiteNom(p, t, cote, dy) {
    const x1 = cote === 'droite' ? p.x + ECART_NOM : p.x - ECART_NOM - t.l;
    const y1 = p.y + dy - t.h / 2;
    return { x1, x2: x1 + t.l, y1, y2: y1 + t.h };
  }

  const chevauche = (a, b) =>
    a.x1 < b.x2 + MARGE_NOM && a.x2 + MARGE_NOM > b.x1 &&
    a.y1 < b.y2 + MARGE_NOM && a.y2 + MARGE_NOM > b.y1;

  let tousAvant = false;

  function placerNoms(largeur, hauteur) {
    const tous = conteneur.classList.contains('scene3d--noms');
    if (tous !== tousAvant) {
      // Les noms sont plus compacts en mode « tous » : on remesure.
      tousAvant = tous;
      pastilles.forEach((el) => tailles.delete(el));
    }
    const disques = places.map((p) => ({
      p,
      x1: p.x - RAYON_DISQUE, x2: p.x + RAYON_DISQUE,
      y1: p.y - RAYON_DISQUE, y2: p.y + RAYON_DISQUE,
    }));
    const occupes = [];
    // Du haut vers le bas : l'ordre reste stable d'une image à l'autre.
    const ordre = [...places].sort((a, b) => a.y - b.y);

    for (const p of ordre) {
      const t = tailleNom(p.el);
      if (!t.l) continue;

      const dansCadre = (b) => b.x1 >= 4 && b.x2 <= largeur - 4 && b.y1 >= 4 && b.y2 <= hauteur - 4;
      const libre = (b) =>
        dansCadre(b) &&
        (!tous || (
          !occupes.some((o) => chevauche(b, o)) &&
          !disques.some((d) => d.p !== p && chevauche(b, d))
        ));

      const essais = tous ? ESSAIS : ESSAIS.slice(0, 2);
      const precedent = choix.get(p.el);
      let retenu = precedent && essais.includes(precedent) && libre(boiteNom(p, t, ...precedent))
        ? precedent
        : null;
      if (!retenu) retenu = essais.find(([cote, dy]) => libre(boiteNom(p, t, cote, dy))) ?? essais[0];

      if (retenu !== precedent) {
        choix.set(p.el, retenu);
        p.el.classList.toggle('nom-a-gauche', retenu[0] === 'gauche');
        p.el.style.setProperty('--nom-decalage', `${retenu[1]}px`);
      }
      occupes.push(boiteNom(p, t, ...retenu));
    }
  }

  /* Une pastille cachée derrière un bâtiment est atténuée. Le test
     ne tourne que si la caméra a bougé, et au plus 4 fois par seconde. */
  function testerOccultation(maintenant) {
    if (maintenant - derniereOccultation < 250) return;
    if (matricePrecedente.equals(camera.matrixWorld)) return;
    derniereOccultation = maintenant;
    matricePrecedente.copy(camera.matrixWorld);

    const direction = new THREE.Vector3();
    for (const [id, cible] of cibles) {
      const el = pastilles.get(id);
      if (!el || !positionPoint(cible, projete)) continue;
      direction.subVectors(projete, camera.position);
      const distance = direction.length();
      lanceur.set(camera.position, direction.normalize());
      lanceur.far = distance - 0.25;
      el.classList.toggle('est-derriere', lanceur.intersectObjects(occultants, false).length > 0);
    }
  }


  /* ---------------------------------------------------------
     7. Décalage de l'image
     Quand le panneau recouvre une partie de la vue, on décale le
     rendu pour que le point regardé reste au centre de la partie
     visible. setViewOffset déplace l'image sans bouger la caméra.
     --------------------------------------------------------- */

  const decalage = { x: 0, y: 0 };

  function appliquerDecalage() {
    const largeur = toile.clientWidth;
    const hauteur = toile.clientHeight;
    if (Math.abs(decalage.x) < 0.5 && Math.abs(decalage.y) < 0.5) {
      camera.clearViewOffset();
    } else {
      camera.setViewOffset(largeur, hauteur, decalage.x, decalage.y, largeur, hauteur);
    }
  }

  function decaler(x, y) {
    return animer(decalage, { x, y }, mouvementsReduits ? 0 : 0.32, {
      ease: 'power2.out',
      onUpdate: appliquerDecalage,
    });
  }


  /* ---------------------------------------------------------
     8. Taille, boucle de rendu
     --------------------------------------------------------- */

  let aBouge = false;   // tant que personne n'a touché la vue, le cadrage suit la taille

  function redimensionner() {
    const largeur = toile.clientWidth;
    const hauteur = toile.clientHeight;
    if (!largeur || !hauteur) return;

    renderer.setSize(largeur, hauteur, false);
    camera.aspect = largeur / hauteur;
    camera.updateProjectionMatrix();
    appliquerDecalage();
    controles.maxDistance = distanceIdeale() * 1.7;

    if (!aBouge) {
      Object.assign(etat, vueDepart());
      appliquerEtat();
    }
    rendre();
  }

  const observateurTaille = new ResizeObserver(redimensionner);
  observateurTaille.observe(toile);

  /* Timer suit le temps entre deux images ; connect() le remet à zéro
     quand l'onglet redevient visible, pour éviter un saut. */
  const minuteur = new THREE.Timer();
  minuteur.connect(document);

  function rendre() {
    renderer.render(scene, camera);
    placerPastilles();
  }

  function boucle(temps) {
    minuteur.update(temps);
    const dt = Math.min(minuteur.getDelta(), 0.1);
    melangeur.update(dt);
    controles.update(dt);
    rendre();
    testerOccultation(temps);
  }

  function definirVisible(oui) {
    if (oui === visible) return;
    visible = oui;
    if (oui) {
      minuteur.reset();
      renderer.setAnimationLoop(boucle);
    } else {
      renderer.setAnimationLoop(null);
    }
    majOrbite();
  }


  /* ---------------------------------------------------------
     9. Clavier
     Flèches : pivoter et incliner — plus et moins : zoomer —
     0 ou Début : revenir au cadrage de départ.
     --------------------------------------------------------- */

  /* sens −1 : la maquette tourne vers la gauche ; +1 : vers la droite. */
  function tourner(sens, pas = PAS_ROTATION, duree = DUREE_ROTATION) {
    suspendreOrbite();
    aBouge = true;
    const e = base();
    return voler({ ...e, theta: e.theta + sens * pas }, duree);
  }

  function incliner(sens) {
    suspendreOrbite();
    aBouge = true;
    const e = base();
    return voler({ ...e, phi: e.phi + sens * (Math.PI / 20) }, 0.35);
  }

  function zoomer(sens) {
    suspendreOrbite();
    aBouge = true;
    const e = base();
    return voler({ ...e, rayon: e.rayon * (sens > 0 ? 0.78 : 1.28) }, DUREE_ZOOM);
  }

  toile.addEventListener('keydown', (evenement) => {
    const grand = evenement.shiftKey ? 3 : 1;
    switch (evenement.key) {
      case 'ArrowLeft': tourner(-1, (Math.PI / 16) * grand, 0.3); break;
      case 'ArrowRight': tourner(1, (Math.PI / 16) * grand, 0.3); break;
      case 'ArrowUp': incliner(-1); break;
      case 'ArrowDown': incliner(1); break;
      case '+': case '=': zoomer(1); break;
      case '-': case '_': zoomer(-1); break;
      case '0': case 'Home': api.reinitialiser(); break;
      default: return;
    }
    evenement.preventDefault();
    surInteraction();
  });


  /* ---------------------------------------------------------
     10. Interface publique
     --------------------------------------------------------- */

  const api = {
    /* Vole vers un point d'intérêt. Si le modèle contient un nœud
       « vue-<id> », la caméra s'y place ; sinon elle garde son
       orientation et se rapproche. */
    focaliser(id) {
      const cible = cibles.get(id);
      const point = cible && positionPoint(cible, new THREE.Vector3());
      if (!point) return Promise.resolve();

      stopperVol();
      suspendreOrbite();
      aBouge = true;

      let vue;
      if (cible.vue) {
        const s = new THREE.Spherical().setFromVector3(
          cible.vue.getWorldPosition(new THREE.Vector3()).sub(point)
        );
        vue = { rayon: s.radius, theta: s.theta, phi: s.phi };
      } else {
        vue = { rayon: DISTANCE_POINT, theta: lireEtat().theta, phi: PLONGEE_POINT };
      }
      return voler({ cx: point.x, cy: point.y - RAYON * 0.03, cz: point.z, ...vue });
    },

    reinitialiser() {
      stopperVol();
      aBouge = false;
      return voler(vueDepart()).then(() => {
        orbiteSuspendue = false;
        majOrbite();
      });
    },

    tourner: (sens) => tourner(sens),
    zoomer,
    decaler,
    definirVisible,
    definirOrbite(oui) {
      orbiteVoulue = oui;
      majOrbite();
    },

    /* Vrai si le modèle place bien ce point. */
    connait: (id) => {
      const c = cibles.get(id);
      return Boolean(c && (c.noeud || c.repli));
    },

    detruire() {
      renderer.setAnimationLoop(null);
      minuteur.dispose();
      observateurTaille.disconnect();
      controles.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        [o.material].flat().forEach((m) => { m?.map?.dispose(); m?.dispose(); });
      });
      environnement.dispose();
      renderer.dispose();
    },
  };

  redimensionner();
  surEtat('pret');

  /* Avec ?debug dans l'adresse, la scène est accessible depuis la
     console : window.gva3d.camera, .controles, .scene… */
  if (new URLSearchParams(location.search).has('debug')) {
    window.gva3d = { THREE, scene, camera, controles, racine, cibles, api, boiteMonde };
  }

  return api;
}
