/**
 * Composant A-Frame : déplacement du cube joueur via aframe-physics-system
 * (exercices 5 et 6).
 *
 * - W/A/S/D imposent une vitesse horizontale directement sur le corps
 *   physique (dynamic-body) du cube.
 * - Espace fait sauter le cube uniquement s'il est actuellement en contact
 *   avec une surface sous lui (détecté à chaque frame via les contacts actifs
 *   du moteur physique et leur normale).
 * - `fixedRotation` est activé sur le corps physique dès qu'il est prêt afin
 *   que les collisions n'appliquent aucun couple : le cube reste stable et
 *   ne bascule pas lors des impacts.
 */
AFRAME.registerComponent('physics-movement', {
  schema: {
    speed: { type: 'number', default: 3 },
    jumpForce: { type: 'number', default: 5.5 }
  },

  init: function () {
    this.keys = {};
    this.spaceWasPressed = false;
    this.isGrounded = false;

    this.onKeyDown = (evt) => { this.keys[evt.code] = true; };
    this.onKeyUp = (evt) => { this.keys[evt.code] = false; };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // fixedRotation empêche les couples de collision de faire basculer le
    // cube : il reste toujours "debout", quels que soient les impacts reçus.
    this.el.addEventListener('body-loaded', () => {
      const body = this.el.body;
      if (body) {
        body.fixedRotation = true;
        body.updateMassProperties();
      }
    });
  },

  remove: function () {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  },

  /**
   * Un corps posé en équilibre (contact permanent) ne redéclenche pas
   * forcément l'évènement `collide` à chaque frame : on interroge donc
   * directement les contacts actifs du moteur physique à chaque tick,
   * plutôt que de s'appuyer sur un évènement + minuteur, qui « oublierait »
   * un contact stable au bout de quelques centaines de millisecondes.
   */
  isTouchingGroundBelow: function (body) {
    const system = this.el.sceneEl.systems.physics;
    if (!system || !system.driver || typeof system.driver.getContacts !== 'function') return false;

    const contacts = system.driver.getContacts();
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      if (contact.bi !== body && contact.bj !== body) continue;
      // ni pointe hors de bi : on l'inverse si notre corps est bj.
      const normalY = contact.bi === body ? contact.ni.y : -contact.ni.y;
      if (Math.abs(normalY) > 0.5) return true;
    }
    return false;
  },

  tick: function () {
    const body = this.el.body;
    if (!body) return;

    this.isGrounded = this.isTouchingGroundBelow(body);

    let inputX = 0;
    let inputZ = 0;
    if (this.keys['KeyW']) inputZ -= 1;
    if (this.keys['KeyS']) inputZ += 1;
    if (this.keys['KeyA']) inputX -= 1;
    if (this.keys['KeyD']) inputX += 1;

    const dir = new THREE.Vector3(inputX, 0, inputZ);
    if (dir.lengthSq() > 0) dir.normalize();

    body.velocity.x = dir.x * this.data.speed;
    body.velocity.z = dir.z * this.data.speed;

    const spaceIsPressed = !!this.keys['Space'];
    if (spaceIsPressed && !this.spaceWasPressed && this.isGrounded) {
      body.velocity.y = this.data.jumpForce;
      this.isGrounded = false;
    }
    this.spaceWasPressed = spaceIsPressed;
  }
});
