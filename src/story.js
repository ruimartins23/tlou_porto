// CINZA — the narrative.
//
// Stage flow:
//  0 prologue: Rui's shelter — take the notebook and the plank
//  1 Cais da Ribeira → foot of Rua de São João
//  2 the climb: São João → Largo de São Domingos (errantes)
//  3 Rua das Flores → Praça de Almeida Garrett
//  4 São Bento station hall (ecos — sound stealth)
//  5 Terreiro da Sé (the Corvos)
//  6 Escadas do Codeçal → the bridge herd crossing
//  7 Cais de Gaia → the caves
//  8 Dr. Amélia — the choice, and the epilogue
import * as THREE from 'three';
import { makePerson, NPC } from './characters.js';

export class Story {
  constructor(scene, world, ui, audio, player, follower, weapons) {
    this.scene = scene;
    this.world = world;
    this.ui = ui;
    this.audio = audio;
    this.player = player;
    this.follower = follower;
    this.weapons = weapons;

    this.stage = -1;
    this.hasNotebook = false;
    this.timesDied = 0;
    this.infectedKilled = 0;
    this.corvosKilled = 0;
    this.endingChoice = null;
    this.checkpoint = { pos: new THREE.Vector3(-52, 0, 10), yaw: 2.6, stage: 0 };
    this.onStageChange = null;
    this.onGameEnd = null;
    this.flags = {};

    const L = world.locations;

    // --- Rui, dying on the mattress in the shelter
    // lying along the mattress (group origin is at the feet; body extends -x when rolled +z)
    this.rui = makePerson({ shirt: 0x4e4438, pants: 0x36322c, skin: 0xb59578 });
    this.rui.position.set(-54.62, 0.68, 6.2);
    this.rui.rotation.set(0, 0.1, Math.PI / 2 - 0.06);
    scene.add(this.rui);

    // --- Dr. Amélia + aide in the caves
    this.amelia = new NPC(scene, { shirt: 0x8a8578, pants: 0x3a3a40, skin: 0xc9a184 }, 63, 0, 141, Math.PI);
    this.aide = new NPC(scene, { shirt: 0x5a6349, pants: 0x33302e, skin: 0xa8886a }, 70, 0, 139, Math.PI + 0.5);
    this.npcs = [this.amelia, this.aide];

    // --- pickup props
    this.props = {};
    this.makeProp('notebook', new THREE.Vector3(-50, 1.05, 5.2),
      new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.4), new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.7 })));
    this.makeProp('plank', new THREE.Vector3(-52.5, 0.62, 10.5),
      new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 1.1), new THREE.MeshStandardMaterial({ color: 0x6b5233, roughness: 0.9 })));
    this.makeProp('shelfBandage', new THREE.Vector3(-47.5, 1.5, 6),
      new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.22), new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.9 })));
    this.makeProp('pharmacyBandages', new THREE.Vector3(-12, 12.5, -58.2),
      new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0xa8a098, roughness: 0.9 })));
    this.makeProp('largoBricks', new THREE.Vector3(28, 12.15, -61),
      this.brickPileMesh());
    this.makeProp('stationBandage', new THREE.Vector3(83, 22.8, -140.5),
      new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.22), new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.9 })));
    this.makeProp('stationBricks', new THREE.Vector3(55, 22.15, -119),
      this.brickPileMesh());
    this.makeProp('bridgeBricks', new THREE.Vector3(110, 6.15, 17),
      this.brickPileMesh());
    // weapons + ammo
    this.makeProp('revolver', new THREE.Vector3(-49.5, 0.72, 10.4), this.revolverMesh());
    this.makeProp('largoAmmo', new THREE.Vector3(-6, 12.15, -70), this.ammoBoxMesh(0x3a4a2a));
    this.makeProp('shotgun', new THREE.Vector3(70, 28.2, -56.5), this.shotgunMesh());   // dropped by a Corvo at the Sé camp
    this.makeProp('seShells', new THREE.Vector3(62, 28.15, -60), this.ammoBoxMesh(0x5a3020));
    this.makeProp('stationAmmo', new THREE.Vector3(57, 22.15, -145), this.ammoBoxMesh(0x3a4a2a));
    this.makeProp('gaiaShells', new THREE.Vector3(76, 0.15, 116), this.ammoBoxMesh(0x5a3020));

    // --- interactables
    this.interactables = [
      {
        id: 'rui', pos: new THREE.Vector3(-55.5, 0, 6.2), radius: 2.6,
        prompt: 'Kneel beside Rui',
        when: () => this.stage === -1,
        action: () => this.prologue(),
      },
      this.pickup('notebook', 'Take the notebook', () => {
        this.hasNotebook = true;
        this.ui.addJournal("Mariana's notebook", 'Beatriz\'s mother filled every page: blood counts, spore cultures, one word underlined three times — "imune". The Corvos burned her lab for this. Now it goes to Gaia.');
        this.checkPrologueDone();
      }, () => this.stage === 0),
      this.pickup('plank', 'Take the nailed plank', () => {
        this.weapons.give('plank');
        this.ui.toast('A plank with old nails. [1] to hold it, click to swing. It is not much — swing like it is.');
        this.checkPrologueDone();
      }, () => this.stage === 0),
      this.pickup('revolver', "Take Rui's revolver", () => {
        this.weapons.give('revolver', 6);
        this.ui.addJournal("Rui's revolver", 'His old service revolver and a half-box of rounds. "Six shots and a bad temper," he used to say. Loud enough to bring the whole street — save it for when the plank is not enough.');
        this.ui.toast('Revolver +6 rounds. [2] to draw, [R] to reload. A gunshot wakes every infected in earshot.');
      }, () => this.stage >= 0),
      this.pickup('largoAmmo', 'Take the revolver rounds', () => {
        this.weapons.addAmmo('revolver', 6);
        this.ui.toast('Revolver rounds +6.');
      }, () => this.stage >= 1),
      this.pickup('shotgun', 'Take the fallen sawn-off', () => {
        this.weapons.give('shotgun', 4);
        this.ui.addJournal('Sawn-off shotgun', 'Torn from a Corvo\'s dead hands. Two barrels, brutal up close, near-useless past a room\'s length. Deafening — but sometimes deafening is the point.');
        this.ui.toast('Sawn-off +4 shells. [3] to draw. Devastating at close range.');
      }, () => this.stage >= 5),
      this.pickup('seShells', 'Take the shotgun shells', () => {
        this.weapons.addAmmo('shotgun', 4);
        this.ui.toast('Shotgun shells +4.');
      }, () => this.stage >= 5),
      this.pickup('stationAmmo', 'Take the revolver rounds', () => {
        this.weapons.addAmmo('revolver', 6);
        this.ui.toast('Revolver rounds +6.');
      }, () => this.stage >= 4),
      this.pickup('gaiaShells', 'Take the shotgun shells', () => {
        this.weapons.addAmmo('shotgun', 4);
        this.ui.toast('Shotgun shells +4.');
      }, () => this.stage >= 6),
      this.pickup('shelfBandage', 'Take the bandages', () => {
        this.player.bandages += 1;
        this.ui.toast('Bandages +1 — press [H] to bind wounds when hurt.');
      }, () => this.stage >= 0),
      this.pickup('pharmacyBandages', 'Search the pharmacy shelf', () => {
        this.player.bandages += 2;
        this.ui.toast('Bandages +2. The pharmacy was picked clean years ago — almost.');
      }, () => this.stage >= 1),
      this.pickup('largoBricks', 'Gather bricks', () => {
        this.player.bricks += 3;
        this.ui.toast('Bricks +3 — throw [Q] to pull the infected somewhere you are not.');
      }, () => this.stage >= 1),
      this.pickup('stationBandage', 'Search the ticket booth', () => {
        this.player.bandages += 1;
        this.ui.toast('Bandages +1, tucked behind the ticket grille.');
      }, () => this.stage >= 1),
      this.pickup('stationBricks', 'Gather rubble bricks', () => {
        this.player.bricks += 2;
        this.ui.toast('Bricks +2.');
      }, () => this.stage >= 1),
      this.pickup('bridgeBricks', 'Gather bricks', () => {
        this.player.bricks += 2;
        this.ui.toast('Bricks +2. You will want these on the deck.');
      }, () => this.stage >= 1),
      {
        id: 'amelia', pos: L.amelia, radius: 3,
        prompt: 'Speak to Dr. Amélia',
        when: () => this.stage === 7,
        action: () => this.finale(),
      },
    ];

    // --- auto triggers (one-shot, horizontal distance)
    this.triggers = [
      this.trig('cardPraca', L.praca, 8, () => this.stage >= 1, () => {
        this.ui.areaCard('Praça da Ribeira', 'the old square');
        this.say([
          { speaker: 'Beatriz', text: 'The cube fountain. Dad used to lift me onto it and call me "a estátua mais feia do Porto".' },
          { speaker: 'Inês', text: 'He wasn\'t wrong. Keep close, Bia. The street up is ahead.' },
        ]);
      }),
      this.trig('cardSaoJoao', new THREE.Vector3(11, 3, -30), 6, () => this.stage >= 1, () => {
        this.ui.areaCard('Rua de São João', 'the climb');
        if (this.stage === 1) this.setStage(2);
      }),
      this.trig('cardLargo', new THREE.Vector3(5, 12, -62), 8, () => this.stage >= 2, () => {
        this.ui.areaCard('Largo de São Domingos', 'merchants\' quarter');
        this.say([
          { speaker: 'Inês', text: 'Errantes. See them swaying? They hear before they see. Walk — never run — and they\'ll mistake you for wind.' },
          { speaker: 'Beatriz', text: 'And if they don\'t?' },
          { speaker: 'Inês', text: 'Then I introduce them to the plank. Stay behind me.' },
        ]);
      }),
      this.trig('cardFlores', new THREE.Vector3(27, 13, -92), 6, () => this.stage >= 2, () => {
        this.ui.areaCard('Rua das Flores', 'street of flowers');
        if (this.stage === 2) this.setStage(3);
      }),
      this.trig('cardPlaza', new THREE.Vector3(24, 22, -124), 8, () => this.stage >= 3, () => {
        this.ui.areaCard('Praça de Almeida Garrett', 'before the station');
        if (this.stage === 3) this.setStage(4);
      }),
      this.trig('stationEntry', new THREE.Vector3(52, 22, -130), 4, () => this.stage >= 4, () => {
        this.ui.areaCard('Estação de São Bento', 'the tiled hall');
        this.setCheckpoint(new THREE.Vector3(48, 22, -130), -Math.PI / 2, 4);
        this.say([
          { speaker: 'Beatriz', text: '(whisper) Dad called these ones ecos. No eyes left. They see with their ears.' },
          { speaker: 'Inês', text: '(whisper) Then we are invisible if we are silent. Slow steps. If one starts clicking — freeze, and pray to the tiles.' },
        ]);
      }),
      this.trig('cardSe', new THREE.Vector3(65, 28, -80), 6, () => this.stage >= 4, () => {
        this.ui.areaCard('Terreiro da Sé', 'the cathedral terrace');
        if (this.stage === 4) this.setStage(5);
        this.setCheckpoint(new THREE.Vector3(65, 28, -82), Math.PI, 5);
        this.audio.play('corvo');
        this.say([
          { speaker: 'Voice, from the camp', text: 'QUEM VEM LÁ?! ... That\'s Barbosa\'s smuggler friend — and the girl! Falcão wants that notebook — TAKE THEM!' },
          { speaker: 'Inês', text: 'Corvos. Run for the far corner, Bia — the stairs behind the wall. GO!' },
        ]);
      }),
      this.trig('cardCodecal', new THREE.Vector3(102, 22, -17), 8, () => this.stage >= 5, () => {
        this.ui.areaCard('Escadas do Codeçal', 'down the old wall');
        if (this.stage === 5) this.setStage(6);
        this.setCheckpoint(new THREE.Vector3(102, 16, -3), Math.PI * 0.75, 6);
      }),
      this.trig('bridgeTalk', L.bridgeNorth, 7, () => this.stage >= 6, () => {
        this.ui.areaCard('Ponte de D. Luís I', 'the lower deck');
        this.setCheckpoint(new THREE.Vector3(112, 6, 15), Math.PI, 6);
        this.say([
          { speaker: 'Beatriz', text: 'The herd. There are so many of them just... walking. Where are they going?' },
          { speaker: 'Inês', text: 'Nowhere. Eight years, nowhere. We cross between them — girder to girder. Walk when they drift away, hold when they turn. And Bia — whatever happens on this bridge, you keep walking south.' },
        ]);
      }),
      this.trig('cardGaia', new THREE.Vector3(116, 0, 118), 13, () => this.stage >= 6, () => {
        this.ui.areaCard('Cais de Gaia', 'the far bank');
        if (this.stage === 6) this.setStage(7);
        this.setCheckpoint(new THREE.Vector3(116, 0, 118), Math.PI, 7);
        this.say([
          { speaker: 'Beatriz', text: 'We crossed. Inês — we actually crossed. Nobody crosses.' },
          { speaker: 'Inês', text: 'Your father said the same thing. The caves are along the bank — look for the old wine sign. Almost home, miúda.' },
        ]);
      }),
      this.trig('cavesEntry', new THREE.Vector3(60, 0, 124), 5, () => this.stage >= 6, () => {
        if (this.stage === 6) this.setStage(7); // fallback if the bank card was skirted
        this.ui.areaCard('Caves do Douro', 'the resistance cellars');
      }),
    ];
  }

  // ------------------------------------------------------------ helpers
  brickPileMesh() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x7a4a38, roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.34), mat);
      b.position.set((Math.random() - 0.5) * 0.5, 0.06 + (i > 2 ? 0.13 : 0), (Math.random() - 0.5) * 0.4);
      b.rotation.y = Math.random();
      b.castShadow = true;
      g.add(b);
    }
    return g;
  }

  ammoBoxMesh(color) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.2),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.15 }));
    box.castShadow = true;
    g.add(box);
    // loose rounds on top
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 8),
        new THREE.MeshStandardMaterial({ color: 0xb8923c, roughness: 0.35, metalness: 0.9 }));
      r.rotation.z = Math.PI / 2;
      r.rotation.y = Math.random();
      r.position.set((Math.random() - 0.5) * 0.16, 0.09, (Math.random() - 0.5) * 0.1);
      g.add(r);
    }
    return g;
  }

  revolverMesh() {
    const g = new THREE.Group();
    const gm = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.42, metalness: 0.85 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.7 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.16), gm);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.22, 10), gm);
    barrel.rotation.z = Math.PI / 2; barrel.position.set(-0.18, 0.02, 0);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.055), wood);
    grip.position.set(0.06, -0.08, 0); grip.rotation.z = 0.35;
    g.add(frame, barrel, grip);
    g.scale.setScalar(1.3);
    return g;
  }

  shotgunMesh() {
    const g = new THREE.Group();
    const gm = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.45, metalness: 0.8 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.7 });
    for (const oz of [-0.02, 0.02]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 10), gm);
      barrel.rotation.z = Math.PI / 2; barrel.position.set(-0.15, 0.01, oz);
      g.add(barrel);
    }
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.05), wood);
    stock.position.set(0.2, -0.03, 0); stock.rotation.z = -0.15;
    g.add(stock);
    g.rotation.y = 0.5;
    return g;
  }

  makeProp(id, pos, mesh) {
    mesh.position.copy(pos);
    mesh.castShadow = true;
    this.scene.add(mesh);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.world.glowTex, color: 0xb8a05c, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7,
    }));
    glow.scale.set(1.3, 1.3, 1);
    glow.position.copy(pos).add(new THREE.Vector3(0, 0.45, 0));
    this.scene.add(glow);
    this.props[id] = { mesh, glow, anchor: pos.clone(), taken: false, baseY: pos.y };
  }

  pickup(id, prompt, onTake, when) {
    return {
      id, pos: this.props[id].anchor, radius: 2.3, prompt,
      when: () => when() && !this.props[id].taken,
      action: () => {
        const p = this.props[id];
        p.taken = true;
        this.scene.remove(p.mesh, p.glow);
        this.audio.play('pickup');
        onTake();
      },
    };
  }

  trig(id, pos, radius, when, action) {
    return { id, pos, radius, when: () => when() && !this.flags[id], action: () => { this.flags[id] = true; action(); } };
  }

  say(lines, opts = {}) {
    this.ui.startDialogue(lines, opts);
  }

  setCheckpoint(pos, yaw, stage) {
    this.checkpoint = { pos: pos.clone(), yaw, stage };
  }

  setStage(n) {
    this.stage = n;
    const objectives = {
      0: 'Gather what Rui left you — the notebook, and something to swing',
      1: 'The quay east is collapsed — climb through the city. Reach Rua de São João',
      2: 'Cross the Largo de São Domingos and climb Rua das Flores',
      3: 'Reach São Bento station on Praça de Almeida Garrett',
      4: 'Cross the station hall — silently — and take the south alley to the Sé',
      5: 'Get past the Corvos to the Escadas do Codeçal, south-east corner',
      6: 'Cross the lower deck of Ponte Luís I — girder to girder, quiet and slow',
      7: 'Find the doctors in the Caves do Douro, along the Gaia bank',
    };
    if (objectives[n]) this.ui.setObjective(objectives[n]);
    if (this.onStageChange) this.onStageChange(n);
  }

  markerTarget() {
    const L = this.world.locations;
    switch (this.stage) {
      case 0: return null;
      case 1: return L.saoJoaoFoot;
      case 2: return new THREE.Vector3(27, 12, -90);
      case 3: return L.stationDoor;
      case 4: return L.stationExit;
      case 5: return L.codecalTop;
      case 6: return L.bridgeSouth;
      case 7: return L.cavesDoor;
      default: return null;
    }
  }

  // ------------------------------------------------------------ beats
  begin() {
    this.ui.areaCard('Cais da Ribeira', 'Porto — year 8 of the Cinza');
    this.say([
      { speaker: 'Inês', text: 'The river still smells the same. Salt, silt, and rust. Everything else this city was — the ash took.' },
      { speaker: 'Inês', text: 'Rui\'s message reached me at the west wall this morning: "Come before dark. Bring nothing. Tell no one." Eight years of smuggling taught me what that grammar means.' },
      { speaker: 'Inês', text: 'It means goodbye.' },
    ]);
  }

  prologue() {
    this.player.frozen = true;
    this.say([
      { speaker: 'Rui', text: 'Inês. You came. Don\'t — don\'t look at the arm. We both know the arithmetic of a bite.' },
      { speaker: 'Inês', text: 'I have bandages. Alcohol. Shut up and let me work.' },
      { speaker: 'Rui', text: 'Fourteen hours, maybe less. So listen like it\'s the last thing I ask — because it is. Beatriz. The spores don\'t take her. They never have.' },
      { speaker: 'Inês', text: '...That\'s not possible. Nobody\'s immune.' },
      { speaker: 'Rui', text: 'Mariana proved it before the Corvos burned her lab. Her notebook survived — it\'s on that crate. Blood work, cultures, all of it. A cure starts with that book and my daughter\'s pulse.' },
      { speaker: 'Rui', text: 'There are doctors in the old wine caves, Gaia side. Resistance. Dr. Amélia Rocha. Get them across the river, Inês.' },
      { speaker: 'Inês', text: 'The bridge belongs to the herd, Rui. Nobody crosses.' },
      { speaker: 'Rui', text: 'You do. You\'re the best smuggler left on this side of the wall — and the only person alive I\'d trust with her. ...Bia. Come out, filha. It\'s time.' },
      { speaker: 'Beatriz', text: 'I\'m not leaving you.' },
      { speaker: 'Rui', text: 'You\'re not leaving me. You\'re carrying me — everything of me that matters walks out that door with you. Vai. E não olhes para trás.' },
    ], {
      onEnd: () => {
        this.player.frozen = false;
        this.follower.setActive(true, new THREE.Vector3(-54, 0, 9));
        this.ui.addJournal('Rui', 'Bitten, dying, and still giving orders. Take Beatriz and Mariana\'s notebook to Dr. Amélia in the Gaia caves. His last run, traded to me.');
        this.setStage(0);
      },
    });
  }

  checkPrologueDone() {
    if (this.hasNotebook && this.weapons.owned.plank && this.stage === 0) {
      this.say([
        { speaker: 'Beatriz', text: '...The quay east of the square fell into the river two winters ago. We can\'t just walk to the bridge.' },
        { speaker: 'Inês', text: 'Then we go up — São João, the largo, through São Bento, past the Sé, and down the old wall to the deck. The long way. My way.' },
      ], {
        onEnd: () => {
          this.setStage(1);
          this.setCheckpoint(new THREE.Vector3(-48, 0, 12), -1.6, 1);
        },
      });
    }
  }

  // called by main when the player dies
  onDeath() {
    this.timesDied++;
    this.audio.play('death');
    this.audio.setHeartbeat(false);
  }

  respawn() {
    const cp = this.checkpoint;
    this.player.health = this.player.maxHealth;
    this.player.teleport(cp.pos.x, cp.pos.y, cp.pos.z, cp.yaw);
    this.follower.teleportTo(new THREE.Vector3(cp.pos.x + 1, cp.pos.y, cp.pos.z + 1));
    if (this.stage < cp.stage) this.setStage(cp.stage);
  }

  finale() {
    this.player.frozen = true;
    const kills = this.infectedKilled;
    this.say([
      { speaker: 'Dr. Amélia', text: 'Stop there. ...A smuggler, armed with a fence post, and a child. Of everything the river has washed up this year—' },
      { speaker: 'Inês', text: 'Rui Barbosa sent us. This is Beatriz. And this—' },
      { speaker: 'Dr. Amélia', text: '...Mariana\'s notebook. Deus. We thought it burned with her. Child, your mother\'s work — do you know what this is?' },
      { speaker: 'Beatriz', text: 'It\'s me. Page forty-one. I\'m what\'s left of her experiment.' },
      { speaker: 'Dr. Amélia', text: 'With the notebook we can begin. But the cultures need her — months of draws, spinal fluid, marrow. She would stay here, inside the caves, until it\'s done. Perhaps years.' },
      { speaker: 'Dr. Amélia', text: 'Or you take her, leave the book, and we work from paper alone — slower, blinder, maybe never. I won\'t force a child. So it falls to you, smuggler. What crosses back over that bridge?' },
    ], {
      choices: [
        {
          label: 'She stays. Make the cure. (I\'ll stay with her.)',
          onPick: () => { this.endingChoice = 'stay'; this.epilogue(); },
        },
        {
          label: 'The notebook stays. Beatriz comes with me.',
          onPick: () => { this.endingChoice = 'leave'; this.epilogue(); },
        },
      ],
    });
  }

  epilogue() {
    this.stage = 8;
    this.player.frozen = true;
    this.audio.setDrone(false);
    this.audio.play('success');
    this.ui.fade(true);
    const cleanLine = this.infectedKilled === 0
      ? 'You crossed a dead city without adding one body to its count. Rui would have called that art.'
      : `The plank is notched ${this.infectedKilled} times. You stopped counting; the wood didn't.`;
    const deathLine = this.timesDied === 0 ? '' : '<br><br>You still dream of the times the ash nearly had you. In the dream, Beatriz keeps walking south, like she promised.';
    const endings = {
      stay: [
        `Beatriz stayed. So did you — Amélia found she had two uses for a smuggler: needles come up the river now, glass and reagents and stolen generators, every run yours.`,
        `On the wall of the cellar, Beatriz keeps a tally in chalk: not of days, but of draws. "Every line is a street we get back," she says. She sounds like her mother, according to Amélia. She sounds like her father, according to you.`,
        `In the spring of the ninth year, a rabelo crossed at dawn flying a white rag — the first vaccine lot, going north. The herd on the bridge parted around the bell of its wake like it heard something it remembered.`,
        cleanLine + deathLine,
        `<br><i>O Porto ainda respira. — Porto still breathes.</i>`,
      ],
      leave: [
        `You left the notebook weighted under a lamp, and walked Beatriz back over the bridge before the tide — girder to girder, her hand in yours, the herd swaying past like drowned dancers.`,
        `The doctors work from Mariana's pages. Slower, blinder — but every month a runner brings a vial of Beatriz's blood down the wall at Matosinhos, drawn at her aunt's kitchen table, labelled in a twelve-year-old's handwriting: "para o Porto, com juros".`,
        `Amélia says paper and post may take ten years. Beatriz says her mother started with less. You say nothing; you're a smuggler, and you've learned what always crosses in the end: everything, if someone carries it.`,
        cleanLine + deathLine,
        `<br><i>O rio guarda segredos. As pessoas, não. — The river keeps secrets. People don't.</i>`,
      ],
    };
    setTimeout(() => {
      if (this.onGameEnd) this.onGameEnd(endings[this.endingChoice].join('<br><br>'));
    }, 1700);
  }

  // ------------------------------------------------------------ frame
  update(t, dt, playerPos) {
    for (const npc of this.npcs) npc.update(t, playerPos);
    // prop glow pulse
    for (const id in this.props) {
      const p = this.props[id];
      if (!p.taken) {
        p.glow.position.y = p.baseY + 0.5 + Math.sin(t * 2 + p.baseY) * 0.08;
        p.glow.material.opacity = 0.45 + Math.sin(t * 2.6 + p.baseY * 2) * 0.2;
      }
    }
    if (!this.ui.dialogueActive && !this.player.frozen) {
      for (const trig of this.triggers) {
        const dx = playerPos.x - trig.pos.x, dz = playerPos.z - trig.pos.z;
        if (trig.when() && Math.hypot(dx, dz) < trig.radius && Math.abs(playerPos.y - trig.pos.y) < 6) {
          trig.action();
          break;
        }
      }
    }
  }

  currentInteractable(playerPos, playerForward) {
    if (this.ui.dialogueActive || this.player.frozen) return null;
    let best = null;
    let bestD = Infinity;
    for (const it of this.interactables) {
      if (!it.when()) continue;
      const d = Math.hypot(playerPos.x - it.pos.x, playerPos.z - it.pos.z);
      if (Math.abs(playerPos.y - it.pos.y) > 4) continue;
      if (d < it.radius + 0.6 && d < bestD) {
        const to = new THREE.Vector3(it.pos.x - playerPos.x, 0, it.pos.z - playerPos.z).normalize();
        if (d < 1.2 || to.dot(playerForward) > 0.25) {
          best = it;
          bestD = d;
        }
      }
    }
    return best;
  }
}
