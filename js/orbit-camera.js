/**
 * Composant A-Frame : caméra en orbite autour d'une cible (le cube joueur).
 * Utilisé aux exercices 3 et 4.
 *
 * - Clic gauche maintenu + déplacement souris -> orbite (azimut/hauteur).
 * - Molette -> zoom avant/arrière, borné entre minDistance et maxDistance.
 * - La hauteur de vue (angle polaire) est bornée pour empêcher de passer
 *   sous le sol et pour ne pas dépasser la vue du dessus (90°).
 * - Toutes les valeurs sont lissées (lerp) pour un mouvement fluide.
 */
var lookAtMatrix = new THREE.Matrix4();

AFRAME.registerComponent('orbit-camera', {
  schema: {
    target: { type: 'selector' },
    distance: { type: 'number', default: 6 },
    minDistance: { type: 'number', default: 2.5 },
    maxDistance: { type: 'number', default: 14 },
    minPolarDeg: { type: 'number', default: 5 },   // évite de passer sous le plan
    maxPolarDeg: { type: 'number', default: 90 },  // vue du dessus maximum
    rotateSpeed: { type: 'number', default: 1 },
    zoomSpeed: { type: 'number', default: 1 },
    smoothing: { type: 'number', default: 8 },
    targetHeightOffset: { type: 'number', default: 0.5 }
  },

  init: function () {
    this.azimuth = Math.PI / 4;
    this.polar = THREE.MathUtils.degToRad(30);
    this.currentDistance = this.data.distance;

    this.targetAzimuth = this.azimuth;
    this.targetPolar = this.polar;
    this.targetDistance = this.currentDistance;

    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;

    this.onMouseDown = (evt) => {
      if (evt.button !== 0) return;
      this.isDragging = true;
      this.lastX = evt.clientX;
      this.lastY = evt.clientY;
    };
    this.onMouseUp = (evt) => {
      if (evt.button === 0) this.isDragging = false;
    };
    this.onMouseMove = (evt) => {
      if (!this.isDragging) return;
      const dx = evt.clientX - this.lastX;
      const dy = evt.clientY - this.lastY;
      this.lastX = evt.clientX;
      this.lastY = evt.clientY;

      this.targetAzimuth -= dx * 0.005 * this.data.rotateSpeed;
      this.targetPolar -= dy * 0.005 * this.data.rotateSpeed;

      const minPolar = THREE.MathUtils.degToRad(this.data.minPolarDeg);
      const maxPolar = THREE.MathUtils.degToRad(this.data.maxPolarDeg);
      this.targetPolar = THREE.MathUtils.clamp(this.targetPolar, minPolar, maxPolar);
    };
    this.onWheel = (evt) => {
      evt.preventDefault();
      this.targetDistance += evt.deltaY * 0.01 * this.data.zoomSpeed;
      this.targetDistance = THREE.MathUtils.clamp(
        this.targetDistance, this.data.minDistance, this.data.maxDistance
      );
    };
    this.onContextMenu = (evt) => evt.preventDefault();

    this.attachedCanvas = null;
    this.el.sceneEl.addEventListener('render-target-loaded', () => this.attachListeners());
    if (this.el.sceneEl.canvas) this.attachListeners();
  },

  attachListeners: function () {
    const canvas = this.el.sceneEl.canvas;
    if (!canvas || this.attachedCanvas === canvas) return;
    this.attachedCanvas = canvas;
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);
  },

  remove: function () {
    const canvas = this.attachedCanvas;
    if (canvas) {
      canvas.removeEventListener('mousedown', this.onMouseDown);
      canvas.removeEventListener('wheel', this.onWheel);
      canvas.removeEventListener('contextmenu', this.onContextMenu);
    }
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
  },

  tick: function (time, delta) {
    if (!delta || !this.data.target) return;
    const dt = Math.min(delta / 1000, 0.1);
    const lerpFactor = Math.min(1, this.data.smoothing * dt);

    this.azimuth = THREE.MathUtils.lerp(this.azimuth, this.targetAzimuth, lerpFactor);
    this.polar = THREE.MathUtils.lerp(this.polar, this.targetPolar, lerpFactor);
    this.currentDistance = THREE.MathUtils.lerp(this.currentDistance, this.targetDistance, lerpFactor);

    const targetPos = new THREE.Vector3();
    this.data.target.object3D.getWorldPosition(targetPos);
    targetPos.y += this.data.targetHeightOffset;

    const x = targetPos.x + this.currentDistance * Math.cos(this.polar) * Math.sin(this.azimuth);
    const y = targetPos.y + this.currentDistance * Math.sin(this.polar);
    const z = targetPos.z + this.currentDistance * Math.cos(this.polar) * Math.cos(this.azimuth);

    this.el.object3D.position.set(x, y, z);

    // Note : on n'utilise pas object3D.lookAt() directement ici. Cette
    // méthode oriente différemment un objet générique (comme le groupe
    // englobant de cette entité) et une véritable THREE.Camera : elle
    // suppose alors que l'axe +Z (et non -Z) doit pointer vers la cible,
    // ce qui fait regarder la caméra à l'opposé de ce qui est voulu.
    // THREE.Matrix4.lookAt applique lui la convention "caméra" quel que
    // soit le type d'objet, donc on construit la rotation nous-mêmes.
    lookAtMatrix.lookAt(this.el.object3D.position, targetPos, this.el.object3D.up);
    this.el.object3D.quaternion.setFromRotationMatrix(lookAtMatrix);
  }
});
