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
import { Player, RECIPES } from './player.js';
import { Story } from './story.js';
import { Enemy, Follower } from './characters.js';
import { WeaponSystem } from './weapons.js';
import { GameAudio } from './audio.js';
import { UI } from './ui.js';
import { Lang, setLang, tr, UI_TEXT } from './lang.js';

// ---------------------------------------------------------------- localization
const CONTROLS = {
  title: {
    en: '<b>W A S D</b> move &nbsp; <b>Shift</b> run &nbsp; <b>C</b> <span style="color:#c8b06a">crouch</span> &nbsp; <b>V</b> <span style="color:#c8b06a">listen</span> &nbsp; <b>Mouse</b> look &nbsp; <b>L-Click</b> attack / fire &nbsp; <b>R-Click</b> aim &nbsp; <b>1 2 3</b> weapons<br><b>E</b> interact / <span style="color:#c8b06a">stealth takedown</span> &nbsp; <b>R</b> reload &nbsp; <b>Q</b> brick &nbsp; <b>G</b> molotov &nbsp; <b>H</b> bandage &nbsp; <b>F</b> torch &nbsp; <b>J</b> notebook &nbsp; <b>X</b> craft &nbsp; <b>Esc</b> pause',
    pt: '<b>W A S D</b> mover &nbsp; <b>Shift</b> correr &nbsp; <b>C</b> <span style="color:#c8b06a">agachar</span> &nbsp; <b>V</b> <span style="color:#c8b06a">escutar</span> &nbsp; <b>Rato</b> olhar &nbsp; <b>Clique-Esq</b> atacar / disparar &nbsp; <b>Clique-Dir</b> mirar &nbsp; <b>1 2 3</b> armas<br><b>E</b> interagir / <span style="color:#c8b06a">execução furtiva</span> &nbsp; <b>R</b> recarregar &nbsp; <b>Q</b> tijolo &nbsp; <b>G</b> molotov &nbsp; <b>H</b> ligadura &nbsp; <b>F</b> lanterna &nbsp; <b>J</b> caderno &nbsp; <b>X</b> fabricar &nbsp; <b>Esc</b> pausa',
  },
  pause: {
    en: '<b>W A S D</b> move &nbsp; <b>Shift</b> run &nbsp; <b>C</b> crouch &nbsp; <b>V</b> listen &nbsp; <b>L-Click</b> attack / fire &nbsp; <b>R-Click</b> aim &nbsp; <b>1 2 3</b> weapons &nbsp; <b>R</b> reload &nbsp; <b>E</b> interact / takedown<br><b>Q</b> brick &nbsp; <b>G</b> molotov &nbsp; <b>H</b> bandage &nbsp; <b>F</b> torch &nbsp; <b>X</b> craft &nbsp; <b>J</b> notebook',
    pt: '<b>W A S D</b> mover &nbsp; <b>Shift</b> correr &nbsp; <b>C</b> agachar &nbsp; <b>V</b> escutar &nbsp; <b>Clique-Esq</b> atacar / disparar &nbsp; <b>Clique-Dir</b> mirar &nbsp; <b>1 2 3</b> armas &nbsp; <b>R</b> recarregar &nbsp; <b>E</b> interagir / execução<br><b>Q</b> tijolo &nbsp; <b>G</b> molotov &nbsp; <b>H</b> ligadura &nbsp; <b>F</b> lanterna &nbsp; <b>X</b> fabricar &nbsp; <b>J</b> caderno',
  },
};

