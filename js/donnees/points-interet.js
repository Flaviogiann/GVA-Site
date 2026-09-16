/* =========================================================
   Les six points d'intérêt de l'exploration 3D.

   Chaque point est relié au modèle 3D par son numéro : le fichier
   .glb doit contenir un nœud vide nommé « pastille-<id> » à
   l'endroit où la pastille doit apparaître.

   Champs :
   - id            numéro affiché dans la pastille
   - nom           titre du panneau et libellé de la pastille
   - zone          surtitre du panneau
   - texte         description
   - infos         trois paires [intitulé, valeur]
   - photo         chemin d'une image, ou null pour l'emplacement réservé
   - legendePhoto  texte de l'emplacement réservé, et alt de la photo
   - lien          lien secondaire en pied de panneau
   - position      (facultatif) [x, y, z] si le modèle n'a pas de nœud
                   « pastille-<id> ». Coordonnées de la scène, où le
                   modèle est ramené à un rayon de 10.

   Données de démonstration : horaires, temps d'attente et tarifs
   sont inventés.
   ========================================================= */

export const POINTS = [
  {
    id: 1,
    nom: 'Enregistrement',
    zone: 'Zone publique',
    texte:
      "Les comptoirs et les bornes libre-service occupent le hall des départs. " +
      "Déposez vos bagages jusqu'à 40 minutes avant le vol, ou enregistrez-vous " +
      "en ligne dès 24 heures avant le départ.",
    infos: [['Étage', 'Niveau 1'], ['Horaires', '04:30–22:00'], ['Attente', '6 min']],
    photo: null,
    legendePhoto: 'hall des départs',
    lien: { texte: 'Enregistrer mon vol en ligne', href: '#vols' },
  },
  {
    id: 2,
    nom: 'Contrôle de sécurité',
    zone: 'Filtre de sûreté',
    texte:
      "Un seul filtre de sûreté donne accès à toutes les portes. Rangez vos " +
      "liquides de moins de 100 ml dans un sachet transparent et sortez vos " +
      "appareils électroniques du bagage à main.",
    infos: [['Étage', 'Niveau 1'], ['Horaires', '04:30–22:30'], ['Attente', '12 min']],
    photo: null,
    legendePhoto: 'filtre de sûreté',
    lien: { texte: 'Ce que je peux emporter', href: '#infos' },
  },
  {
    id: 3,
    nom: 'Duty Free',
    zone: 'Zone réservée',
    texte:
      "2 400 m² de boutiques après le contrôle de sécurité : horlogerie, parfums, " +
      "chocolats suisses et spiritueux, aux prix hors taxes. Réservez en ligne et " +
      "récupérez votre commande au comptoir avant l'embarquement.",
    infos: [['Étage', 'Niveau 2'], ['Horaires', '05:00–22:30'], ['Attente', '4 min']],
    photo: null,
    legendePhoto: 'galerie duty free',
    lien: { texte: 'Toutes les boutiques du terminal', href: '#boutiques' },
  },
  {
    id: 4,
    nom: 'Salons VIP',
    zone: 'Zone réservée',
    texte:
      "Deux salons surplombent les pistes à l'étage : fauteuils, douches, " +
      "restauration légère et vue dégagée sur le Jura. Accès avec une carte de " +
      "fidélité, un billet en classe affaires ou une entrée à la journée.",
    infos: [['Étage', 'Niveau 3'], ['Horaires', '05:00–22:00'], ['Entrée', 'dès CHF 45.–']],
    photo: null,
    legendePhoto: 'salon panoramique',
    lien: { texte: 'Réserver un accès au salon', href: '#infos' },
  },
  {
    id: 5,
    nom: "Portes d'embarquement",
    zone: 'Zone réservée',
    texte:
      "Les portes se répartissent entre le terminal principal et la jetée. " +
      "Comptez jusqu'à dix minutes de marche pour les plus éloignées ; votre " +
      "porte s'affiche environ 40 minutes avant le départ.",
    infos: [['Étage', 'Niveau 2'], ['Portes', 'A à D'], ['À pied', '10 min max.']],
    photo: null,
    legendePhoto: 'jetée et passerelles',
    lien: { texte: 'Suivre mon vol', href: '#vols' },
  },
  {
    id: 6,
    nom: 'Parkings & accès',
    zone: 'Zone publique',
    texte:
      "La gare CFF se trouve sous le terminal, à 6 minutes de Cornavin. Le P1 " +
      "est relié directement au hall des départs ; le P26 accueille les longs " +
      "séjours, avec une navette gratuite toutes les 10 minutes.",
    infos: [['Étage', 'Niveau 0'], ['Ouverture', '24 h/24'], ['P1', 'CHF 5.–/h']],
    photo: null,
    legendePhoto: 'parking P1 et gare',
    lien: { texte: 'Tarifs et réservation', href: '#acces' },
  },
];
