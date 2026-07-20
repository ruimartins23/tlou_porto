// CINZA — first-person survivor: movement, health, plank melee, bricks, flashlight.
import * as THREE from 'three';

// crafting recipes — components are scavenged; two of them (alcohol, rag) are shared
// across recipes, so every craft is a real choice (TLOU resource tension).
export const COMPONENTS = ['rag', 'alcohol', 'blade', 'scrap'];
export const RECIPES = [
  { id: 'bandage', out: 'bandages', need: { rag: 1, alcohol: 1 } },
  { id: 'molotov', out: 'molotovs', need: { alcohol: 1, scrap: 1 } },
  { id: 'shiv',    out: 'shivs',    need: { blade: 1, rag: 1 } },
];

const EYE_HEIGHT = 1.68;
const RADIUS = 0.42;
const WALK = 3.9;
const RUN = 7.0;
const CROUCH = 2.5;
const GRAVITY = 22;
// sprint stamina — generous enough for traversal bursts, but a marathon flee runs you dry
const STAM_DRAIN = 15;   // per second while sprinting
const STAM_REGEN = 20;   // per second while recovering
const STAM_RECOVER = 28; // must reach this before you can sprint again after bottoming out

export class Player {
  constructor(camera, world, audio) {
    this.camera = camera;
    this.world = world;
    this.audio = audio;

    this.position = new THREE.Vector3(-52, EYE_HEIGHT, 10);
    this.velY = 0;
    this.yaw = 2.6;
    this.pitch = 0;
    this.grounded = true;
    this.enabled = false;
    this.frozen = false;
    this.uiBlocked = null;
    this.lastSafe = this.position.clone();
    this.keys = {};

    // survival state
    this.health = 100;
    this.maxHealth = 100;
    this.bandages = 1;
    this.bricks = 0;
    this.shivs = 0;
    this.components = { rag: 0, alcohol: 0, blade: 0, scrap: 0 };
    this.hurtT = 0;

    this.thrownBricks = [];
    this.molotovs = 0;
    this.thrownMolotovs = [];
    this.fires = [];           // active fire pools
    this.onBrickLand = null;
    this.onMolotovLand = null;
    this.onSplash = null;
    this.stepAccum = 0;
    this.running = false;
    this.crouching = false;
    this.crouchBlend = 0;
    // sprint stamina
    this.stamina = 100;
    this.maxStamina = 100;
    this.staminaLock = false;   // true once drained — forces a rest before you can sprint again
    this.staminaRest = 0;       // short delay before regen kicks in
    // camera shake (impacts, damage, nearby gunfire)
    this.shakeMag = 0;
    this._shakeOsc = 0;

    this.downRay = new THREE.Raycaster();
    this.downRay.far = 60;

    // flashlight
    this.torchOn = false;
    this.torch = new THREE.SpotLight(0xfff2d8, 0, 34, 0.46, 0.45, 1.4);
    this.torchTarget = new THREE.Object3D();
    camera.parent === null && (camera.matrixAutoUpdate = true);
    this.torch.castShadow = false;
    world.scene.add(this.torch, this.torchTarget);
    this.torch.target = this.torchTarget;

    document.addEventListener('mousemove', (e) => {
      if (!this.canControl) return;
      this.yaw -= e.movementX * 0.0023;
      this.pitch -= e.movementY * 0.0023;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    });
    document.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
  }

  get canControl() {
    return this.enabled && !this.frozen && !(this.uiBlocked && this.uiBlocked());
  }

  get moving() {
    return this.canControl &&
      (this.keys['KeyW'] || this.keys['KeyA'] || this.keys['KeyS'] || this.keys['KeyD']);
  }

  setTorch(on) {
    this.torchOn = on;
    this.audio?.play('click');
  }

  heal() {
    if (this.bandages <= 0 || this.health >= this.maxHealth || !this.canControl) return false;
    this.bandages--;
    this.health = Math.min(this.maxHealth, this.health + 45);
    this.audio?.play('bandage');
    return true;
  }

  // ---- crafting ----
  canCraft(id) {
    const r = RECIPES.find((x) => x.id === id);
    return !!r && Object.entries(r.need).every(([k, v]) => (this.components[k] || 0) >= v);
  }

  craft(id) {
    if (!this.canCraft(id)) return false;
    const r = RECIPES.find((x) => x.id === id);
    for (const [k, v] of Object.entries(r.need)) this.components[k] -= v;
    this[r.out]++;                 // bandages / molotovs / shivs
    this.audio?.play('craft');
    return true;
  }

