// CINZA — bootstrap and game loop.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CinemaGrade } from './grade.js';
import { World } from './world.js';
import { buildDistricts } from './districts.js';
import { Player } from './player.js';
import { Story } from './story.js';
import { Enemy, Follower } from './characters.js';
import { WeaponSystem } from './weapons.js';
import { GameAudio } from './audio.js';
import { UI } from './ui.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 1500);
scene.add(camera); // weapon view-models are parented to the camera

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// subtle HDR bloom for embers, sky glow, muzzle flash — tuned low so it never blows out
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.55, 0.9);
composer.addPass(bloom);
// tone-map + sRGB (reads renderer.toneMapping); bloom above runs in linear HDR
composer.addPass(new OutputPass());
// cinematic grade in display space: contrast, teal/orange split-tone, vignette, grain
const grade = new ShaderPass(CinemaGrade);
composer.addPass(grade);
// anti-aliasing last, on the finished frame
const smaa = new SMAAPass(window.innerWidth, window.innerHeight);
composer.addPass(smaa);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  grade.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- systems
const audio = new GameAudio();
const world = new World(scene);
buildDistricts(world);
const ui = new UI(audio);
const player = new Player(camera, world, audio);
const follower = new Follower(scene, world);
const weapons = new WeaponSystem(camera, world, audio, player);
const story = new Story(scene, world, ui, audio, player, follower, weapons);

// enemy roster — [type, waypoints[[x,y,z]...]]
const HERD = { sightRange: 9, fovCos: Math.cos(THREE.MathUtils.degToRad(48)), hearWalk: 2.8, hearRun: 14, chaseSpeed: 4.1, speed: 0.65 };
const enemies = [
  // the climb
  new Enemy(scene, world, 'errante', [[11, 5, -36], [12, 8.5, -48]], audio),
  new Enemy(scene, world, 'errante', [[-5, 12, -70], [20, 12, -80], [8, 12, -62]], audio),
  new Enemy(scene, world, 'errante', [[32, 12, -64], [-14, 12, -66]], audio),
  // São Bento hall — ecos
  new Enemy(scene, world, 'eco', [[60, 22, -140], [80, 22, -122], [68, 22, -134]], audio),
  new Enemy(scene, world, 'eco', [[72, 22, -116], [56, 22, -128]], audio),
  // the Corvos at the Sé
  new Enemy(scene, world, 'corvo', [[64, 28, -52], [80, 28, -68]], audio),
  new Enemy(scene, world, 'corvo', [[88, 28, -44], [70, 28, -38]], audio),
  new Enemy(scene, world, 'corvo', [[64, 28, -74]], audio),
  // the herd on the bridge — dormant shamblers: near-blind, slow to rouse,
  // but running wakes the whole deck
  new Enemy(scene, world, 'errante', [[111, 6, 30], [111, 6, 62]], audio, HERD),
  new Enemy(scene, world, 'errante', [[118, 6, 46], [113, 6, 82]], audio, HERD),
  new Enemy(scene, world, 'errante', [[112, 6, 92], [117, 6, 58]], audio, HERD),
  new Enemy(scene, world, 'errante', [[116, 6, 22], [111, 6, 76]], audio, HERD),
  // gaia straggler
  new Enemy(scene, world, 'errante', [[94, 0, 112], [72, 0, 108]], audio),
];

let paused = false;
let ended = false;
let started = false;
let dead = false;
let journalOpen = false;

player.uiBlocked = () => ui.dialogueActive || paused || journalOpen || dead;
player.onBrickLand = (pos) => { for (const e of enemies) e.hearNoise(pos, 17); };
player.onSplash = () => ui.toast('The Douro grips like a fist. You haul out, soaked and loud — too loud.');

// weapons wiring
weapons.enemies = enemies;
weapons.onNoise = (pos, radius) => { for (const e of enemies) e.hearNoise(pos, radius); };
weapons.onHudChange = () => ui.setWeapon(weapons);

story.onStageChange = (n) => {
  audio.setDrone(n === 4 || n === 6);
};
story.onGameEnd = (text) => {
  ended = true;
  audio.setHeartbeat(false);
  document.exitPointerLock?.();
  $('end-text').innerHTML = text;
  $('end-screen').classList.remove('hidden');
  $('hud').classList.remove('visible');
};