function applyStaticLang() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (UI_TEXT[key]) el.textContent = tr(UI_TEXT[key]);
  });
  const th = document.getElementById('controls-hint-title');
  const ph = document.getElementById('controls-hint-pause');
  if (th) th.innerHTML = CONTROLS.title[Lang.cur];
  if (ph) ph.innerHTML = CONTROLS.pause[Lang.cur];
  const lb = document.getElementById('btn-lang');
  if (lb) lb.textContent = tr(UI_TEXT.langLabel);
  const wr = document.getElementById('weapon-reload');
  if (wr) wr.textContent = '[R] ' + tr(UI_TEXT.reload);
}

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
const HERD = { sightRange: 9, fovCos: Math.cos(THREE.MathUtils.degToRad(48)), hearWalk: 3.2, hearRun: 16, chaseSpeed: 5.5, speed: 0.7 };
const enemies = [
  // Ribeira quay — first contact, a lone stalker among the wrecks
  new Enemy(scene, world, 'errante', [[-24, 0, 18], [-40, 0, 22], [-16, 0, 14]], audio),
  // the climb — São João & the Largo (a small pack)
  new Enemy(scene, world, 'errante', [[11, 5, -36], [12, 8.5, -48]], audio),
  new Enemy(scene, world, 'errante', [[-5, 12, -70], [20, 12, -80], [8, 12, -62]], audio),
  new Enemy(scene, world, 'errante', [[32, 12, -64], [-14, 12, -66]], audio),
  new Enemy(scene, world, 'errante', [[24, 12, -84], [-2, 12, -58]], audio),
  new Enemy(scene, world, 'errante', [[4, 12, -74], [30, 12, -72]], audio),   // Largo — added
  new Enemy(scene, world, 'errante', [[16, 12, -56], [-8, 12, -78]], audio),  // Largo — added
  // Rua das Flores approach
  new Enemy(scene, world, 'errante', [[27, 17, -100], [27, 20, -112]], audio),
  new Enemy(scene, world, 'errante', [[20, 15, -98], [30, 18, -106]], audio), // Flores — added
  // São Bento hall — a nest of ecos (blind, lethal; sound-stealth or die)
  new Enemy(scene, world, 'eco', [[60, 22, -140], [80, 22, -122], [68, 22, -134]], audio),
  new Enemy(scene, world, 'eco', [[72, 22, -116], [56, 22, -128]], audio),
  new Enemy(scene, world, 'eco', [[84, 22, -138], [64, 22, -146]], audio),
  new Enemy(scene, world, 'eco', [[52, 22, -120], [88, 22, -128]], audio),
  new Enemy(scene, world, 'eco', [[76, 22, -144], [62, 22, -124]], audio),    // São Bento — added
  // Mercado do Bolhão — infected shuffling the stall rows; an eco makes the maze lethal.
  // One patrols the upper gallery, so going high is safer but not free.
  new Enemy(scene, world, 'errante', [[4, 22, -172], [24, 22, -186]], audio),
  new Enemy(scene, world, 'errante', [[28, 22, -176], [8, 22, -190]], audio),
  new Enemy(scene, world, 'errante', [[16, 22, -193], [2, 22, -181]], audio),
  new Enemy(scene, world, 'eco', [[20, 22, -181], [10, 22, -176]], audio),
  new Enemy(scene, world, 'errante', [[-8, 25.6, -186], [-8, 25.6, -194]], audio),
  // the Corvos hold the Sé — a coordinated gang
  new Enemy(scene, world, 'corvo', [[64, 28, -52], [80, 28, -68]], audio),
  new Enemy(scene, world, 'corvo', [[88, 28, -44], [70, 28, -38]], audio),
  new Enemy(scene, world, 'corvo', [[64, 28, -74], [92, 28, -60]], audio),
  new Enemy(scene, world, 'corvo', [[76, 28, -80], [60, 28, -42]], audio),
  new Enemy(scene, world, 'corvo', [[96, 28, -50]], audio),
  new Enemy(scene, world, 'corvo', [[84, 28, -76], [68, 28, -50]], audio),    // Sé — added
  new Enemy(scene, world, 'corvo', [[58, 28, -66], [90, 28, -70]], audio),    // Sé — added
  // the herd on the bridge — dormant shamblers: near-blind, slow to rouse,
  // but running wakes the whole deck, and roused they surge
  new Enemy(scene, world, 'errante', [[111, 6, 30], [111, 6, 62]], audio, HERD),
  new Enemy(scene, world, 'errante', [[118, 6, 46], [113, 6, 82]], audio, HERD),
  new Enemy(scene, world, 'errante', [[112, 6, 92], [117, 6, 58]], audio, HERD),
  new Enemy(scene, world, 'errante', [[116, 6, 22], [111, 6, 76]], audio, HERD),
  new Enemy(scene, world, 'errante', [[114, 6, 50], [120, 6, 38]], audio, HERD),
  new Enemy(scene, world, 'errante', [[112, 6, 70], [116, 6, 100]], audio, HERD),
  new Enemy(scene, world, 'errante', [[117, 6, 34], [110, 6, 66]], audio, HERD),  // added
  new Enemy(scene, world, 'errante', [[110, 6, 88], [118, 6, 54]], audio, HERD),  // added
  new Enemy(scene, world, 'errante', [[115, 6, 106], [113, 6, 44]], audio, HERD), // added
  // Gaia bank — stragglers between you and the caves
  new Enemy(scene, world, 'errante', [[94, 0, 112], [72, 0, 108]], audio),
  new Enemy(scene, world, 'errante', [[40, 0, 116], [20, 0, 110]], audio),
];
// a Corvo gunshot is loud — it wakes every infected in earshot too
for (const e of enemies) e.onGunNoise = (pos, radius) => { for (const o of enemies) o.hearNoise(pos, radius); };
// spotting the player rallies nearby allies: a Corvo who sees you shouts and the gang
// converges; a roused infected draws the ones around it. They swarm the last-known spot.
for (const e of enemies) e.onSpotted = (pos, type) => {
  const radius = type === 'corvo' ? 30 : 18;
  for (const o of enemies) {
    if (o !== e && o.type === type && !o.dead) o.hearNoise(pos, radius);
  }
};
// keep the shelter safe: nothing hunts you until you step out into the city (stage 1)
let combatArmed = false;
for (const e of enemies) e.setActive(false);