  addComponent(kind, n = 1) { this.components[kind] = (this.components[kind] || 0) + n; }

  // a jolt to the camera — call on impacts, damage, nearby blasts
  shake(mag) { this.shakeMag = Math.min(0.32, this.shakeMag + mag); }

  takeDamage(dmg) {
    if (this.health <= 0) return;
    this.health -= dmg;
    this.hurtT = 0.5;
    this.shake(0.14);
    this.audio?.play('hurt');
  }

  throwBrick(scene) {
    if (this.bricks <= 0 || !this.canControl) return false;
    this.bricks--;
    const dir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch) + 0.22,
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.1, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x7a4a38, roughness: 1 })
    );
    mesh.position.copy(this.position).addScaledVector(dir, 0.6);
    mesh.castShadow = true;
    scene.add(mesh);
    this.thrownBricks.push({ mesh, vel: dir.multiplyScalar(13.5), alive: true, spin: Math.random() * 4 });
    this.audio?.play('throw');
    return true;
  }

  throwMolotov(scene) {
    if (this.molotovs <= 0 || !this.canControl) return false;
    this.molotovs--;
    const dir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch) + 0.26,
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();
    const grp = new THREE.Group();
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0x2f5238, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.8 }));
    const rag = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffb050 }));
    rag.position.y = 0.15;
    grp.add(bottle, rag);
    const flame = new THREE.PointLight(0xff7a20, 5, 6, 2);
    flame.position.y = 0.18;
    grp.add(flame);
    grp.position.copy(this.position).addScaledVector(dir, 0.6);
    scene.add(grp);
    this.thrownMolotovs.push({ mesh: grp, vel: dir.multiplyScalar(12.5), alive: true, spin: Math.random() * 6 });
    this.audio?.play('throw');
    return true;
  }

  // shatter → a pool of fire that burns anything standing in it
  igniteFire(scene, pos) {
    this.audio?.play('molotov', pos.clone());
    const grp = new THREE.Group();
    grp.position.copy(pos);
    const sprites = [];
    for (let i = 0; i < 12; i++) {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.world.glowTex, color: i % 2 ? 0xff5a12 : 0xffc248,
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9,
      }));
      const a = Math.random() * Math.PI * 2, r = Math.random() * 1.7;
      spr.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
      spr.scale.setScalar(0.9 + Math.random() * 1.0);
      spr.userData = { ph: Math.random() * 6, r, spd: 0.5 + Math.random() * 0.7 };
      grp.add(spr); sprites.push(spr);
    }
    const light = new THREE.PointLight(0xff6820, 30, 15, 2);
    light.position.y = 1.1;
    grp.add(light);
    scene.add(grp);
    this.fires.push({ grp, sprites, light, pos: pos.clone(), t: 0, life: 5.0, radius: 3.3, dmgT: 0 });
    if (this.onMolotovLand) this.onMolotovLand(pos.clone());   // loud — wakes/draws the block
  }

  groundHeightAt(x, z, fromY) {
    this.downRay.set(new THREE.Vector3(x, fromY + 0.1, z), new THREE.Vector3(0, -1, 0));
    const hits = this.downRay.intersectObjects(this.world.walkables, false);
    if (hits.length > 0) return hits[0].point.y;
    return null;
  }

  resolveCollisions(pos) {
    const footY = pos.y - EYE_HEIGHT;
    const headY = pos.y + 0.1;
    for (let pass = 0; pass < 3; pass++) {
      for (const s of this.world.solids) {
        if (footY + 0.35 > s.y2 || headY < s.y1) continue;
        const cx = Math.max(s.x1, Math.min(pos.x, s.x2));
        const cz = Math.max(s.z1, Math.min(pos.z, s.z2));
        const dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < RADIUS * RADIUS) {
          const d = Math.sqrt(Math.max(d2, 1e-8));
          if (d > 1e-4) {
            const push = (RADIUS - d) / d;
            pos.x += dx * push;
            pos.z += dz * push;
          } else {
            const pens = [
              [pos.x - s.x1 + RADIUS, -1, 0], [s.x2 - pos.x + RADIUS, 1, 0],
              [pos.z - s.z1 + RADIUS, 0, -1], [s.z2 - pos.z + RADIUS, 0, 1],
            ];
            pens.sort((a, b) => a[0] - b[0]);
            const [pen, px, pz] = pens[0];
            pos.x += px * pen;
            pos.z += pz * pen;
          }
        }
      }
    }
  }

  updateBricks(dt, scene, enemies) {
    for (const b of this.thrownBricks) {
      if (!b.alive) continue;
      b.vel.y -= GRAVITY * 0.85 * dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += b.spin * dt;
      b.mesh.rotation.z += b.spin * 0.7 * dt;
      const p = b.mesh.position;
      // direct hit on an enemy
      for (const e of enemies) {
        if (!e.active || e.dead) continue;
        const ep = e.group.position;
        if (Math.hypot(p.x - ep.x, p.z - ep.z) < 0.55 && p.y > ep.y && p.y < ep.y + 1.9) {
          b.alive = false;
          e.takeHit(15, b.vel.clone().setY(0).normalize(), { stun: 2.4 });
          this.audio?.play('brickHit');
          setTimeout(() => scene.remove(b.mesh), 8000);
          break;
        }
      }
      if (!b.alive) continue;
      const ground = this.groundHeightAt(p.x, p.z, p.y) ?? -2;
      if (p.y <= ground + 0.08 || p.y < -1.8) {
        b.alive = false;
        p.y = Math.max(ground + 0.06, -1.9);
        this.audio?.play('brickLand');
        if (this.onBrickLand) this.onBrickLand(p.clone());
        setTimeout(() => scene.remove(b.mesh), 12000);
      }
    }
    this.thrownBricks = this.thrownBricks.filter((b) => b.alive || b.mesh.parent);

    // molotovs in flight — shatter into fire on any enemy or the ground
    for (const m of this.thrownMolotovs) {
      if (!m.alive) continue;
      m.vel.y -= GRAVITY * 0.85 * dt;
      m.mesh.position.addScaledVector(m.vel, dt);
      m.mesh.rotation.x += m.spin * dt;
      const p = m.mesh.position;
      let hitEnemy = false;
      for (const e of enemies) {
        if (!e.active || e.dead) continue;
        const ep = e.group.position;
        if (Math.hypot(p.x - ep.x, p.z - ep.z) < 0.7 && p.y > ep.y && p.y < ep.y + 2) { hitEnemy = true; break; }
      }
      const gy = this.groundHeightAt(p.x, p.z, p.y) ?? -2;
      if (hitEnemy || p.y <= gy + 0.1 || p.y < -1.8) {
        m.alive = false;
        scene.remove(m.mesh);
        this.igniteFire(scene, new THREE.Vector3(p.x, Math.max(gy, Math.min(p.y, gy + 0.1)), p.z));
      }
    }
    this.thrownMolotovs = this.thrownMolotovs.filter((m) => m.alive);

    // burning fire pools — animate flames + deal damage over time to anything inside
    for (const f of this.fires) {
      f.t += dt;
      const fade = Math.min(1, f.t / 0.3) * Math.min(1, Math.max(0, f.life - f.t) / 0.8);
      f.light.intensity = (24 + Math.sin(f.t * 34) * 8) * fade;
      for (const spr of f.sprites) {
        const u = spr.userData;
        spr.position.y = 0.2 + Math.abs(Math.sin(f.t * 6 * u.spd + u.ph)) * 0.9;
        spr.material.opacity = 0.85 * fade;
        spr.material.rotation += dt * 2.5;
      }
      f.dmgT += dt;
      if (f.dmgT >= 0.4) {
        f.dmgT = 0;
        for (const e of enemies) {
          if (!e.active || e.dead) continue;
          const ep = e.group.position;
          if (Math.hypot(ep.x - f.pos.x, ep.z - f.pos.z) < f.radius && Math.abs(ep.y - f.pos.y) < 2.5) {
            const away = new THREE.Vector3(ep.x - f.pos.x, 0, ep.z - f.pos.z).normalize();
            e.takeHit(20, away, { stun: 0.15, silent: true });
          }
        }
      }
      if (f.t >= f.life) { scene.remove(f.grp); f.done = true; }
    }
    this.fires = this.fires.filter((f) => !f.done);
  }

  update(dt, scene, enemies = []) {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    this.hurtT = Math.max(0, this.hurtT - dt);
    this.running = false;
    this.crouching = false;

    if (this.canControl) {
      // crouch is bound to C, not Ctrl — Ctrl+W would close the browser tab
      const crouchKey = this.keys['KeyC'];
      const wantRun = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !crouchKey && !this.focusing;
      const run = wantRun && !this.staminaLock && this.stamina > 0;   // no sprint on an empty tank
      this.crouching = !!crouchKey && this.grounded && !run;
      // focusing (listen mode) slows you to a careful creep
      let speed = run ? RUN : this.crouching ? CROUCH : WALK;
      if (this.focusing) speed = Math.min(speed, CROUCH);
      const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const r = new THREE.Vector3(-f.z, 0, f.x);
      const move = new THREE.Vector3();
      if (this.keys['KeyW']) move.add(f);
      if (this.keys['KeyS']) move.sub(f);
      if (this.keys['KeyD']) move.add(r);
      if (this.keys['KeyA']) move.sub(r);
      if (move.lengthSq() > 0) {
        this.running = run;
        move.normalize().multiplyScalar(speed * dt);
        this.position.x += move.x;
        this.position.z += move.z;
        this.stepAccum += move.length();
        // crouch = long, near-silent stride; run = short, loud
        const stride = run ? 2.6 : this.crouching ? 2.4 : 1.9;
        if (this.stepAccum > stride && this.grounded) {
          this.stepAccum = 0;
          this.audio?.play(run ? 'stepRun' : this.crouching ? 'stepCrouch' : 'step');
        }
      }
    }
    this.crouchBlend += ((this.crouching ? 1 : 0) - this.crouchBlend) * Math.min(1, dt * 11);

    // stamina: sprinting burns it, everything else recovers it (after a beat)
    if (this.running) {
      this.stamina = Math.max(0, this.stamina - STAM_DRAIN * dt);
      this.staminaRest = 0.5;
      if (this.stamina <= 0) this.staminaLock = true;
    } else {
      this.staminaRest = Math.max(0, this.staminaRest - dt);
      if (this.staminaRest <= 0) this.stamina = Math.min(this.maxStamina, this.stamina + STAM_REGEN * dt);
      if (this.staminaLock && this.stamina >= STAM_RECOVER) this.staminaLock = false;
    }

    this.resolveCollisions(this.position);

    const ground = this.groundHeightAt(this.position.x, this.position.z, this.position.y);
    const targetY = ground !== null ? ground + EYE_HEIGHT : null;
    if (targetY !== null && this.position.y <= targetY + 0.25 && this.velY <= 0) {
      // landing from a fall — thud scaled to impact
      if (!this.grounded && this.velY < -6) this.audio?.play('land');
      this.position.y += (targetY - this.position.y) * Math.min(1, dt * 18);
      if (Math.abs(targetY - this.position.y) < 0.02) this.position.y = targetY;
      this.velY = 0;
      this.grounded = true;
      this.lastSafe.set(this.position.x, this.position.y, this.position.z);
    } else {
      this.grounded = false;
      this.velY -= GRAVITY * dt;
      this.position.y += this.velY * dt;
    }

    // the Douro is not survivable at night, but we fish you out
    if (this.position.y < -1.0) {
      this.audio?.play('splash');
      if (this.onSplash) this.onSplash();
      this.position.copy(this.lastSafe);
      if (this.position.z > 28 && this.position.z < 32) this.position.z = 27;
      if (this.position.z > 98 && this.position.z < 102) this.position.z = 103;
      this.velY = 0;
    }

    this.updateBricks(dt, scene, enemies);

    // head bob + hurt shake + impact shake + crouch dip
    let bob = 0;
    if (this.moving && this.grounded) {
      this.bobT = (this.bobT || 0) + dt * (this.running ? 11 : this.crouching ? 5 : 8);
      bob = Math.sin(this.bobT) * (this.crouching ? 0.02 : 0.045);
    }
    const hurt = this.hurtT > 0 ? Math.sin(this.hurtT * 60) * 0.02 * this.hurtT : 0;
    this._shakeOsc += dt * 46;
    this.shakeMag = Math.max(0, this.shakeMag - dt * 1.5);
    const shx = hurt + Math.sin(this._shakeOsc) * this.shakeMag;
    const shy = Math.cos(this._shakeOsc * 1.27) * this.shakeMag;
    const crouchDip = this.crouchBlend * 0.52;
    this.camera.position.set(this.position.x + shx, this.position.y + bob - crouchDip + shy, this.position.z);

    // flashlight follows the view — origin pushed forward so the view-model
    // weapon never sits point-blank inside the cone
    this.torch.intensity = this.torchOn ? 200 : 0;
    const fwd = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );
    this.torch.position.copy(this.camera.position).addScaledVector(fwd, 0.85);
    this.torchTarget.position.copy(this.camera.position).addScaledVector(fwd, 10);
  }

  teleport(x, y, z, yaw = null) {
    this.position.set(x, y + EYE_HEIGHT, z);
    this.velY = 0;
    if (yaw !== null) this.yaw = yaw;
    this.lastSafe.copy(this.position);
  }

  forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
}
