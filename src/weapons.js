// CINZA — weapon system: melee plank, revolver, sawn-off shotgun.
// Owns view-models, firing, hitscan, recoil, reload, ammo.
import * as THREE from 'three';

const GUNMETAL = () => new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.42, metalness: 0.85 });
const DARKMETAL = () => new THREE.MeshStandardMaterial({ color: 0x191a1d, roughness: 0.55, metalness: 0.8 });
const WOODGRIP = () => new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.7, metalness: 0.05 });
const BRASS = () => new THREE.MeshStandardMaterial({ color: 0xb8923c, roughness: 0.35, metalness: 0.9 });

function muzzleFlashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,250,220,1)');
  g.addColorStop(0.3, 'rgba(255,200,90,0.85)');
  g.addColorStop(0.7, 'rgba(255,120,40,0.3)');
  g.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  // star spikes
  ctx.strokeStyle = 'rgba(255,240,180,0.9)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(32, 32);
    ctx.lineTo(32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---- view-model builders (parented to camera) ------------------------------
function buildPlank() {
  const g = new THREE.Group();
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.07, 0.5), new THREE.MeshStandardMaterial({ color: 0x6b5233, roughness: 0.9 }));
  plank.position.set(0, 0, -0.18);
  const nail = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.07, 5), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.85, roughness: 0.35 }));
  nail.position.set(0, 0.045, -0.38);
  const nail2 = nail.clone(); nail2.position.set(0.02, 0.04, -0.3);
  g.add(plank, nail, nail2);
  g.userData.rest = { pos: new THREE.Vector3(0.3, -0.32, -0.48), rot: new THREE.Euler(0.28, 0.45, 0.15) };
  return g;
}

function buildRevolver() {
  const g = new THREE.Group();
  const gm = GUNMETAL(), dm = DARKMETAL(), wood = WOODGRIP();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.16), gm);
  frame.position.set(0, 0, -0.05);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.24, 12), gm);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -0.2);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.07, 12), dm);
  cyl.rotation.x = Math.PI / 2;
  cyl.position.set(0, 0, -0.06);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.06), wood);
  grip.position.set(0, -0.08, 0.02);
  grip.rotation.x = -0.35;
  const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.02), dm);
  hammer.position.set(0, 0.05, 0.02);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.015, 0.02), dm);
  sight.position.set(0, 0.05, -0.31);
  g.add(frame, barrel, cyl, grip, hammer, sight);
  g.userData.rest = { pos: new THREE.Vector3(0.16, -0.2, -0.34), rot: new THREE.Euler(0, 0.06, 0) };
  g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.33);
  return g;
}

function buildShotgun() {
  const g = new THREE.Group();
  const gm = GUNMETAL(), dm = DARKMETAL(), wood = WOODGRIP();
  // sawn-off double barrel
  for (const ox of [-0.017, 0.017]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.34, 12), gm);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(ox, 0.01, -0.24);
    g.add(barrel);
  }
  const breech = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.1), dm);
  breech.position.set(0, 0, -0.05);
  const foreWood = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.04, 0.16), wood);
  foreWood.position.set(0, -0.02, -0.2);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.12), wood);
  stock.position.set(0, -0.06, 0.05);
  stock.rotation.x = -0.4;
  g.add(breech, foreWood, stock);
  g.userData.rest = { pos: new THREE.Vector3(0.15, -0.22, -0.3), rot: new THREE.Euler(0, 0.05, 0) };
  g.userData.muzzle = new THREE.Vector3(0, 0.01, -0.42);
  return g;
}

const WEAPONS = {
  plank:    { name: 'Plank',        kind: 'melee',   dmg: 48, range: 2.5, cooldown: 0.5, noise: 4 },
  revolver: { name: 'Revolver',     kind: 'gun',     dmg: 62, range: 90, cooldown: 0.5, noise: 34, pellets: 1, spread: 0.006, mag: 6, kick: 0.055 },
  shotgun:  { name: 'Sawn-off',     kind: 'gun',     dmg: 26, range: 34, cooldown: 0.9, noise: 44, pellets: 8, spread: 0.09, mag: 2, kick: 0.14 },
};