let listening = false;
const LISTEN_RANGE = 30;   // how far focus senses the infected
let paused = false;
let ended = false;
let started = false;
let dead = false;
let journalOpen = false;
let craftOpen = false;

player.uiBlocked = () => ui.dialogueActive || paused || journalOpen || craftOpen || dead;
player.onBrickLand = (pos) => { for (const e of enemies) e.hearNoise(pos, 17); };
// a molotov shattering is loud and bright — it draws the whole block
player.onMolotovLand = (pos) => { for (const e of enemies) e.hearNoise(pos, 28); };
player.onSplash = () => ui.toast({ en: 'The Douro grips like a fist. You haul out, soaked and loud — too loud.', pt: 'O Douro agarra como um punho. Sais a custo, encharcada e barulhenta — barulhenta de mais.' });

// weapons wiring
weapons.enemies = enemies;
weapons.onNoise = (pos, radius) => { for (const e of enemies) e.hearNoise(pos, radius); };
weapons.onHudChange = () => ui.setWeapon(weapons);

story.onStageChange = (n) => {
  audio.setDrone(n === 4 || n === 6);
  // arm the city the moment you leave the shelter — no cheap deaths mid-prologue
  if (n >= 1 && !combatArmed) {
    combatArmed = true;
    for (const e of enemies) if (!e.dead) e.setActive(true);
  }
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

// a shiv lets you kill anything up close — even alert, even face-to-face (great vs the blind
// ecos and cornered Corvos). Only offered when a free takedown isn't already available.
function findShivTarget() {
  if (player.shivs <= 0) return null;
  let best = null, bestD = Infinity;
  for (const en of enemies) {
    if (!en.active || en.dead) continue;
    if (en.takedownReady(player.position)) continue;   // free takedown wins
    const d = Math.hypot(en.group.position.x - player.position.x, en.group.position.z - player.position.z);
    if (d < 2.1 && Math.abs(en.group.position.y - player.position.y) < 2 && d < bestD) { bestD = d; best = en; }
  }
  return best;
}

// A body you put down can be searched once — the scavenging half of the crafting loop.
// Corvos carried gear; the infected only have the rags and bottles they died holding.
function findLootTarget() {
  let best = null, bestD = Infinity;
  for (const en of enemies) {
    if (!en.dead || en.looted || en.deathT < 0.6) continue;
    const d = Math.hypot(en.group.position.x - player.position.x, en.group.position.z - player.position.z);
    if (d < 2.4 && Math.abs(en.group.position.y - player.position.y) < 2.5 && d < bestD) { bestD = d; best = en; }
  }
  return best;
}

function doLoot(target) {
  target.looted = true;
  audio.play('pickup');
  const got = [];
  const roll = () => Math.random();
  if (target.type === 'corvo') {
    // scavengers came equipped
    if (roll() < 0.55 && weapons.owned.revolver) { weapons.addAmmo('revolver', 2); got.push({ en: 'revolver rounds ×2', pt: 'munições de revólver ×2' }); }
    if (roll() < 0.3 && weapons.owned.shotgun) { weapons.addAmmo('shotgun', 1); got.push({ en: 'a shell', pt: 'um cartucho' }); }
    if (roll() < 0.45) { player.addComponent('blade'); got.push({ en: 'a blade', pt: 'uma lâmina' }); }
    if (roll() < 0.4) { player.addComponent('alcohol'); got.push({ en: 'alcohol', pt: 'álcool' }); }
    if (roll() < 0.35) { player.addComponent('rag'); got.push({ en: 'a rag', pt: 'um pano' }); }
    if (roll() < 0.2) { player.bandages++; got.push({ en: 'a bandage', pt: 'uma ligadura' }); }
  } else {
    if (roll() < 0.4) { player.addComponent('rag'); got.push({ en: 'a rag', pt: 'um pano' }); }
    if (roll() < 0.28) { player.addComponent('scrap'); got.push({ en: 'scrap', pt: 'sucata' }); }
    if (roll() < 0.16) { player.addComponent('alcohol'); got.push({ en: 'alcohol', pt: 'álcool' }); }
  }
  ui.setSupplies(player.bandages, player.bricks, player.molotovs);
  ui.setShivs(player.shivs);
  ui.setWeapon(weapons);
  if (craftOpen) ui.renderCraft(player);
  if (got.length === 0) {
    ui.toast({ en: 'Nothing. Pockets already turned out.', pt: 'Nada. Já lhe viraram os bolsos.' });
  } else {
    const en = got.map((g) => g.en).join(', ');
    const pt = got.map((g) => g.pt).join(', ');
    ui.toast({ en: `Searched the body: ${en}.`, pt: `Revistaste o corpo: ${pt}.` });
  }
}

function doTakedown(target) {
  target.silentKill();
  player.frozen = true;
  ui.toast(target.type === 'corvo'
    ? { en: 'You take him from behind — a hand over the mouth, and it is done. No shot, no shout.', pt: 'Apanha-lo por trás — uma mão na boca, e está feito. Sem tiro, sem grito.' }
    : { en: 'You drive the blade home before it can click. Silence holds.', pt: 'Cravas a lâmina antes que ele consiga estalar. O silêncio aguenta-se.' });
  setTimeout(() => { player.frozen = false; }, 380);
}

function doShivKill(target) {
  player.shivs--;
  target.silentKill();
  ui.setShivs(player.shivs);
  player.frozen = true;
  ui.toast(target.type === 'eco'
    ? { en: 'The shiv goes in before it can screech. It folds without a sound.', pt: 'A navalha entra antes que ele guinche. Dobra-se sem um som.' }
    : { en: 'No angle, no time — just the shiv, quick and final.', pt: 'Sem ângulo, sem tempo — só a navalha, rápida e final.' });
  setTimeout(() => { player.frozen = false; }, 380);
}

// craft recipe #i from the open menu
function tryCraft(i) {
  const r = RECIPES[i];
  if (r && player.craft(r.id)) {
    ui.renderCraft(player);
    ui.setSupplies(player.bandages, player.bricks, player.molotovs);
    ui.setShivs(player.shivs);
  } else {
    audio.play('click');   // nothing to build with — soft feedback
  }
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
    const sv = findShivTarget();
    if (sv) { doShivKill(sv); return; }
    const it = story.currentInteractable(player.position, player.forward());
    if (it) { it.action(); return; }
    const body = findLootTarget();
    if (body) doLoot(body);
  } else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
    const n = Number(e.code.slice(-1));
    if (ui.dialogueActive && ui.choiceMode) { ui.pickChoice(n - 1); return; }
    if (craftOpen) { tryCraft(n - 1); return; }        // in the craft menu, 1/2/3 build
    if (!ui.dialogueActive) weapons.switchTo(['plank', 'revolver', 'shotgun'][n - 1]);
  } else if (e.code === 'KeyR') {
    if (!ui.dialogueActive && weapons.reload()) ui.setWeapon(weapons);
  } else if (e.code === 'KeyX') {
    // crafting menu — only with full control (not mid-dialogue/pause)
    if (craftOpen) { craftOpen = ui.toggleCraft(player, false); }
    else if (player.canControl) { craftOpen = ui.toggleCraft(player, true); }
  } else if (e.code === 'KeyJ') {
    if (!ui.dialogueActive) journalOpen = ui.toggleJournal();
  } else if (e.code === 'KeyQ') {
    if (player.throwBrick(scene)) {
      ui.setSupplies(player.bandages, player.bricks, player.molotovs);
      for (const en of enemies) en.hearNoise(player.position.clone(), 6); // the throw itself is a small sound
    }
  } else if (e.code === 'KeyG') {
    if (player.throwMolotov(scene)) {
      ui.setSupplies(player.bandages, player.bricks, player.molotovs);
      for (const en of enemies) en.hearNoise(player.position.clone(), 6); // the throw itself
    }
  } else if (e.code === 'KeyH') {
    if (player.heal()) {
      ui.setSupplies(player.bandages, player.bricks, player.molotovs);
      ui.setHealth(player.health, player.maxHealth);
      ui.toast({ en: 'You bind the wound tight. It will hold.', pt: 'Apertas bem a ligadura. Vai aguentar.' });
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
  if (on && craftOpen) craftOpen = ui.toggleCraft(player, false);  // Esc/blur closes the kit too
  $('pause-screen').classList.toggle('hidden', !on);
  if (!on) tryLockPointer();
}

// language toggle — flips EN/PT and re-renders every visible string live
applyStaticLang();
$('btn-lang').addEventListener('click', (e) => {
  e.currentTarget.blur();
  setLang(Lang.cur === 'en' ? 'pt' : 'en');
  applyStaticLang();
  ui.refreshObjective();
  ui.renderJournal();
  if (craftOpen) ui.renderCraft(player);
});

$('btn-start').addEventListener('click', (e) => {
  e.currentTarget.blur();
  started = true;
  audio.init();
  audio.resume();
  audio.listener = camera; // positional audio: pan/attenuate by enemy world position
  $('title-screen').classList.add('hidden');
  ui.showHud();
  ui.setHealth(player.health, player.maxHealth);
  ui.setSupplies(player.bandages, player.bricks, player.molotovs);
  ui.setShivs(player.shivs);
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
  // drop focus mode cleanly
  listening = false; player.focusing = false;
  grade.uniforms.uListen.value = 0;
  for (const e of enemies) e.setGhost(false);
  story.onDeath();
  ui.fade(true);
  document.exitPointerLock?.();
  setTimeout(() => {
    $('death-screen').classList.remove('hidden');
    $('death-sub').textContent = story.stage >= 6
      ? tr({ en: 'the herd closes over you — the far bank stays a rumor', pt: 'a horda fecha-se sobre ti — a outra margem fica um boato' })
      : tr({ en: 'the ash takes you — Beatriz\'s footsteps fade uphill, alone', pt: 'a cinza leva-te — os passos da Beatriz somem-se pela subida, sozinha' });
  }, 900);
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  world.update(t, dt);
  // keep only the nearby lights live and the shadow frustum tight around the player
  world.updateLights(camera.position);
  world.updateShadowCamera(player.position);

  if (started && !ended && !dead) {
    if (!paused) {
      // listen mode (hold V) — focus to sense the infected through walls; roots you to a creep
      const wasListening = listening;
      listening = (!!player.keys['KeyV'] || window.__forceListen) && player.canControl;
      player.focusing = listening;
      if (listening && !wasListening) audio.play('focusIn');
      grade.uniforms.uListen.value += ((listening ? 0.9 : 0) - grade.uniforms.uListen.value) * Math.min(1, dt * 7);
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);

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
          e.setGhost(false);
          continue;
        }
        if (d > 85) { e.setGhost(false); continue; } // too far to matter this frame
        e.perceiveSteps(player.position, player.running, player.moving, player.crouching, dt);
        e.update(dt, t, player.position, player.moving, player.running, (dmg) => {
          player.takeDamage(dmg);
          ui.flashDamage();
          ui.setHealth(player.health, player.maxHealth);
          if (player.health <= 0) onPlayerDeath();
        });
        if (d < 40) maxSuspicion = Math.max(maxSuspicion, e.suspicion >= 1 ? 0 : e.suspicion);
        // reveal within focus range, coloured by how alert it is
        if (listening && e.active && d < LISTEN_RANGE) {
          const col = e.state === 'chase' ? 0xff4634 : (e.suspicion > 0.4 ? 0xffb648 : 0xcfe0ff);
          e.setGhost(true, col, pulse);
        } else {
          e.setGhost(false);
        }
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
        ui.prompt({ en: 'Silent takedown', pt: 'Execução silenciosa' }, 'E');
      } else if (findShivTarget()) {
        ui.prompt({ en: 'Shiv kill', pt: 'Matar com a navalha' }, 'E');
      } else {
        const it = story.currentInteractable(player.position, player.forward());
        if (it) ui.prompt(it.prompt);
        else if (findLootTarget()) ui.prompt({ en: 'Search the body', pt: 'Revistar o corpo' }, 'E');
        else ui.prompt(null);
      }
      // crosshair tells you when the plank will actually connect
      ui.setMeleeReady(weapons.meleeReady());
      ui.setCrouched(player.crouching);
      ui.setListening(listening);
      ui.setStamina(player.stamina, player.maxStamina, player.staminaLock);
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
window.__game = { player, story, world, enemies, follower, weapons, ui, camera, scene, audio, grade, renderer, composer, getFps: () => fpsValue };
