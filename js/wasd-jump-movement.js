/**
 * Composant A-Frame : déplacement WASD avec accélération/décélération
 * progressives et saut (Espace), utilisé aux exercices 2, 3 et 4.
 *
 * - cameraRelative=false (ex.2, ex.3) : W/A/S/D déplacent le cube selon les
 *   axes fixes du monde (Z et X).
 * - cameraRelative=true (ex.4) : W/A/S/D déplacent le cube selon
 *   l'orientation horizontale actuelle de la caméra passée en `cameraEl`.
 */
AFRAME.registerComponent('wasd-jump-movement', {
  schema: {
    speed: { type: 'number', default: 3.2 },
    acceleration: { type: 'number', default: 10 },
    deceleration: { type: 'number', default: 12 },
    jumpForce: { type: 'number', default: 6 },
    gravity: { type: 'number', default: -18 },
    groundY: { type: 'number', default: 0.5 },
    cameraRelative: { type: 'boolean', default: false },
    cameraEl: { type: 'selector' }
  },

  init: function () {
    this.keys = {};
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.spaceWasPressed = false;

    this.onKeyDown = (evt) => { this.keys[evt.code] = true; };
    this.onKeyUp = (evt) => { this.keys[evt.code] = false; };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  },

  remove: function () {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  },

  tick: function (time, delta) {
    if (!delta) return;
    const dt = Math.min(delta / 1000, 0.1);
    const data = this.data;
    const position = this.el.object3D.position;

    // 1. Entrée clavier -> direction souhaitée (-1..1 sur x et z)
    let inputX = 0;
    let inputZ = 0;
    if (this.keys['KeyW']) inputZ -= 1;
    if (this.keys['KeyS']) inputZ += 1;
    if (this.keys['KeyA']) inputX -= 1;
    if (this.keys['KeyD']) inputX += 1;

    let moveDir = new THREE.Vector3(inputX, 0, inputZ);

    if (data.cameraRelative && data.cameraEl) {
      // Vecteur "avant" de la caméra projeté sur le plan horizontal.
      // Important : on interroge l'objet THREE.Camera réel (via
      // getObject3D('camera')), pas l'object3D générique de l'entité.
      // THREE.Camera.getWorldDirection() renvoie l'axe -Z (convention
      // caméra) alors que Object3D.getWorldDirection() renvoie l'axe +Z
      // (convention "objet"/maillage) : appeler la version générique sur
      // l'entité donnerait la direction strictement opposée à la vue réelle.
      const camForward = new THREE.Vector3();
      const cameraObject = data.cameraEl.getObject3D('camera') || data.cameraEl.object3D;
      cameraObject.getWorldDirection(camForward);
      camForward.y = 0;
      if (camForward.lengthSq() > 0) camForward.normalize();

      const camRight = new THREE.Vector3();
      camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).negate();

      moveDir = new THREE.Vector3();
      moveDir.addScaledVector(camForward, -inputZ); // W = vers l'avant caméra
      moveDir.addScaledVector(camRight, inputX);     // D = vers la droite caméra
    }

    const hasInput = moveDir.lengthSq() > 0.0001;
    if (hasInput) moveDir.normalize();

    const targetVelocity = moveDir.multiplyScalar(data.speed);

    // 2. Accélération / décélération progressive (interpolation exponentielle)
    if (hasInput) {
      const lerpFactor = Math.min(1, data.acceleration * dt);
      this.velocity.lerp(targetVelocity, lerpFactor);
    } else {
      const lerpFactor = Math.min(1, data.deceleration * dt);
      this.velocity.lerp(new THREE.Vector3(0, 0, 0), lerpFactor);
    }

    // 3. Saut (front montant sur Espace, uniquement si le cube touche le sol)
    const spaceIsPressed = !!this.keys['Space'];
    if (spaceIsPressed && !this.spaceWasPressed && this.isGrounded) {
      this.verticalVelocity = data.jumpForce;
      this.isGrounded = false;
    }
    this.spaceWasPressed = spaceIsPressed;

    // 4. Gravité + intégration verticale
    this.verticalVelocity += data.gravity * dt;
    let newY = position.y + this.verticalVelocity * dt;
    if (newY <= data.groundY) {
      newY = data.groundY;
      this.verticalVelocity = 0;
      this.isGrounded = true;
    }

    // 5. Intégration horizontale + application de la position finale
    position.x += this.velocity.x * dt;
    position.z += this.velocity.z * dt;
    position.y = newY;
  }
});