export class WeaponSystem {
  constructor(camera, world, audio, player) {
    this.camera = camera;
    this.world = world;
    this.audio = audio;
    this.player = player;
    this.scene = world.scene;

    this.owned = { plank: false, revolver: false, shotgun: false };
    this.ammoInMag = { revolver: 0, shotgun: 0 };
    this.ammoReserve = { revolver: 0, shotgun: 0 };
    this.active = null;      // key of active weapon
    this.cooldown = 0;
    this.swingT = 1;         // melee anim
    this.recoilT = 0;        // gun anim 0..1 decaying
    this.reloadT = 0;
    this.reloadTarget = 0;
    this.bobT = 0;

    this.ray = new THREE.Raycaster();
    this.flashTex = muzzleFlashTexture();

    // view-models
    this.models = {
      plank: buildPlank(),
      revolver: buildRevolver(),
      shotgun: buildShotgun(),
    };
    for (const k in this.models) {
      this.models[k].visible = false;
      camera.add(this.models[k]);
    }

    // muzzle flash sprite + light (shared)
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
    }));
    this.flash.scale.set(0.5, 0.5, 1);
    this.flash.visible = false;
    camera.add(this.flash);


    this.aiming = false;      // aim-down-sights

    // callbacks set by main
    this.enemies = [];
    this.onNoise = null;      // (worldPos, radius) => void
    this.onHudChange = null;  // () => void
    this.onHit = null;        // (headshot, killed) => void
  }

  give(key, reserveAmmo = 0) {
    this.owned[key] = true;
    const w = WEAPONS[key];
    if (w.kind === 'gun') {
      this.ammoReserve[key] += reserveAmmo;
      // top off the magazine from reserve
      const need = w.mag - this.ammoInMag[key];
      const take = Math.min(need, this.ammoReserve[key]);
      this.ammoInMag[key] += take;
      this.ammoReserve[key] -= take;
    }
    if (!this.active) this.switchTo(key);
    else if (w.kind === 'gun') this.switchTo(key); // auto-equip a newly found gun
    this.onHudChange?.();
  }

  addAmmo(key, rounds) {
    if (!this.owned[key]) return;
    this.ammoReserve[key] += rounds;
    this.onHudChange?.();
  }

  switchTo(key) {
    if (!this.owned[key] || this.active === key) return;
    if (this.reloadT > 0) return;
    this.active = key;
    for (const k in this.models) this.models[k].visible = (k === key);
    const rest = this.models[key].userData.rest;
    this.models[key].position.copy(rest.pos);
    this.models[key].rotation.copy(rest.rot);
    this.cooldown = Math.max(this.cooldown, 0.28);
    this.equipT = 0;          // play the raise-from-hip animation
    this.audio?.play('weaponSwitch');
    this.onHudChange?.();
  }

  cycle(dir) {
    const order = ['plank', 'revolver', 'shotgun'].filter((k) => this.owned[k]);
    if (order.length < 2) return;
    let i = order.indexOf(this.active);
    i = (i + dir + order.length) % order.length;
    this.switchTo(order[i]);
  }

  get activeWeapon() { return this.active ? WEAPONS[this.active] : null; }

  ammoLabel() {
    const w = this.activeWeapon;
    if (!w) return '';
    if (w.kind === 'melee') return '—';
    return `${this.ammoInMag[this.active]} / ${this.ammoReserve[this.active]}`;
  }

  canReload() {
    const w = this.activeWeapon;
    if (!w || w.kind !== 'gun') return false;
    return this.ammoInMag[this.active] < w.mag && this.ammoReserve[this.active] > 0 && this.reloadT <= 0;
  }

  reload() {
    if (!this.canReload()) return false;
    this.reloadTarget = this.active === 'shotgun' ? 1.1 : 1.5;
    this.reloadT = this.reloadTarget;
    this.audio?.play('reloadStart');
    return true;
  }

  finishReload() {
    const w = this.activeWeapon;
    const need = w.mag - this.ammoInMag[this.active];
    const take = Math.min(need, this.ammoReserve[this.active]);
    this.ammoInMag[this.active] += take;
    this.ammoReserve[this.active] -= take;
    this.audio?.play('reloadDone');
    this.onHudChange?.();
  }

  // main fire — routed from mouse click
  fire() {
    if (!this.active || this.cooldown > 0 || this.reloadT > 0) return false;
    const w = this.activeWeapon;
    if (w.kind === 'melee') return this.melee(w);
    return this.shoot(w);
  }

  melee(w) {
    this.cooldown = w.cooldown;
    this.swingT = 0;
    this.audio?.play('swing');
    const fwd = this.forwardVec();
    let hit = false, killed = false;
    for (const e of this.enemies) {
      if (!e.active || e.dead) continue;
      const to = e.group.position.clone(); to.y += 1.1; to.sub(this.player.position);
      const d = to.length();
      if (d < w.range) {
        const flat = new THREE.Vector3(to.x, 0, to.z).normalize();
        // generous arc so hits land where they look like they should
        if (to.normalize().dot(fwd) > 0.3 || d < 1.2) {
          const k = e.takeHit(w.dmg, flat, { stun: 0.42, melee: true });
          const impact = e.group.position.clone(); impact.y += 1.05;
          this.spawnImpact(impact, true);       // blood burst at the strike
          hit = true; killed = killed || k;
        }
      }
    }
    if (hit) {
      this.onHit?.(false, killed);               // crosshair hitmarker
      this.player.shake(killed ? 0.17 : 0.1);    // felt impact
      this.swingHold = 0.05;                      // hit-stick: plank "connects" and holds a beat
      this.audio?.play('meleeConnect');
    }
    // melee is quiet — only a soft noise
    if (this.onNoise) this.onNoise(this.player.position.clone(), w.noise);
    return hit;
  }

  // any live enemy inside the plank's reach & arc right now? (drives the crosshair cue)
  meleeReady() {
    const w = this.activeWeapon;
    if (!w || w.kind !== 'melee') return false;
    const fwd = this.forwardVec();
    for (const e of this.enemies) {
      if (!e.active || e.dead) continue;
      const to = e.group.position.clone(); to.y += 1.1; to.sub(this.player.position);
      const d = to.length();
      if (d < w.range && (to.normalize().dot(fwd) > 0.28 || d < 1.2)) return true;
    }
    return false;
  }

  shoot(w) {
    if (this.ammoInMag[this.active] <= 0) {
      this.audio?.play('dryFire');
      this.cooldown = 0.25;
      // auto-reload if we have reserve
      if (this.ammoReserve[this.active] > 0) this.reload();
      return false;
    }
    this.ammoInMag[this.active]--;
    this.cooldown = w.cooldown;
    this.recoilT = 1;
    this.audio?.play(this.active === 'shotgun' ? 'shotgunFire' : 'revolverFire');

    // Aim is sampled BEFORE recoil — the shot goes where you were pointing, not where the
    // gun kicked to. (Kicking first made every bullet land high by the full kick angle.)
    const origin = this.camera.position.clone();
    const baseFwd = this.forwardVec();

    // recoil kick to aim (applies to the *next* shot)
    this.player.pitch = Math.min(1.45, this.player.pitch + w.kick);
    this.player.yaw += (Math.random() - 0.5) * w.kick * 0.5;

    // muzzle flash
    this.showFlash(w);

    // hitscan pellets — aiming down sights tightens the spread sharply
    const spread = w.spread * (this.aiming ? 0.28 : 1);
    for (let p = 0; p < w.pellets; p++) {
      const dir = baseFwd.clone();
      dir.x += (Math.random() - 0.5) * spread * 2;
      dir.y += (Math.random() - 0.5) * spread * 2;
      dir.z += (Math.random() - 0.5) * spread * 2;
      dir.normalize();
      this.castPellet(origin, dir, w);
    }

    // gunshots are LOUD — every infected in earshot converges
    if (this.onNoise) this.onNoise(this.player.position.clone(), w.noise);
    this.onHudChange?.();

    if (this.ammoInMag[this.active] <= 0 && this.ammoReserve[this.active] > 0) {
      // leave empty; player reloads with R (or auto next shot)
    }
    return true;
  }

  castPellet(origin, dir, w) {
    // wall distance first
    this.ray.set(origin, dir);
    this.ray.far = w.range;
    const wallHits = this.ray.intersectObjects(this.world.occluders, false);
    const wallDist = wallHits.length > 0 ? wallHits[0].distance : w.range;

    // nearest enemy within wallDist — head sphere (smaller, higher reward) + torso.
    let best = null, bestT = wallDist, bestHead = false;
    for (const e of this.enemies) {
      if (!e.active || e.dead) continue;
      // head: tighter sphere; torso: broad
      const spheres = [[1.58, 0.34, true], [1.0, 0.64, false]];
      for (const [cy, R, head] of spheres) {
        const c = e.group.position.clone(); c.y += cy;
        const oc = origin.clone().sub(c);
        const b = oc.dot(dir);
        const cc = oc.dot(oc) - R * R;
        const disc = b * b - cc;
        if (disc < 0) continue;
        const t = -b - Math.sqrt(disc);
        if (t > 0.4 && t < bestT) { bestT = t; best = e; bestHead = head; }
      }
    }
    if (best) {
      let dmg = w.dmg * (this.active === 'shotgun' ? (1 - Math.min(1, bestT / w.range) * 0.5) : 1);
      if (bestHead) dmg *= 2.7;                    // headshots: skill-rewarding, often lethal
      best.takeHit(dmg, dir.clone().setY(0).normalize(), { stun: bestHead ? 1.2 : 0.5 });
      this.spawnImpact(origin.clone().addScaledVector(dir, bestT), true);
      this.onHit?.(bestHead, best.dead);
    } else if (wallHits.length > 0) {
      this.spawnImpact(wallHits[0].point, false, wallHits[0].face?.normal);
    }
  }

  spawnImpact(pos, flesh, normal) {
    // brief spark/dust puff
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.flashTex, color: flesh ? 0x8a1a12 : 0xb0a890,
      blending: flesh ? THREE.NormalBlending : THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 0.85,
    }));
    spr.scale.set(flesh ? 0.5 : 0.35, flesh ? 0.5 : 0.35, 1);
    spr.position.copy(pos);
    this.scene.add(spr);
    let life = 0;
    const fade = () => {
      life += 0.05;
      spr.material.opacity = Math.max(0, 0.85 - life * 3);
      spr.scale.multiplyScalar(1.08);
      if (spr.material.opacity > 0) requestAnimationFrame(fade);
      else this.scene.remove(spr);
    };
    requestAnimationFrame(fade);
  }

  showFlash(w) {
    const muzzle = this.models[this.active].userData.muzzle || new THREE.Vector3(0, 0, -0.35);
    this.flash.position.copy(muzzle);
    this.flash.scale.setScalar(this.active === 'shotgun' ? 0.75 : 0.5);
    this.flash.material.opacity = 1;
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash.visible = true;
    this.flash.getWorldPosition(this._flashWorld || (this._flashWorld = new THREE.Vector3()));
    this.world.flashAt(this._flashWorld, this.active === 'shotgun' ? 40 : 26);
    this.flashDecay = 1;
  }

  forwardVec() {
    return new THREE.Vector3(
      -Math.sin(this.player.yaw) * Math.cos(this.player.pitch),
      Math.sin(this.player.pitch),
      -Math.cos(this.player.yaw) * Math.cos(this.player.pitch)
    ).normalize();
  }

  update(dt, moving, running) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.swingHold > 0) this.swingHold -= dt;              // hit-stick: hold the plank on contact
    else this.swingT = Math.min(1, this.swingT + dt * 3.4);
    this.recoilT = Math.max(0, this.recoilT - dt * 6);
    this.equipT = Math.min(1, (this.equipT ?? 1) + dt * 3.6);  // draw/raise animation

    // reload timing
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload();
    }

    // muzzle flash decay
    if (this.flashDecay > 0) {
      this.flashDecay -= dt * 12;
      this.flash.material.opacity = Math.max(0, this.flashDecay);
      if (this.flashDecay <= 0) this.flash.visible = false;
    }

    if (!this.active) return;
    const model = this.models[this.active];
    const rest = model.userData.rest;
    const w = this.activeWeapon;

    // view bob
    if (moving) this.bobT += dt * (running ? 11 : 8);
    const bobY = moving ? Math.sin(this.bobT) * 0.006 : 0;
    const bobX = moving ? Math.cos(this.bobT * 0.5) * 0.004 : 0;

    if (w.kind === 'melee') {
      const s = this.swingT;
      if (s < 1 || this.swingHold > 0) {
        // fast overhead chop that whips across the view, then follows through
        const arc = Math.sin(Math.min(1, s) * Math.PI);
        const chop = Math.pow(Math.max(0, 1 - s * 1.6), 2); // sharp downstroke early
        model.position.set(rest.pos.x - arc * 0.24, rest.pos.y + chop * 0.14 - arc * 0.06, rest.pos.z - arc * 0.26);
        model.rotation.set(rest.rot.x - arc * 1.9, rest.rot.y - arc * 1.1, rest.rot.z + arc * 0.2);
      } else {
        model.position.set(rest.pos.x + bobX, rest.pos.y + bobY, rest.pos.z);
        model.rotation.copy(rest.rot);
      }
    } else {
      // ADS blend — ease the gun toward a centered, sighted pose
      this.aimBlend = (this.aimBlend ?? 0) + ((this.aiming && this.reloadT <= 0 ? 1 : 0) - (this.aimBlend ?? 0)) * Math.min(1, dt * 12);
      const ab = this.aimBlend;
      // gun recoil: kick back + up, then settle (reduced while aiming)
      const r = this.recoilT * this.recoilT;
      let ry = rest.rot.x + r * 0.35;
      let pz = rest.pos.z + r * 0.09;
      let py = rest.pos.y + r * 0.02;
      // reload dip
      if (this.reloadT > 0) {
        const phase = 1 - this.reloadT / this.reloadTarget;
        const dip = Math.sin(phase * Math.PI);
        py -= dip * 0.14;
        ry += dip * 0.5;
      }
      // sighted pose: bring to centreline, pull in close, kill the bob
      const aimX = -0.02, aimY = rest.pos.y + 0.055, aimZ = rest.pos.z + 0.14;
      const bob = 1 - ab;
      model.position.set(
        THREE.MathUtils.lerp(rest.pos.x + bobX * bob, aimX, ab),
        THREE.MathUtils.lerp(py + bobY * bob, aimY, ab),
        THREE.MathUtils.lerp(pz, aimZ, ab)
      );
      model.rotation.set(ry, THREE.MathUtils.lerp(rest.rot.y, 0, ab), rest.rot.z);
    }

    // equip raise: the weapon swings up from the hip when first drawn
    if (this.equipT < 1) {
      const e = 1 - this.equipT;
      const ease = e * e;
      model.position.y -= ease * 0.42;
      model.position.z += ease * 0.13;
      model.rotation.x += ease * 1.0;
    }
  }
}