// ---------------------------------------------------------------- input
function tryLockPointer() {
  renderer.domElement.requestPointerLock?.();
}

// nearest enemy set up for a stealth takedown (unaware, player behind/beside it)
function findTakedownTarget() {
  let best = null, bestD = Infinity;
  for (const en of enemies) {
    if (!en.takedownReady(player.position)) continue;
    const d = Math.hypot(en.group.position.x - player.position.x, en.group.position.z - player.position.z);
    if (d < bestD) { bestD = d; best = en; }
  }
  return best;
}

function doTakedown(target) {
  target.silentKill();
  player.frozen = true;
  ui.toast(target.type === 'corvo'
    ? 'You take him from behind — a hand over the mouth, and it is done. No shot, no shout.'
    : 'You drive the blade home before it can click. Silence holds.');
  setTimeout(() => { player.frozen = false; }, 380);
}

document.addEventListener('keydown', (e) => {
  if (!started || ended || dead) return;
  if (e.code === 'KeyE' || e.code === 'Enter') {
    if (ui.dialogueActive) {
      if (!ui.choiceMode) ui.advanceDialogue();
      e.preventDefault();
      return;
    }
    const td = findTakedownTarget();
    if (td) { doTakedown(td); return; }
    const it = story.currentInteractable(player.position, player.forward());
    if (it) it.action();
  } else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
    const n = Number(e.code.slice(-1));
    if (ui.dialogueActive && ui.choiceMode) { ui.pickChoice(n - 1); return; }
    if (!ui.dialogueActive) weapons.switchTo(['plank', 'revolver', 'shotgun'][n - 1]);
  } else if (e.code === 'KeyR') {
    if (!ui.dialogueActive && weapons.reload()) ui.setWeapon(weapons);
  } else if (e.code === 'KeyJ') {
    if (!ui.dialogueActive) journalOpen = ui.toggleJournal();
  } else if (e.code === 'KeyQ') {
    if (player.throwBrick(scene)) {
      ui.setSupplies(player.bandages, player.bricks);
      for (const en of enemies) en.hearNoise(player.position.clone(), 6); // the throw itself is a small sound
    }
  } else if (e.code === 'KeyH') {
    if (player.heal()) {
      ui.setSupplies(player.bandages, player.bricks);
      ui.setHealth(player.health, player.maxHealth);
      ui.toast('You bind the wound tight. It will hold.');
    }
  } else if (e.code === 'KeyF') {
    player.setTorch(!player.torchOn);
  } else if (e.code === 'Escape' && !document.pointerLockElement) {
    if (!ui.dialogueActive) setPaused(!paused);
  }
});

document.addEventListener('mousedown', (e) => {
  if (!started || ended || paused || dead) return;
  if (ui.dialogueActive) {
    if (!ui.choiceMode) ui.advanceDialogue();
    return;
  }
  if (!document.pointerLockElement) { tryLockPointer(); return; }
  if (e.button === 0) { weapons.fire(); ui.setWeapon(weapons); }
  else if (e.button === 2) { weapons.aiming = true; }
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 2) weapons.aiming = false;
});
document.addEventListener('contextmenu', (e) => { if (started) e.preventDefault(); });

// hit feedback: crosshair pip on a hit, red + heavier on a headshot
weapons.onHit = (headshot, killed) => ui.hitMarker(headshot, killed);

document.addEventListener('wheel', (e) => {
  if (!started || ended || paused || dead || ui.dialogueActive) return;
  if (!document.pointerLockElement) return;
  weapons.cycle(e.deltaY > 0 ? 1 : -1);
}, { passive: true });

document.addEventListener('pointerlockchange', () => {
  if (!started || ended || dead) return;
  if (!document.pointerLockElement && !ui.dialogueActive) setPaused(true);
});

function setPaused(on) {
  paused = on;
  $('pause-screen').classList.toggle('hidden', !on);
  if (!on) tryLockPointer();
}

$('btn-start').addEventListener('click', (e) => {
  e.currentTarget.blur();
  started = true;
  audio.init();
  audio.resume();
  $('title-screen').classList.add('hidden');
  ui.showHud();
  ui.setHealth(player.health, player.maxHealth);
  ui.setSupplies(player.bandages, player.bricks);
  ui.setWeapon(weapons);
  tryLockPointer();
  player.enabled = true;
  story.begin();
});

