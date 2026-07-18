// CINZA — first-person survivor: movement, health, plank melee, bricks, flashlight.
import * as THREE from 'three';

const EYE_HEIGHT = 1.68;
const RADIUS = 0.42;
const WALK = 3.9;
const RUN = 7.0;
const GRAVITY = 22;

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
    this.hurtT = 0;

    this.thrownBricks = [];
    this.onBrickLand = null;
    this.onSplash = null;
    this.stepAccum = 0;
    this.running = false;

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

  takeDamage(dmg) {
    if (this.health <= 0) return;
    this.health -= dmg;
    this.hurtT = 0.5;
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
  }

  update(dt, scene, enemies = []) {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    this.hurtT = Math.max(0, this.hurtT - dt);
    this.running = false;

    if (this.canControl) {
      const run = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
      const speed = run ? RUN : WALK;
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
        const stride = run ? 2.6 : 1.9;
        if (this.stepAccum > stride && this.grounded) {
          this.stepAccum = 0;
          this.audio?.play('step');
        }
      }
    }

    this.resolveCollisions(this.position);

    const ground = this.groundHeightAt(this.position.x, this.position.z, this.position.y);
    const targetY = ground !== null ? ground + EYE_HEIGHT : null;
    if (targetY !== null && this.position.y <= targetY + 0.25 && this.velY <= 0) {
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

    // head bob + hurt shake
    let bob = 0;
    if (this.moving && this.grounded) {
      this.bobT = (this.bobT || 0) + dt * (this.running ? 11 : 8);
      bob = Math.sin(this.bobT) * 0.045;
    }
    const shake = this.hurtT > 0 ? Math.sin(this.hurtT * 60) * 0.02 * this.hurtT : 0;
    this.camera.position.set(this.position.x + shake, this.position.y + bob, this.position.z);

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
