# TP02 — Web3D (A-Frame)

Ce dépôt contient la réalisation complète du TP02 « Web3D » : une petite scène
3D construite avec [A-Frame](https://aframe.io) dans laquelle on contrôle un
cube-joueur, une caméra qui orbite autour de lui, et un système de physique
avec collisions.

Chaque exercice est une page HTML indépendante dans `exercices/`, pour
pouvoir observer clairement la progression d'un exercice à l'autre. Le point
d'entrée `index.html` donne accès à toutes les pages.

## Comment lancer le projet

Comme les pages chargent des fichiers locaux (`assets/`, `js/`) avec des
requêtes `fetch`/`XHR` (textures), il faut les servir via un petit serveur
HTTP plutôt que de les ouvrir directement en `file://` :

```bash
# depuis la racine du dépôt
python3 -m http.server 8080
# puis ouvrir http://localhost:8080/index.html
```

Aucune installation n'est nécessaire : A-Frame et `aframe-physics-system`
sont chargés depuis un CDN directement dans les pages HTML.

## Structure du dépôt

```
index.html                  Sommaire avec liens vers les 6 exercices
exercices/
  exercice1.html            Ex.1 : plan + skybox
  exercice2.html            Ex.2 : déplacement du cube (WASD + saut)
  exercice3.html            Ex.3 : caméra orbitale
  exercice4.html            Ex.4 : déplacement relatif à la caméra
  exercice5.html            Ex.5 : déplacement avec aframe-physics-system
  exercice6.html            Ex.6 : collisions entre plusieurs cubes
js/
  wasd-jump-movement.js     Composant A-Frame : déplacement + saut (ex.2-4)
  orbit-camera.js           Composant A-Frame : caméra orbitale (ex.3-4)
  physics-movement.js       Composant A-Frame : déplacement physique (ex.5-6)
css/style.css               Style commun des pages (HUD d'instructions)
assets/textures/            Textures générées (herbe, skybox)
tools/generate_assets.py    Script Python qui génère ces textures
```

## Exercice 1 — Créer un plan et un skybox

**Objectif :** habiller la scène avec un sol et un ciel.

Concrètement :
- Un `<a-plane>` très large (200×200) est posé à l'horizontale
  (`rotation="-90 0 0"`, car un plan A-Frame est vertical par défaut) et
  reçoit une texture d'herbe (`assets/textures/grass.jpg`), répétée 40×40
  fois (`repeat="40 40"`) pour que le motif reste net même sur une grande
  surface au lieu d'être étiré.
- Un `<a-sky>` avec une image panoramique équirectangulaire
  (`assets/textures/sky.jpg`) habille l'intérieur d'une immense sphère qui
  entoure toute la scène : où que l'on regarde, on voit le ciel.

Les deux textures sont **générées procéduralement** (voir
`tools/generate_assets.py`) plutôt que téléchargées, pour que le projet
fonctionne sans dépendre d'une image externe : un bruit périodique (sommes
de sinusoïdes dont la fréquence est un multiple entier de la taille de
l'image) garantit que la texture d'herbe se répète sans raccord visible, et
un dégradé bleu + nuages + soleil forme le panorama du ciel.

## Exercice 2 — Déplacement du cube (Player Movement)

**Objectif :** un cube qu'on peut déplacer au clavier de façon fluide et
réaliste.

Le composant `wasd-jump-movement.js` fait tout le travail :

- **Position au sol** : le cube (1×1×1) est placé à `y = 0.5`, soit
  exactement la moitié de sa hauteur — sa face inférieure touche donc le
  plan (`y = 0`) sans s'y enfoncer ni flotter.
- **Déplacement WASD** : à chaque frame, on regarde quelles touches sont
  enfoncées pour construire un vecteur direction (`W`/`S` = avant/arrière,
  `A`/`D` = gauche/droite). Comme on additionne simplement les deux axes,
  appuyer sur deux touches à la fois (ex. `W`+`D`) donne naturellement une
  diagonale.
- **Accélération / décélération progressives** : au lieu de téléporter le
  cube à sa vitesse maximale dès qu'une touche est pressée, on fait
  progresser sa vitesse actuelle vers la vitesse cible avec une interpolation
  (`velocity.lerp(...)`). Touche enfoncée → la vitesse monte progressivement
  vers le maximum (`acceleration`). Touche relâchée → la vitesse redescend
  progressivement vers zéro (`deceleration`). Résultat : un mouvement qui a
  de l'inertie, comme un vrai personnage, plutôt qu'un déplacement robotique.
- **Saut** : une simulation de gravité très simple est appliquée à chaque
  frame (`verticalVelocity += gravity * dt`). Appuyer sur `Espace` donne une
  impulsion verticale (`jumpForce`) — mais seulement si `isGrounded` est vrai,
  c'est-à-dire seulement si le cube est actuellement posé sur le sol. Cela
  empêche de sauter à répétition en plein vol.

## Exercice 3 — Caméra orbit autour du cube (Player)

**Objectif :** une caméra à la troisième personne, façon jeu vidéo, qui
tourne autour du joueur à la souris.

Le composant `orbit-camera.js` positionne la caméra en **coordonnées
sphériques** autour du cube : un azimut (angle horizontal), un angle polaire
(hauteur de vue) et une distance. À chaque frame, on calcule la position
cartésienne de la caméra à partir de ces trois valeurs, puis on l'oriente
vers le cube avec `lookAt`.

- **Suivi automatique** : comme la position de la caméra est recalculée
  chaque frame à partir de la position *actuelle* du cube, elle reste
  toujours centrée dessus, à distance constante, même quand il se déplace.
- **Orbite à la souris** : en maintenant le clic gauche et en bougeant la
  souris, on modifie l'azimut et l'angle polaire visés (`targetAzimuth`,
  `targetPolar`).
- **Zoom à la molette** : la molette change la distance visée
  (`targetDistance`), qui est bornée entre `minDistance` et `maxDistance`
  pour ne jamais coller la caméra au cube ni s'en éloigner trop.
- **Limites d'angle** : l'angle polaire est contraint (`clamp`) entre
  `minPolarDeg` (5°, pour ne jamais passer sous le plan) et `maxPolarDeg`
  (90°, la caméra ne peut pas dépasser la verticale au-dessus du cube).
- **Mouvement fluide** : l'azimut, l'angle polaire et la distance *actuels*
  sont interpolés (`lerp`) vers leurs valeurs *cibles* à chaque frame, plutôt
  qu'appliqués instantanément. C'est ce petit décalage progressif qui rend
  l'orbite et le zoom doux, sans à-coups.

## Exercice 4 — Déplacement du cube en fonction de la caméra

**Objectif :** rendre les contrôles cohérents avec la vue actuelle : `W`
doit toujours faire avancer le joueur « vers l'écran », quelle que soit
l'orientation de la caméra.

On réutilise exactement le même composant `wasd-jump-movement.js` que dans
les exercices précédents, mais avec l'option `cameraRelative: true` et une
référence vers la caméra (`cameraEl: #mainCamera`). Le changement se situe
uniquement dans le calcul de la direction :

1. On récupère le vecteur « avant » de la caméra (`getWorldDirection`), puis
   on annule sa composante verticale (`camForward.y = 0`) : on ne veut pas
   que le cube s'enfonce dans le sol ou décolle simplement parce qu'on
   regarde vers le haut ou le bas.
2. Le vecteur « droite » de la caméra est obtenu par un produit vectoriel
   entre ce vecteur avant et l'axe vertical (`Y`).
3. La direction finale de déplacement est une combinaison de ces deux
   vecteurs, pondérée par les touches pressées (`W`/`S` sur l'axe avant,
   `A`/`D` sur l'axe droite).

Tout le reste (accélération, décélération, saut) fonctionne exactement comme
avant : seule la *direction* du déplacement change de repère (monde → caméra).

## Exercice 5 — Déplacement du cube avec aframe-physics-system

**Objectif :** remplacer notre simulation « maison » de gravité par un vrai
moteur physique.

La scène ajoute l'attribut `physics="gravity: -9.8"` sur `<a-scene>`, ce qui
active [aframe-physics-system](https://github.com/c-frame/aframe-physics-system)
(basé sur cannon.js). Le sol devient un `static-body` (immobile, sert
uniquement de support) et le cube devient un `dynamic-body` (mass, soumis à
la gravité et aux collisions).

Le composant `physics-movement.js` pilote alors le cube en manipulant
directement son **corps physique** (`this.el.body`), plutôt que sa position :

- **Déplacement** : on fixe directement `body.velocity.x` et
  `body.velocity.z` selon les touches pressées. Le moteur physique se charge
  ensuite d'intégrer cette vitesse dans la position à chaque pas de
  simulation.
- **Saut** : uniquement si `isGrounded` est vrai, on impose
  `body.velocity.y = jumpForce`. La détection du sol se fait via
  l'évènement `collide` émis par le moteur physique : on regarde si la
  normale de contact est à peu près verticale (`|contact.ni.y| > 0.5`), ce
  qui signifie qu'on touche une surface horizontale sous les pieds (et pas,
  par exemple, un mur sur le côté).
- **Stabilité lors des collisions** : par défaut, un corps physique heurté
  sur un coin peut se mettre à basculer/tourner de façon non désirée. On
  active `body.fixedRotation = true` dès que le corps physique est prêt
  (évènement `body-loaded`) : les collisions n'appliquent alors plus aucun
  couple de rotation au cube, qui reste toujours parfaitement droit, quels
  que soient les chocs reçus.

## Exercice 6 — Système de collisions avec aframe-physics-system

**Objectif :** vérifier que plusieurs objets physiques interagissent de
façon crédible entre eux.

Six cubes supplémentaires sont ajoutés en cercle autour du joueur, chacun
avec un `dynamic-body` (même type de corps physique que le joueur : masse,
amortissement linéaire/angulaire). Comme ils partagent le même moteur
physique (cannon.js, activé une seule fois au niveau de `<a-scene>`), ils :

- tombent sous l'effet de la gravité jusqu'à toucher le sol (`static-body`
  du plan) ;
- se poussent, glissent et rebondissent de façon cohérente quand le joueur
  fonce dedans, ou quand ils se touchent entre eux ;
- conservent leur propre masse et amortissement, donc réagissent de façon
  légèrement différente du cube joueur (plus léger, ils sont plus facilement
  déplacés).

Aucune logique de collision « à la main » n'est nécessaire ici : c'est le
moteur physique qui calcule les réponses aux impacts (positions, vitesses,
rotations) à chaque pas de simulation.

## Notes techniques transverses

- **A-Frame** est chargé depuis le CDN officiel
  (`https://aframe.io/releases/1.5.0/aframe.min.js`).
- **aframe-physics-system** (exercices 5 et 6) est chargé depuis jsDelivr
  (`aframe-physics-system@4.0.2`). Si ce lien CDN devient indisponible,
  toute version récente du paquet
  [`aframe-physics-system`](https://www.npmjs.com/package/aframe-physics-system)
  fonctionne de la même façon.
- Les composants sont volontairement **réutilisés d'un exercice à l'autre**
  (`wasd-jump-movement`, `orbit-camera`) plutôt que dupliqués, pour bien
  montrer que chaque exercice *fait évoluer* le précédent (ex. l'exercice 4
  ne fait qu'activer l'option `cameraRelative` du composant de l'exercice 2).
- **Sol physique en `<a-box>` plutôt qu'`<a-plane>` (exercices 5 et 6)** :
  la géométrie d'un `<a-plane>` n'a aucune épaisseur. Quand
  aframe-physics-system essaie d'en déduire un collider `box`, il obtient
  une boîte totalement plate (profondeur nulle), ce que le moteur physique
  ne détecte pas correctement : les objets tombent alors à travers le sol.
  Un `<a-box>` très fin (0.2 de hauteur) résout le problème tout en restant
  visuellement identique à un sol plat.
- **Détection du contact au sol par frame plutôt que par minuteur** : un
  corps physique en appui stable ne redéclenche pas forcément l'évènement
  `collide` à chaque frame. `physics-movement.js` interroge donc directement
  les contacts actifs du moteur (`system.driver.getContacts()`) à chaque
  tick pour savoir si le cube touche une surface sous lui, ce qui reste fiable
  même après un long temps d'appui immobile.
- **`lookAt` sur l'entité caméra vs sur l'objet `THREE.Camera`** :
  `object3D.lookAt()` et `object3D.getWorldDirection()` de three.js suivent
  une convention différente selon qu'ils sont appelés sur une vraie
  `THREE.Camera` (axe -Z = direction regardée) ou sur un objet générique
  (axe +Z). Comme l'entité A-Frame elle-même est un objet générique (la
  vraie caméra est un enfant interne), `orbit-camera.js` construit sa
  rotation à la main (`THREE.Matrix4.lookAt`) pour suivre la convention
  caméra, et `wasd-jump-movement.js` interroge `cameraEl.getObject3D('camera')`
  plutôt que `cameraEl.object3D` pour obtenir la bonne direction « avant ».