$('btn-resume').addEventListener('click', (e) => { e.currentTarget.blur(); setPaused(false); });
$('btn-restart').addEventListener('click', () => window.location.reload());
$('btn-respawn').addEventListener('click', (e) => {
  e.currentTarget.blur();
  dead = false;
  $('death-screen').classList.add('hidden');
  story.respawn();
  for (const en of enemies) en.reset();
  ui.setHealth(player.health, player.maxHealth);
  ui.fade(false);
  tryLockPointer();
});

function onPlayerDeath() {
  if (dead) return;
  dead = true;
  weapons.aiming = false;
  story.onDeath();
  ui.fade(true);
  document.exitPointerLock?.();
  setTimeout(() => {
    $('death-screen').classList.remove('hidden');
    $('death-sub').textContent = story.stage >= 6
      ? 'the herd closes over you — the far bank stays a rumor'
      : 'the ash takes you — Beatriz\'s footsteps fade uphill, alone';
  }, 900);
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  world.update(t, dt);

  if (started && !ended && !dead) {
    if (!paused) {
      player.update(dt, scene, enemies);
      weapons.update(dt, player.moving, player.running);
      story.update(t, dt, player.position);
      follower.update(dt, t, player.position, player.yaw, player.moving);
      audio.tick(dt);
      ui.setWeapon(weapons); // keep reload/ammo readout live
      audio.setHeartbeat(player.health > 0 && player.health <= 30);

      // enemies
      let maxSuspicion = 0;
      let deadInfected = 0, deadCorvos = 0;
      for (const e of enemies) {
        const d = e.group.position.distanceTo(player.position);
        if (e.dead) {
          if (e.type === 'corvo') deadCorvos++; else deadInfected++;
          if (e.deathT < 2) e.update(dt, t, player.position, false, false, () => {});
          continue;
        }
        if (d > 85) continue; // too far to matter this frame
        e.perceiveSteps(player.position, player.running, player.moving, dt);
        e.update(dt, t, player.position, player.moving, player.running, (dmg) => {
          player.takeDamage(dmg);
          ui.flashDamage();
          ui.setHealth(player.health, player.maxHealth);
          if (player.health <= 0) onPlayerDeath();
        });
        if (d < 40) maxSuspicion = Math.max(maxSuspicion, e.suspicion >= 1 ? 0 : e.suspicion);
      }
      story.infectedKilled = deadInfected;
      story.corvosKilled = deadCorvos;
      ui.setDetection(maxSuspicion);

      // aim-down-sights only makes sense with a gun and full control
      if (!player.canControl || !weapons.activeWeapon || weapons.activeWeapon.kind !== 'gun') weapons.aiming = false;
      const targetFov = weapons.aiming ? 52 : 72;
      if (Math.abs(camera.fov - targetFov) > 0.05) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 12);
        camera.updateProjectionMatrix();
      }

      // prompt: stealth takedown takes priority over story interactions
      const td = findTakedownTarget();
      if (td) {
        ui.prompt('Silent takedown', 'E');
      } else {
        const it = story.currentInteractable(player.position, player.forward());
        ui.prompt(it ? it.prompt : null);
      }
      ui.updateMarker(camera, story.markerTarget(), player.position);
    }
  } else if (!started) {
    // title screen drift over the rooftops
    const a = t * 0.035;
    camera.position.set(10 + Math.sin(a) * 14, 14, 44 + Math.cos(a * 0.7) * 8);
    camera.lookAt(20, 8, -30);
  }

  grade.uniforms.uTime.value = t;
  composer.render();

  // rolling FPS (for diagnostics)
  fpsFrames++;
  const now = performance.now();
  if (now - fpsLast >= 500) {
    fpsValue = Math.round((fpsFrames * 1000) / (now - fpsLast));
    fpsFrames = 0;
    fpsLast = now;
  }
}
let fpsFrames = 0, fpsLast = performance.now(), fpsValue = 0;
frame();

// Debug/testing hooks
window.__game = { player, story, world, enemies, follower, weapons, ui, camera, scene, audio, getFps: () => fpsValue };
