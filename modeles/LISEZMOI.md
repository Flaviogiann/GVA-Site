# Intégrer votre modèle 3D

La section « Explorez l'aéroport » affiche le fichier `terminal.glb` de ce
dossier. Celui qui s'y trouve aujourd'hui est un **modèle provisoire**, généré
par `outils/modele-provisoire/generer-terminal.mjs`. Il sert à faire tourner la
section en attendant le vrai modèle.

## Remplacer le modèle

Deux façons de faire :

1. Exporter votre modèle sous le nom `terminal.glb` et écraser celui-ci.
2. Le déposer sous un autre nom et changer l'attribut `data-modele` dans
   `index.html` :

   ```html
   <div class="scene3d" data-modele="modeles/mon-aeroport.glb">
   ```

Pour essayer un fichier sans toucher au HTML, ajoutez-le à l'adresse :

```
http://localhost:4173/?modele=modeles/mon-aeroport.glb#services
```

## Exporter depuis Blender

*Fichier › Exporter › glTF 2.0 (.glb/.gltf)*, avec ces réglages. Les
intitulés varient un peu d'une version de Blender à l'autre.

| Réglage | Valeur |
| --- | --- |
| Format | **glTF binaire (.glb)** |
| Inclure › Limiter à › Objets sélectionnés | si coché, sélectionnez aussi les vides des pastilles |
| Inclure › Données › Caméras | décoché : le site gère sa caméra |
| Inclure › Données › Lumières ponctuelles | **décoché** : le site éclaire lui-même la scène |
| Transformation › +Y vers le haut | **coché** (valeur par défaut) |
| Données › Maillage › Appliquer les modificateurs | coché |
| Animation | coché si le modèle est animé |
| Données › Compression | Draco possible, voir plus bas |

L'échelle et la position n'ont pas d'importance : le site recentre le modèle et
le ramène toujours à la même taille.

## Placer les pastilles

Chaque point d'intérêt est un **objet vide** (*Ajouter › Vide › Axes simples*)
placé à l'endroit où la pastille doit flotter, un peu au-dessus du bâtiment.
Son nom doit être exactement :

| Nom de l'objet vide | Point |
| --- | --- |
| `pastille-1` | Enregistrement |
| `pastille-2` | Contrôle de sécurité |
| `pastille-3` | Duty Free |
| `pastille-4` | Salons VIP |
| `pastille-5` | Portes d'embarquement |
| `pastille-6` | Parkings & accès |

Attention aux doublons : Blender renomme une copie en `pastille-1.001`, que le
site ne reconnaîtra pas. Une pastille introuvable est simplement masquée, et la
console du navigateur indique lesquelles manquent.

Les textes des panneaux ne sont pas dans le modèle mais dans
`js/donnees/points-interet.js`.

### Cadrer la caméra sur un point (facultatif)

Par défaut, quand on clique une pastille, la caméra garde son orientation et se
rapproche. Pour imposer un point de vue, ajoutez un autre objet vide nommé
`vue-<numéro>` (par exemple `vue-5`) à l'endroit où la caméra doit se placer.
Elle s'y posera en regardant la pastille du même numéro. Le modèle provisoire
utilise ce réglage pour le point 5.

## Animer le décor

**Toutes les animations du fichier tournent en boucle**, en même temps : un
avion qui décolle, des nuages qui dérivent, une voiture sur la route… Chaque
action Blender devient une animation glTF.

Deux conseils :

- pour faire disparaître un objet à la fin de sa boucle, animez son échelle
  jusqu'à presque zéro (0,0001) ;
- les objets animés ne comptent pas dans le cadrage : un avion qui s'éloigne ne
  fera pas reculer la caméra.

Quand le visiteur demande moins d'animations (réglage système « Réduire les
animations »), les animations ne sont pas jouées : le décor reste dans sa pose
de repos.

## Poids et performances

| Cible | Valeur conseillée |
| --- | --- |
| Poids du fichier | moins de 5 Mo |
| Triangles | moins de 150 000 |
| Textures | 2048 px au maximum, en JPEG ou WebP |
| Matériaux | Principled BSDF, le moins possible |

Le style low-poly à couleurs unies de la référence n'a presque pas besoin de
textures : des matériaux de couleur suffisent et gardent le fichier léger.

Pour compresser, deux options sont prises en charge par le site :

- **Draco**, directement dans l'export Blender (*Données › Compression*) ;
- **Meshopt**, avec l'outil en ligne de commande :

  ```bash
  npx @gltf-transform/cli optimize terminal.glb terminal-optimise.glb --compress meshopt
  ```

Le site ne télécharge le décodeur que si le fichier en a besoin.

## Rendu à facettes

Pour obtenir le rendu à facettes de la référence, activez l'ombrage plat dans
Blender (*Objet › Ombrage plat*). Le site respecte les normales exportées.

Un fichier exporté **sans normales** passe automatiquement en ombrage plat :
c'est ce que fait le modèle provisoire.
