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
import { L as tx, tr } from './lang.js';

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
    this.onCheckpoint = null;
    this.onGameEnd = null;
    this.flags = {};
    this.subMarker = null;   // mid-stage objective waypoint (overrides markerTarget)

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
    // molotovs — a scarce, powerful throwable for packs and the herd
    this.makeProp('molotovLargo', new THREE.Vector3(31, 12.15, -58), this.molotovMesh());
    this.makeProp('molotovStation', new THREE.Vector3(87, 22.15, -140), this.molotovMesh());
    this.makeProp('molotovSe', new THREE.Vector3(61, 28.15, -78), this.molotovMesh());
    this.makeProp('molotovBridge', new THREE.Vector3(109, 6.15, 20), this.molotovMesh());
    // crafting components — scattered scraps across the whole route
    this.makeProp('cRag1', new THREE.Vector3(-40, 0.13, 14), this.componentMesh('rag'));
    this.makeProp('cAlc1', new THREE.Vector3(-27, 0.13, 20), this.componentMesh('alcohol'));
    this.makeProp('cScrap1', new THREE.Vector3(28, 12.13, -66), this.componentMesh('scrap'));
    this.makeProp('cBlade1', new THREE.Vector3(-8, 12.13, -66), this.componentMesh('blade'));
    this.makeProp('cAlc2', new THREE.Vector3(26, 22.13, -118), this.componentMesh('alcohol'));
    this.makeProp('cRag2', new THREE.Vector3(21, 22.13, -124), this.componentMesh('rag'));
    this.makeProp('cScrap2', new THREE.Vector3(84, 22.13, -121), this.componentMesh('scrap'));
    this.makeProp('cRag3', new THREE.Vector3(56, 22.13, -143), this.componentMesh('rag'));
    this.makeProp('cAlc3', new THREE.Vector3(66, 28.13, -46), this.componentMesh('alcohol'));
    this.makeProp('cBlade2', new THREE.Vector3(90, 28.13, -64), this.componentMesh('blade'));
    this.makeProp('cScrap3', new THREE.Vector3(112, 6.13, 44), this.componentMesh('scrap'));
    this.makeProp('cAlc4', new THREE.Vector3(88, 0.13, 118), this.componentMesh('alcohol'));
    this.makeProp('cBlade3', new THREE.Vector3(72, 0.13, 121), this.componentMesh('blade'));
    // --- Mercado do Bolhão: the richest scavenging in the city (courtyard stalls + galleries)
    this.makeProp('cRagB', new THREE.Vector3(6, 23.2, -172), this.componentMesh('rag'));
    this.makeProp('cAlcB', new THREE.Vector3(20, 23.2, -179), this.componentMesh('alcohol'));
    this.makeProp('cBladeB', new THREE.Vector3(12, 22.13, -186), this.componentMesh('blade'));
    this.makeProp('cScrapB', new THREE.Vector3(26, 23.2, -193), this.componentMesh('scrap'));
    this.makeProp('bolhaoBandages', new THREE.Vector3(-8, 25.75, -186),
      new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.24), new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 0.9 })));
    this.makeProp('bolhaoAmmo', new THREE.Vector3(34, 25.75, -185), this.ammoBoxMesh(0x3a4a2a));
    this.makeProp('bolhaoMolotov', new THREE.Vector3(2, 22.15, -193), this.molotovMesh());

    // --- interactables
    this.interactables = [
      {
        id: 'rui', pos: new THREE.Vector3(-55.5, 0, 6.2), radius: 2.6,
        prompt: tx('Kneel beside Rui', 'Ajoelhar-te ao lado do Rui'),
        when: () => this.stage === -1,
        action: () => this.prologue(),
      },
      this.pickup('notebook', tx('Take the notebook', 'Pegar no caderno'), () => {
        this.hasNotebook = true;
        this.ui.addJournal(tx("Mariana's notebook", 'O caderno da Mariana'), tx('Beatriz\'s mother filled every page: blood counts, spore cultures, one word underlined three times — "imune". The Corvos burned her lab for this. Now it goes to Gaia.', 'A mãe da Beatriz encheu cada página: contagens de sangue, culturas de esporos, uma palavra sublinhada três vezes — "imune". Os Corvos queimaram o laboratório dela por causa disto. Agora vai para Gaia.'));
        this.checkPrologueDone();
      }, () => this.stage === 0),
      this.pickup('plank', tx('Take the nailed plank', 'Pegar na tábua com pregos'), () => {
        this.weapons.give('plank');
        this.ui.toast(tx('A plank with old nails. [1] to hold it, click to swing. It is not much — swing like it is.', 'Uma tábua com pregos velhos. [1] para a empunhar, clique para bater. Não é grande coisa — mas bate como se fosse.'));
        this.checkPrologueDone();
      }, () => this.stage === 0),
      this.pickup('revolver', tx("Take Rui's revolver", 'Pegar no revólver do Rui'), () => {
        this.weapons.give('revolver', 6);
        this.ui.addJournal(tx("Rui's revolver", 'O revólver do Rui'), tx('His old service revolver and a half-box of rounds. "Six shots and a bad temper," he used to say. Loud enough to bring the whole street — save it for when the plank is not enough.', 'O velho revólver de serviço dele e meia caixa de munições. "Seis tiros e mau feitio", costumava dizer. Barulhento o suficiente para trazer a rua inteira — guarda-o para quando a tábua não chegar.'));
        this.ui.toast(tx('Revolver +6 rounds. [2] to draw, [R] to reload. A gunshot wakes every infected in earshot.', 'Revólver +6 munições. [2] para sacar, [R] para recarregar. Um tiro acorda todos os infetados por perto.'));
      }, () => this.stage >= 0),
      this.pickup('largoAmmo', tx('Take the revolver rounds', 'Pegar nas munições do revólver'), () => {
        this.weapons.addAmmo('revolver', 6);
        this.ui.toast(tx('Revolver rounds +6.', 'Munições de revólver +6.'));
      }, () => this.stage >= 1),
      this.pickup('shotgun', tx('Take the fallen sawn-off', 'Pegar na caçadeira caída'), () => {
        this.weapons.give('shotgun', 4);
        this.ui.addJournal(tx('Sawn-off shotgun', 'Caçadeira de canos serrados'), tx('Torn from a Corvo\'s dead hands. Two barrels, brutal up close, near-useless past a room\'s length. Deafening — but sometimes deafening is the point.', 'Arrancada das mãos mortas de um Corvo. Dois canos, brutal de perto, quase inútil além do comprimento de uma sala. Ensurdecedora — mas às vezes ensurdecer é a intenção.'));
        this.ui.toast(tx('Sawn-off +4 shells. [3] to draw. Devastating at close range.', 'Caçadeira +4 cartuchos. [3] para sacar. Devastadora a curta distância.'));
      }, () => this.stage >= 5),
      this.pickup('seShells', tx('Take the shotgun shells', 'Pegar nos cartuchos da caçadeira'), () => {
        this.weapons.addAmmo('shotgun', 4);
        this.ui.toast(tx('Shotgun shells +4.', 'Cartuchos de caçadeira +4.'));
      }, () => this.stage >= 5),
      this.pickup('stationAmmo', tx('Take the revolver rounds', 'Pegar nas munições do revólver'), () => {
        this.weapons.addAmmo('revolver', 6);
        this.ui.toast(tx('Revolver rounds +6.', 'Munições de revólver +6.'));
      }, () => this.stage >= 4),
      this.pickup('gaiaShells', tx('Take the shotgun shells', 'Pegar nos cartuchos da caçadeira'), () => {
        this.weapons.addAmmo('shotgun', 4);
        this.ui.toast(tx('Shotgun shells +4.', 'Cartuchos de caçadeira +4.'));
      }, () => this.stage >= 6),
      this.pickup('shelfBandage', tx('Take the bandages', 'Pegar nas ligaduras'), () => {
        this.player.bandages += 1;
        this.ui.toast(tx('Bandages +1 — press [H] to bind wounds when hurt.', 'Ligaduras +1 — carrega em [H] para tratar feridas quando estiveres magoada.'));
      }, () => this.stage >= 0),
      this.pickup('pharmacyBandages', tx('Search the pharmacy shelf', 'Revistar a prateleira da farmácia'), () => {
        this.player.bandages += 2;
        this.ui.toast(tx('Bandages +2. The pharmacy was picked clean years ago — almost.', 'Ligaduras +2. A farmácia foi saqueada há anos — quase toda.'));
      }, () => this.stage >= 1),
      this.pickup('largoBricks', tx('Gather bricks', 'Juntar tijolos'), () => {
        this.player.bricks += 3;
        this.ui.toast(tx('Bricks +3 — throw [Q] to pull the infected somewhere you are not.', 'Tijolos +3 — atira [Q] para atrair os infetados para longe de ti.'));
      }, () => this.stage >= 1),
      this.pickup('stationBandage', tx('Search the ticket booth', 'Revistar a bilheteira'), () => {
        this.player.bandages += 1;
        this.ui.toast(tx('Bandages +1, tucked behind the ticket grille.', 'Ligaduras +1, escondidas atrás da grade da bilheteira.'));
      }, () => this.stage >= 1),
      this.pickup('stationBricks', tx('Gather rubble bricks', 'Juntar tijolos dos escombros'), () => {
        this.player.bricks += 2;
        this.ui.toast(tx('Bricks +2.', 'Tijolos +2.'));
      }, () => this.stage >= 1),
      this.pickup('bridgeBricks', tx('Gather bricks', 'Juntar tijolos'), () => {
        this.player.bricks += 2;
        this.ui.toast(tx('Bricks +2. You will want these on the deck.', 'Tijolos +2. Vais precisar deles no tabuleiro.'));
      }, () => this.stage >= 1),
      this.pickup('molotovLargo', tx('Take the molotov', 'Pegar no cocktail molotov'), () => {
        this.player.molotovs += 1;
        this.ui.setSupplies(this.player.bandages, this.player.bricks, this.player.molotovs);
        this.ui.toast(tx('Molotov +1 — throw with [G]. Fire clears a whole pack, but the light and noise draw everything nearby.', 'Cocktail molotov +1 — atira com [G]. O fogo limpa um grupo inteiro, mas a luz e o barulho atraem tudo o que está perto.'));
      }, () => this.stage >= 1),
      this.pickup('molotovStation', tx('Take the molotov', 'Pegar no cocktail molotov'), () => {
        this.player.molotovs += 1;
        this.ui.setSupplies(this.player.bandages, this.player.bricks, this.player.molotovs);
        this.ui.toast(tx('Molotov +1. Save it — the ecos cluster tight, and fire is one of the few things that clears them.', 'Cocktail molotov +1. Guarda-o — os ecos andam em grupos apertados, e o fogo é das poucas coisas que os limpa.'));
      }, () => this.stage >= 4),
      this.pickup('molotovSe', tx('Take the molotovs', 'Pegar nos cocktails molotov'), () => {
        this.player.molotovs += 2;
        this.ui.setSupplies(this.player.bandages, this.player.bricks, this.player.molotovs);
        this.ui.toast(tx('Molotov +2. The Corvos fight from cover — a bottle in the right corner flushes them out.', 'Cocktail molotov +2. Os Corvos lutam abrigados — uma garrafa no canto certo obriga-os a sair.'));
      }, () => this.stage >= 5),
      this.pickup('molotovBridge', tx('Take the molotovs', 'Pegar nos cocktails molotov'), () => {
        this.player.molotovs += 2;
        this.ui.setSupplies(this.player.bandages, this.player.bricks, this.player.molotovs);
        this.ui.toast(tx('Molotov +2. If the deck turns and the herd surges, fire buys you the seconds to run.', 'Cocktail molotov +2. Se o tabuleiro se virar e a horda avançar, o fogo dá-te os segundos para fugir.'));
      }, () => this.stage >= 6),
      // crafting components
      this.compPickup('cRag1', 'rag', 1, true),
      this.compPickup('cAlc1', 'alcohol', 1),
      this.compPickup('cScrap1', 'scrap', 1),
      this.compPickup('cBlade1', 'blade', 1),
      this.compPickup('cAlc2', 'alcohol', 3),
      this.compPickup('cRag2', 'rag', 3),
      this.compPickup('cScrap2', 'scrap', 4),
      this.compPickup('cRag3', 'rag', 4),
      this.compPickup('cAlc3', 'alcohol', 5),
      this.compPickup('cBlade2', 'blade', 5),
      this.compPickup('cScrap3', 'scrap', 6),
      this.compPickup('cAlc4', 'alcohol', 7),
      this.compPickup('cBlade3', 'blade', 7),
      // --- Mercado do Bolhão
      this.compPickup('cRagB', 'rag', 3),
      this.compPickup('cAlcB', 'alcohol', 3),
      this.compPickup('cBladeB', 'blade', 3),
      this.compPickup('cScrapB', 'scrap', 3),
      this.pickup('bolhaoBandages', tx('Take the bandages', 'Pegar nas ligaduras'), () => {
        this.player.bandages += 2;
        this.ui.setSupplies(this.player.bandages, this.player.bricks, this.player.molotovs);
        this.ui.toast(tx('Bandages +2. Someone kept a clean stock up here, above the floor.',
          'Ligaduras +2. Alguém guardou aqui em cima um stock limpo, longe do chão.'));
      }, () => this.stage >= 3),
      this.pickup('bolhaoAmmo', tx('Take the revolver rounds', 'Pegar nas munições do revólver'), () => {
        this.weapons.addAmmo('revolver', 8);
        this.ui.setWeapon(this.weapons);
        this.ui.toast(tx('Revolver rounds +8. The traders were armed, right up to the end.',
          'Munições de revólver +8. Os feirantes estavam armados, até ao fim.'));
      }, () => this.stage >= 3),
      this.pickup('bolhaoMolotov', tx('Take the molotov', 'Pegar no cocktail molotov'), () => {
        this.player.molotovs += 1;
        this.ui.setSupplies(this.player.bandages, this.player.bricks, this.player.molotovs);
        this.ui.toast(tx('Molotov +1. Bottled in the market, never thrown.',
          'Cocktail molotov +1. Engarrafado no mercado, nunca atirado.'));
      }, () => this.stage >= 3),
      {
        id: 'amelia', pos: L.amelia, radius: 3,
        prompt: tx('Speak to Dr. Amélia', 'Falar com a Dra. Amélia'),
        when: () => this.stage === 7,
        action: () => this.finale(),
      },
    ];

    // --- collectible lore + a mid-game mercy choice deepen the world & the ending
    this.notesFound = 0;
    this.mercy = null;
    this.interactables.push(...this.makeNotes());
    this.interactables.push(this.makeWoundedCorvo());

    // --- auto triggers (one-shot, horizontal distance)
    this.triggers = [
      this.trig('cardPraca', L.praca, 8, () => this.stage >= 1, () => {
        this.ui.areaCard('Praça da Ribeira', tx('the old square', 'a praça velha'));
        this.say([
          { speaker: 'Beatriz', text: tx('The cube fountain. Dad used to lift me onto it and call me "a estátua mais feia do Porto".', 'A fonte do cubo. O pai punha-me em cima dela e chamava-me "a estátua mais feia do Porto".') },
          { speaker: 'Inês', text: tx('He wasn\'t wrong. Keep close, Bia. The street up is ahead.', 'Não estava errado. Fica perto, Bia. A rua para cima é já ali à frente.') },
        ]);
      }),
      this.trig('cardSaoJoao', new THREE.Vector3(11, 3, -30), 6, () => this.stage >= 1, () => {
        this.ui.areaCard('Rua de São João', tx('the climb', 'a subida'));
        if (this.stage === 1) this.setStage(2);
      }),
      this.trig('cardLargo', new THREE.Vector3(5, 12, -62), 8, () => this.stage >= 2, () => {
        this.ui.areaCard('Largo de São Domingos', tx('merchants\' quarter', 'o bairro dos mercadores'));
        this.say([
          { speaker: 'Inês', text: tx('Errantes. See them swaying? They hear before they see. Walk — never run — and they\'ll mistake you for wind.', 'Errantes. Vês como oscilam? Ouvem antes de ver. Anda — nunca corras — e vão confundir-te com o vento.') },
          { speaker: 'Beatriz', text: tx('And if they don\'t?', 'E se não confundirem?') },
          { speaker: 'Inês', text: tx('Then I introduce them to the plank. Stay behind me.', 'Então apresento-lhes a tábua. Fica atrás de mim.') },
        ]);
      }),
      this.trig('cardFlores', new THREE.Vector3(27, 13, -92), 6, () => this.stage >= 2, () => {
        this.ui.areaCard('Rua das Flores', tx('street of flowers', 'a rua das flores'));
        if (this.stage === 2) this.setStage(3);
      }),
      this.trig('cardPlaza', new THREE.Vector3(24, 22, -124), 8, () => this.stage >= 3, () => {
        this.ui.areaCard('Praça de Almeida Garrett', tx('before the station', 'diante da estação'));
        if (this.stage === 3) this.setStage(4);
      }),
      this.trig('stationEntry', new THREE.Vector3(52, 22, -130), 4, () => this.stage >= 4, () => {
        this.ui.areaCard('Estação de São Bento', tx('the tiled hall', 'o átrio dos azulejos'));
        this.setCheckpoint(new THREE.Vector3(48, 22, -130), -Math.PI / 2, 4);
        this.say([
          { speaker: 'Beatriz', text: tx('(whisper) Dad called these ones ecos. No eyes left. They see with their ears.', '(sussurro) O pai chamava a estes ecos. Já não têm olhos. Veem com os ouvidos.') },
          { speaker: 'Inês', text: tx('(whisper) Then we are invisible if we are silent. Slow steps. If one starts clicking — freeze, and pray to the tiles.', '(sussurro) Então somos invisíveis se ficarmos caladas. Passos lentos. Se um começar a estalar — fica quieta, e reza aos azulejos.') },
        ]);
      }),
      this.trig('cardSe', new THREE.Vector3(65, 28, -80), 6, () => this.stage >= 4, () => {
        this.ui.areaCard('Terreiro da Sé', tx('the cathedral terrace', 'o terreiro da catedral'));
        if (this.stage === 4) this.setStage(5);
        this.setCheckpoint(new THREE.Vector3(65, 28, -82), Math.PI, 5);
        this.audio.play('corvo');
        this.say([
          { speaker: tx('Voice, from the camp', 'Voz, do acampamento'), text: tx('QUEM VEM LÁ?! ... That\'s Barbosa\'s smuggler friend — and the girl! Falcão wants that notebook — TAKE THEM!', 'QUEM VEM LÁ?! ... É a amiga contrabandista do Barbosa — e a miúda! O Falcão quer esse caderno — APANHEM-NAS!') },
          { speaker: 'Inês', text: tx('Corvos. Run for the far corner, Bia — the stairs behind the wall. GO!', 'Corvos. Corre para o canto ao fundo, Bia — as escadas atrás do muro. VAI!') },
        ]);
      }),
      // fighting toward the far corner, you pass a Corvo you already downed — alive, just.
      this.trig('woundedReveal', new THREE.Vector3(88, 28, -58), 7, () => this.stage === 5, () => {
        this.flags.corvoBeaten = true;
        this.wounded.visible = true;
        this.say([
          { speaker: 'Beatriz', text: tx('(pulling your sleeve) Inês — that one. He\'s still moving. He\'s not getting up.', '(a puxar-te a manga) Inês — aquele. Ainda se mexe. Não se consegue levantar.') },
          { speaker: 'Inês', text: tx('Stay back, Bia. Let me see him.', 'Fica para trás, Bia. Deixa-me vê-lo.') },
        ]);
      }),
      this.trig('cardCodecal', new THREE.Vector3(102, 22, -17), 8, () => this.stage >= 5, () => {
        this.ui.areaCard('Escadas do Codeçal', tx('down the old wall', 'pela muralha velha'));
        if (this.stage === 5) this.setStage(6);
        this.setCheckpoint(new THREE.Vector3(102, 16, -3), Math.PI * 0.75, 6);
      }),
      this.trig('bridgeTalk', L.bridgeNorth, 7, () => this.stage >= 6, () => {
        this.ui.areaCard('Ponte de D. Luís I', tx('the lower deck', 'o tabuleiro inferior'));
        this.setCheckpoint(new THREE.Vector3(112, 6, 15), Math.PI, 6);
        this.say([
          { speaker: 'Beatriz', text: tx('The herd. There are so many of them just... walking. Where are they going?', 'A horda. São tantos, só a... andar. Para onde vão?') },
          { speaker: 'Inês', text: tx('Nowhere. Eight years, nowhere. We cross between them — girder to girder. Walk when they drift away, hold when they turn. And Bia — whatever happens on this bridge, you keep walking south.', 'Para lado nenhum. Oito anos, lado nenhum. Passamos por entre eles — viga a viga. Anda quando se afastam, pára quando se viram. E, Bia — aconteça o que acontecer nesta ponte, tu continuas a andar para sul.') },
        ]);
      }),
      this.trig('cardGaia', new THREE.Vector3(116, 0, 118), 13, () => this.stage >= 6, () => {
        this.ui.areaCard('Cais de Gaia', tx('the far bank', 'a outra margem'));
        if (this.stage === 6) this.setStage(7);
        this.setCheckpoint(new THREE.Vector3(116, 0, 118), Math.PI, 7);
        this.say([
          { speaker: 'Beatriz', text: tx('We crossed. Inês — we actually crossed. Nobody crosses.', 'Atravessámos. Inês — atravessámos mesmo. Ninguém atravessa.') },
          { speaker: 'Inês', text: tx('Your father said the same thing. The caves are along the bank — look for the old wine sign. Almost home, miúda.', 'O teu pai disse a mesma coisa. As caves são ao longo do cais — procura a placa velha do vinho. Estamos quase em casa, miúda.') },
        ]);
      }),
      this.trig('cavesEntry', new THREE.Vector3(60, 0, 124), 5, () => this.stage >= 6, () => {
        if (this.stage === 6) this.setStage(7); // fallback if the bank card was skirted
        this.ui.areaCard('Caves do Douro', tx('the resistance cellars', 'as caves da resistência'));
      }),

      // ===================== added story beats — the long way down =====================
      // Ribeira: grief, right outside the shelter
      this.trig('ruiGrief', new THREE.Vector3(-44, 0, 8), 4.5, () => this.stage >= 1, () => {
        this.say([
          { speaker: 'Beatriz', text: tx('You didn\'t close his eyes. My father\'s.', 'Não lhe fechaste os olhos. Ao meu pai.') },
          { speaker: 'Inês', text: tx('I don\'t close the eyes of the living. While you walk, he walks.', 'Não fecho os olhos aos vivos. Enquanto tu andas, ele anda.') },
          { speaker: 'Beatriz', text: tx('That doesn\'t make sense.', 'Isso não faz sentido.') },
          { speaker: 'Inês', text: tx('Nothing kind ever does. Stay close, and step where I step.', 'Nada de bom faz. Fica perto, e pisa onde eu piso.') },
        ]);
      }),
      // Ribeira: the way up, and the first errante — a step objective
      this.trig('ribeiraClimb', new THREE.Vector3(-6, 0, -6), 5, () => this.stage === 1, () => {
        this.step(tx('Find the gap in the wreckage and climb toward Rua de São João',
          'Encontra a abertura nos escombros e sobe até à Rua de São João'), this.world.locations.saoJoaoFoot);
        this.say([
          { speaker: 'Inês', text: tx('First one\'s ahead, by the tram wreck. An errante — watch how it sways toward sound.', 'O primeiro está à frente, junto ao elétrico destruído. Um errante — repara como oscila para o som.') },
          { speaker: 'Beatriz', text: tx('Do we go around it?', 'Damos a volta?') },
          { speaker: 'Inês', text: tx('We go quiet. Crouch when I crouch. If it turns — the plank, fast, before it screams.', 'Vamos caladas. Agacha-te quando eu me agacho. Se se virar — a tábua, depressa, antes que grite.') },
        ]);
      }),
      // the climb: who Inês was, and how she knew Rui
      this.trig('saoJoaoBeat', new THREE.Vector3(12, 8, -48), 5, () => this.stage >= 2, () => {
        this.say([
          { speaker: 'Inês', text: tx('Rua de São João. I ran cigarettes and penicillin up this hill for six years. Knew every doorway to duck into.', 'Rua de São João. Seis anos a subir este monte com tabaco e penicilina. Conhecia cada portal onde me enfiar.') },
          { speaker: 'Beatriz', text: tx('Is that how you knew my dad?', 'Foi assim que conheceste o meu pai?') },
          { speaker: 'Inês', text: tx('He was the man who bought the penicillin. For your mother. Then, later, for you.', 'Ele era o homem que comprava a penicilina. Para a tua mãe. Depois, mais tarde, para ti.') },
        ]);
      }),
      // Largo: a step objective through the swaying dead
      this.trig('largoMid', new THREE.Vector3(12, 12, -70), 6, () => this.stage === 2, () => {
        this.step(tx('Slip through the merchants\' arcade — the errantes hunt by sound',
          'Passa pela arcada dos mercadores — os errantes caçam pelo som'), new THREE.Vector3(27, 13, -92));
        this.say([
          { speaker: 'Beatriz', text: tx('There are more of them than you said.', 'Há mais deles do que disseste.') },
          { speaker: 'Inês', text: tx('There always are. Sound is a door, Bia — keep it shut. Listen for their breathing; go when it fades.', 'Há sempre. O som é uma porta, Bia — mantém-na fechada. Ouve a respiração deles; avança quando se esvai.') },
        ]);
      }),
      // Flores: teaches crafting in the fiction
      this.trig('floresScavenge', new THREE.Vector3(26, 15, -100), 6, () => this.stage === 3, () => {
        this.step(tx('Climb Rua das Flores to the station — scavenge the shops for parts on the way',
          'Sobe a Rua das Flores até à estação — vasculha as lojas por peças pelo caminho'), this.world.locations.stationDoor);
        this.say([
          { speaker: 'Inês', text: tx('The jewellers\' street. Gold\'s worthless now — but people left the useful things. Rags, bottles, blades.', 'A rua dos ourives. O ouro não vale nada agora — mas deixaram as coisas úteis. Panos, garrafas, lâminas.') },
          { speaker: 'Inês', text: tx('Pick up what you find and press X. Two scraps become a bandage, a molotov, a shiv. Out here, junk is the difference between us and them.', 'Apanha o que encontrares e carrega em X. Duas peças viram uma ligadura, um molotov, uma navalha. Aqui fora, o lixo é a diferença entre nós e eles.') },
        ]);
      }),
      // São Bento: a scare in the tiled dark
      this.trig('stationScare', new THREE.Vector3(70, 22, -134), 6, () => this.stage === 4, () => {
        this.audio.play('eco', new THREE.Vector3(76, 22, -132));
        this.say([
          { speaker: 'Beatriz', text: tx('(whisper) One\'s right there. It\'s just... standing. Listening.', '(sussurro) Está ali um. Está só... parado. A ouvir.') },
          { speaker: 'Inês', text: tx('(whisper) Don\'t. Move. Let it pass. Breathe through your nose and count the tiles.', '(sussurro) Não. Te. Mexas. Deixa-o passar. Respira pelo nariz e conta os azulejos.') },
        ]);
      }),
      // Sé: Falcão names the stakes, mid-fight
      this.trig('falcaoTaunt', new THREE.Vector3(74, 28, -62), 6, () => this.stage === 5, () => {
        this.audio.play('corvoAlert', new THREE.Vector3(90, 28, -50));
        this.say([
          { speaker: tx('Falcão, across the terrace', 'Falcão, do outro lado do terreiro'), text: tx('The smuggler bleeds like anyone, irmãos! Barbosa sent his ghost and a child! The notebook BURNS tonight!', 'A contrabandista sangra como qualquer um, irmãos! O Barbosa mandou o fantasma dele e uma criança! O caderno ARDE esta noite!') },
          { speaker: 'Inês', text: tx('Keep moving for the corner, Bia. Let him preach. Preachers run out of breath.', 'Continua para o canto, Bia. Deixa-o pregar. Os pregadores ficam sem fôlego.') },
        ]);
      }),
      // Codeçal: the descent
      this.trig('codecalDescent', new THREE.Vector3(105, 15, -6), 6, () => this.stage === 6, () => {
        this.say([
          { speaker: 'Inês', text: tx('Down the old wall. Careful — these steps are wet and eight hundred years old. They don\'t forgive a hurry.', 'Pela muralha velha abaixo. Cuidado — estes degraus estão molhados e têm oitocentos anos. Não perdoam a pressa.') },
          { speaker: 'Beatriz', text: tx('I can hear the river. And... something else.', 'Ouço o rio. E... mais qualquer coisa.') },
          { speaker: 'Inês', text: tx('That\'s the herd. That\'s the bridge. Don\'t look at all of them at once — you\'ll freeze. One girder at a time.', 'É a horda. É a ponte. Não olhes para todos de uma vez — vais gelar. Uma viga de cada vez.') },
        ]);
      }),
      // the bridge: the tensest step
      this.trig('bridgeMid', new THREE.Vector3(114, 6, 52), 7, () => this.stage === 6, () => {
        this.step(tx('Halfway across — move only when the herd drifts, freeze when they turn',
          'A meio da travessia — anda só quando a horda deriva, pára quando se viram'), this.world.locations.bridgeSouth);
        this.say([
          { speaker: 'Beatriz', text: tx('(barely breathing) One turned. Inês — one turned—', '(mal respira) Um virou-se. Inês — um virou-se—') },
          { speaker: 'Inês', text: tx('Stone. Be stone. Eyes down. ...Good girl. ...Now. Walk.', 'Pedra. Sê pedra. Olhos no chão. ...Boa menina. ...Agora. Anda.') },
        ]);
      }),
      // Bolhão: a signpost on the praça — the market is an optional detour worth taking
      this.trig('bolhaoHint', new THREE.Vector3(11, 22, -148), 7, () => this.stage >= 3, () => {
        this.say([
          { speaker: 'Inês', text: tx('That street north goes up to the Bolhão — the old market. Survivors ran a trading post in there for years.', 'Aquela rua para norte sobe até ao Bolhão — o mercado velho. Os sobreviventes tiveram lá um posto de troca durante anos.') },
          { speaker: 'Beatriz', text: tx('Is anyone still trading?', 'Ainda há alguém a trocar?') },
          { speaker: 'Inês', text: tx('No. But a market that died in a hurry leaves its shelves full. If you want parts for the kit, that is where they are. It is a detour, not the road — your call.', 'Não. Mas um mercado que morre com pressa deixa as prateleiras cheias. Se queres peças para o kit, é ali que estão. É um desvio, não é o caminho — decides tu.') },
        ]);
      }),
      this.trig('cardBolhao', new THREE.Vector3(11, 22, -167), 6, () => this.stage >= 3, () => {
        this.ui.areaCard('Mercado do Bolhão', tx('the market quarter', 'o bairro do mercado'));
        this.say([
          { speaker: 'Inês', text: tx('Weapons were left at that gate once. Keep yours. Stalls make good cover — and good cover works for them too.', 'Antigamente deixavam-se as armas naquele portão. Guarda a tua. As bancas são bom abrigo — e o bom abrigo também lhes serve a eles.') },
          { speaker: 'Beatriz', text: tx('There are stairs up to the galleries.', 'Há escadas para as galerias.') },
          { speaker: 'Inês', text: tx('Then we go high. Up there we see them before they hear us — and the good stock is always where the water never reached.', 'Então vamos por cima. Lá em cima vemo-los antes de nos ouvirem — e o bom material está sempre onde a água nunca chegou.') },
        ]);
      }),
      // Gaia bank: the quiet interlude — the heart of it
      this.trig('gaiaRest', new THREE.Vector3(99, 0, 120), 6, () => this.stage === 7, () => {
        this.player.frozen = true;
        this.say([
          { speaker: 'Inês', text: tx('Sit. One minute. We earned one minute.', 'Senta-te. Um minuto. Merecemos um minuto.') },
          { speaker: 'Beatriz', text: tx('I\'ve never been on this side of the river. Eight years I looked at it from the wall.', 'Nunca estive deste lado do rio. Oito anos a olhar para ele da muralha.') },
          { speaker: 'Inês', text: tx('Your mother used to say the far bank was where the city kept its second chances.', 'A tua mãe dizia que a outra margem era onde a cidade guardava as segundas oportunidades.') },
          { speaker: 'Beatriz', text: tx('You knew her too? My mother?', 'Também a conhecias? À minha mãe?') },
          { speaker: 'Inês', text: tx('Everyone who moved medicine knew Mariana. She was the reason half of us kept a conscience. She\'d be unbearably proud of you right now.', 'Toda a gente que mexia em remédios conhecia a Mariana. Era a razão de metade de nós manter a consciência. Estaria insuportavelmente orgulhosa de ti agora.') },
          { speaker: 'Beatriz', text: tx('What if the doctors can\'t do anything with me? What if I came all this way and I\'m just... a girl?', 'E se os médicos não conseguirem fazer nada comigo? E se andei este caminho todo e sou só... uma miúda?') },
          { speaker: 'Inês', text: tx('Then you\'re a girl who crossed the bridge nobody crosses. That\'s not nothing, Bia. That\'s the opposite of nothing.', 'Então és uma miúda que atravessou a ponte que ninguém atravessa. Isso não é nada, Bia. É o contrário de nada.') },
          { speaker: 'Beatriz', text: tx('...Okay. Okay. Let\'s go meet your doctors.', '...Está bem. Está bem. Vamos conhecer os teus médicos.') },
        ], { onEnd: () => { this.player.frozen = false; } });
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

  noteMesh() {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.44),
      new THREE.MeshStandardMaterial({ color: 0xcabfa0, roughness: 0.95, side: THREE.DoubleSide }));
    paper.rotation.x = -Math.PI / 2 + 0.15;
    paper.rotation.z = (Math.random() - 0.5) * 0.5;
    paper.castShadow = true;
    g.add(paper);
    // scrawled lines
    for (let i = 0; i < 4; i++) {
      const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.014),
        new THREE.MeshStandardMaterial({ color: 0x2a2318, side: THREE.DoubleSide }));
      ln.rotation.x = -Math.PI / 2 + 0.15;
      ln.rotation.z = paper.rotation.z;
      ln.position.set(0, 0.012, -0.12 + i * 0.07);
      g.add(ln);
    }
    return g;
  }

  // the world's memory — seven writings left behind, TLOU-style
  makeNotes() {
    const notes = [
      { id: 'note1', pos: new THREE.Vector3(-32, 0.16, 17), stage: 1,
        title: tx('Chalk on a quay wall', 'Giz numa parede do cais'), src: tx('scrawled in chalk', 'rabiscado a giz'),
        journal: tx('Day 40 of the outbreak: the army sealed the bridges with the sick still inside. Whoever wrote it knew they were being walled in to die.', 'Dia 40 do surto: o exército selou as pontes com os doentes ainda lá dentro. Quem escreveu isto sabia que estava a ser emparedado para morrer.'),
        lines: [
          tx('DAY 40. They closed the bridges. Sealed the city with the sick still inside.', 'DIA 40. Eles fecharam as pontes. Selaram a cidade com os doentes lá dentro.'),
          tx('"Containment", they call it. What do we call it? We were left behind like all the rest.', '"Contenção", chamam-lhe. Nós chamamos-lhe o quê? Fomos deixados para trás como os outros.'),
          tx('If you are reading this and still breathing — Porto did not fall. Porto was locked. Remember the difference.', 'Se lês isto e ainda respiras — o Porto não caiu. O Porto foi trancado. Lembra-te da diferença.'),
        ] },
      { id: 'note2', pos: new THREE.Vector3(-13, 12.16, -69), stage: 2,
        title: tx('Pharmacy ledger, last page', 'Livro da farmácia, última página'), src: tx('a pharmacist\'s hand', 'a letra de um farmacêutico'),
        journal: tx('The Largo pharmacy rationed its last antibiotics to children first. The final entry is a list of names, then nothing.', 'A farmácia do Largo racionou os últimos antibióticos, primeiro às crianças. O último registo é uma lista de nomes, e depois nada.'),
        lines: [
          tx('We rationed to the very end. Children first, always. Then the old. Then us.', 'Racionámos até ao fim. As crianças primeiro, sempre. Depois os velhos. Depois nós.'),
          tx('There is no penicillin left in all of Porto. Only what Dr. Rocha is trying to make, across the river.', 'Já não há penicilina em todo o Porto. Só o que a Dra. Rocha tenta fazer, do outro lado do rio.'),
          tx('If you can get across — take the ones coughing blood. Do not leave them the way they left me.', 'Se conseguires atravessar — leva os que tossem sangue. Não os deixes como me deixaram a mim.'),
        ] },
      { id: 'note3', pos: new THREE.Vector3(80, 22.16, -126), stage: 4,
        title: tx('Message pinned in the station', 'Recado pregado na estação'), src: tx('many different hands', 'muitas letras diferentes'),
        journal: tx('Hundreds sheltered in São Bento when the bridges closed. The spores came up through the tunnels. The notes on the wall stop, all at once, on the same night.', 'Centenas abrigaram-se em São Bento quando as pontes fecharam. Os esporos subiram pelos túneis. Os recados na parede param, todos ao mesmo tempo, na mesma noite.'),
        lines: [
          tx('There are 200 of us in here. Food for ten days. The tiled walls keep us warm.', 'Estamos 200 aqui dentro. Comida para dez dias. As paredes de azulejo mantêm-nos quentes.'),
          tx('(another hand) 60 now. They came up through the tunnels. Make no noise. Do not run. They hear.', '(outra letra) 60 agora. Vieram pelos túneis. Não façam barulho. Não corram. Eles ouvem.'),
          tx('(another hand, shaking) if you read this do not stay. they are still in the trains. god, the noise they make—', '(outra letra, tremida) se lês isto não fiques. eles ainda estão nos comboios. deus, o barulho que fazem—'),
        ] },
      { id: 'note4', pos: new THREE.Vector3(73, 28.16, -58), stage: 5,
        title: tx('The Corvos\' creed', 'O credo dos Corvos'), src: tx('Falcão, their leader', 'Falcão, o líder deles'),
        journal: tx('Falcão\'s gang, the Corvos, hold the Sé. He preaches that the cure is a lie the dead tell — and that Mariana\'s notebook must burn so no one leaves the walls "soft with hope".', 'O bando do Falcão, os Corvos, dominam a Sé. Ele prega que a cura é uma mentira que os mortos contam — e que o caderno da Mariana tem de arder para que ninguém saia das muralhas "amolecido pela esperança".'),
        lines: [
          tx('The cure is the lie the dead tell the living to make them cross the bridge and die.', 'A cura é a mentira que os mortos contam aos vivos para os fazer atravessar a ponte e morrer.'),
          tx('The woman Mariana filled a notebook with that lie. We burned her laboratory. We will burn the notebook.', 'A mulher Mariana encheu um caderno com essa mentira. Queimámos o laboratório dela. Queimaremos o caderno.'),
          tx('Porto belongs to those who accept Porto. — Falcão', 'O Porto pertence aos que aceitam o Porto. — Falcão'),
        ] },
      { id: 'note5', pos: new THREE.Vector3(90, 28.16, -46), stage: 5,
        title: tx('A letter, never sent', 'Uma carta, nunca enviada'), src: tx('Mariana, to her daughter', 'Mariana, para a filha'),
        journal: tx('Mariana\'s last letter to Beatriz, taken as a trophy by the Corvos. She knew the Corvos were coming for her, and sent Beatriz to Rui before they did. Beatriz should read this. Someday.', 'A última carta da Mariana para a Beatriz, levada como troféu pelos Corvos. Ela sabia que os Corvos a vinham buscar, e mandou a Beatriz para o Rui antes disso. A Beatriz devia ler isto. Um dia.'),
        lines: [
          tx('My Bia. If you are reading this, I did not get out in time, and Rui kept his promise.', 'Minha Bia. Se estás a ler isto, eu não consegui sair a tempo, e o Rui cumpriu a promessa.'),
          tx('You are not an experiment. You are the proof that this ends. Your blood remembers how to live.', 'Tu não és uma experiência. És a prova de que isto acaba. O teu sangue lembra-se de como se vive.'),
          tx('Go with Inês. Trust her as you would trust me. And do not cry for long — we have no time for that. I love you.', 'Vai com a Inês. Confia nela como confiarias em mim. E não chores muito tempo — não temos tempo para isso. Amo-te.'),
        ] },
      { id: 'note6', pos: new THREE.Vector3(114, 6.16, 56), stage: 6,
        title: tx('Carved into a bridge girder', 'Gravado numa viga da ponte'), src: tx('knife on iron', 'faca sobre ferro'),
        journal: tx('Someone tried to cross the herd before you. They carved a tally of thirteen names into the girder. The last name is unfinished.', 'Alguém tentou atravessar a horda antes de ti. Gravaram uma conta de treze nomes na viga. O último nome está por acabar.'),
        lines: [
          tx('Thirteen of us tried the bridge at dawn. We counted the names out loud to keep ourselves from running.', 'Treze de nós tentámos a ponte ao amanhecer. Contámos os nomes para não corrermos.'),
          tx('Slowly. Iron to iron. When they turn, you are stone. When they drift, you walk.', 'Devagar. Ferro a ferro. Quando eles se viram, ficas pedra. Quando derivam, andas.'),
          tx('Ana. Tó. Rui P. Céu. Manel. Sofia. On the other side, on the other si—', 'Ana. Tó. Rui P. Céu. Manel. Sofia. Do outro lado, do outro la—'),
        ] },
      { id: 'note7', pos: new THREE.Vector3(66, 0.16, 137), stage: 7,
        title: tx('The doctors\' board', 'O quadro dos médicos'), src: tx('Dr. Amélia Rocha', 'Dra. Amélia Rocha'),
        journal: tx('The caves have kept working for eight years on faith alone — Mariana\'s early data, and the hope that one immune child might one day walk in from the far bank.', 'As caves continuaram a trabalhar oito anos só com fé — os primeiros dados da Mariana, e a esperança de que uma criança imune pudesse, um dia, chegar da outra margem.'),
        lines: [
          tx('Eight years. Without Mariana\'s notebook we work blind, on the little she left us.', 'Oito anos. Sem o caderno da Mariana, trabalhamos às cegas com o pouco que ela nos deixou.'),
          tx('We do not stop. A city that stops treating its sick is already dead — it just does not know yet.', 'Não paramos. Uma cidade que pára de tratar já está morta, apenas ainda não sabe.'),
          tx('If someone, someday, crosses that bridge with her daughter and her pages — we will have a beginning.', 'Se alguém, algum dia, atravessar aquela ponte com a filha dela e as suas páginas — teremos começo.'),
        ] },
      // --- Ribeira: the river was the first way out, and the first to close
      { id: 'note8', pos: new THREE.Vector3(-44, 0.16, 12), stage: 1,
        title: tx('A boatman\'s last log', 'O último registo de um barqueiro'), src: tx('pencil in a rabelo\'s ledger', 'a lápis, no livro de um rabelo'),
        journal: tx('A rabelo skipper ran people downriver toward the sea in the first weeks. The river mouth was netted and gunned. His last entry counts the boats that never came back.', 'Um mestre de rabelo levou pessoas rio abaixo, para o mar, nas primeiras semanas. A foz foi fechada com redes e armas. O último registo conta os barcos que nunca voltaram.'),
        lines: [
          tx('Week three. I took forty downriver at night, engines dead, running on the current alone.', 'Semana três. Levei quarenta rio abaixo, à noite, com os motores mortos, só a corrente.'),
          tx('The river mouth is closed with nets and armed men. Turn back, they told us, or we sink you.', 'A foz está fechada com redes e homens armados. Mandaram-nos voltar ou afundam-nos.'),
          tx('I counted the boats that never came back: seven. The river carries nobody out any more. Only down.', 'Contei os barcos que não voltaram: sete. O rio já não leva ninguém para fora. Só para baixo.'),
        ] },
      // --- the Largo: a family had to choose which of them went into the shelter
      { id: 'note9', pos: new THREE.Vector3(24, 12.16, -70), stage: 2,
        title: tx('A child\'s drawing, pinned to a door', 'Um desenho de criança, pregado a uma porta'), src: tx('crayon, then pencil', 'lápis de cor, depois grafite'),
        journal: tx('A child drew their whole family under a yellow sun. Later, in pencil, three of the figures were crossed out — and an adult\'s hand added a line below.', 'Uma criança desenhou a família inteira sob um sol amarelo. Mais tarde, a lápis, três figuras foram riscadas — e uma letra de adulto acrescentou uma linha por baixo.'),
        lines: [
          tx('My family: mum, dad, grandad, my sister and me. And the yellow sun on top.', 'A minha família: a mãe, o pai, o avô, a mana e eu. E o sol amarelo por cima.'),
          tx('(below, in pencil) just my sister and me now. but i drew us all anyway.', '(por baixo, a lápis) já só a mana e eu. mas desenhei-nos a todos à mesma.'),
          tx('(an adult\'s hand) we took the two children to São Bento. God forgive us the choice.', '(letra de adulto) levámos as duas crianças para São Bento. que Deus nos perdoe a escolha.'),
        ] },
      // --- Almeida Garrett plaza: what wealth was worth, at the end
      { id: 'note10', pos: new THREE.Vector3(24, 22.16, -122), stage: 3,
        title: tx('Note taped to a jeweller\'s till', 'Recado colado numa caixa registadora'), src: tx('the shopkeeper', 'o dono da loja'),
        journal: tx('A jeweller left the safe open and the gold untouched, offering the whole shop for a car battery that turns over and a week of insulin.', 'Um joalheiro deixou o cofre aberto e o ouro intacto, oferecendo a loja inteira por uma bateria de carro que pegue e uma semana de insulina.'),
        lines: [
          tx('The safe is open. The gold is yours. It is not worth a single day of food.', 'O cofre está aberto. O ouro é vosso. Não vale um dia de comida.'),
          tx('I will trade the whole shop — everything — for a car battery that turns over and a week of insulin.', 'Troco a loja inteira — tudo — por uma bateria de carro que pegue e insulina para uma semana.'),
          tx('If nobody comes, let someone at least take the rings. They were my wife\'s.', 'Se ninguém vier, ao menos alguém que fique com os anéis. Eram da minha mulher.'),
        ] },
      // --- São Bento: the last train, and the man who chained the gates
      { id: 'note11', pos: new THREE.Vector3(58, 22.16, -118), stage: 4,
        title: tx('Dispatcher\'s board, last shift', 'Quadro do chefe de estação, último turno'), src: tx('the last dispatcher', 'o último chefe de estação'),
        journal: tx('The last train never left platform one. The dispatcher held it for evacuees — then heard the clicking come up the line from the tunnels, and chained the gates from the outside.', 'O último comboio nunca saiu da linha 1. O chefe de estação segurou-o pelos evacuados — depois ouviu os estalidos subir a linha desde os túneis, e trancou os portões pelo lado de fora.'),
        lines: [
          tx('The 23:40 train held on platform one. Waiting for the last of them. I promised I would wait.', 'Comboio das 23h40 retido na linha 1. Espero pelos últimos. Prometi que esperava.'),
          tx('Something is coming up the tunnel. Clicking. A great deal of it. They are not people — not any more.', 'Vem qualquer coisa pelo túnel. Estalidos. Muitos. Não são pessoas — já não.'),
          tx('I chained the gates from the outside. May those left inside forgive me. There was no other way.', 'Tranquei os portões pelo lado de fora. Que me perdoem os que ficaram dentro. Não havia outra.'),
        ] },
      // --- the Sé: not every Corvo believes Falcão
      { id: 'note12', pos: new THREE.Vector3(60, 28.16, -68), stage: 5,
        title: tx('A Corvo\'s confession, hidden in a helmet', 'Confissão de um Corvo, escondida num capacete'), src: tx('a young Corvo', 'um Corvo jovem'),
        journal: tx('One of Falcão\'s men no longer believes the creed. He keeps a spare knife, he writes — not for outsiders, but for the night he finally runs.', 'Um dos homens do Falcão já não acredita no credo. Guarda uma faca a mais, escreve — não para os de fora, mas para a noite em que finalmente fugir.'),
        lines: [
          tx('Falcão says the cure is a lie. But if it is a lie, why is he so afraid of the notebook?', 'O Falcão diz que a cura é mentira. Mas se é mentira, porque é que ele tem tanto medo do caderno?'),
          tx('I saw the girl they are hunting. She did not look like a lie. She looked like somebody\'s daughter.', 'Vi a miúda que eles procuram. Não parecia uma mentira. Parecia uma filha.'),
          tx('I keep one knife more than I need. It is not for outsiders. It is for the night I run from here.', 'Guardo uma faca a mais. Não é para os de fora. É para a noite em que eu fugir daqui.'),
        ] },
      // --- the bridge: a smuggler's route, answered years later by R.B.
      { id: 'note13', pos: new THREE.Vector3(111, 6.16, 34), stage: 6,
        title: tx('A smuggler\'s mark on a girder', 'A marca de um contrabandista, numa viga'), src: tx('two hands, years apart', 'duas letras, com anos de intervalo'),
        journal: tx('A smuggling route marked in code on the bridge iron. A second, newer hand answers it — and signs off "R.B." The same initials as Rui Barbosa.', 'Uma rota de contrabando marcada em código no ferro da ponte. Uma segunda letra, mais recente, responde-lhe — e assina "R.B." As mesmas iniciais de Rui Barbosa.'),
        lines: [
          tx('Smuggler\'s mark: chalk on the third girder = clear passage until first light.', 'Marca do contrabandista: giz na terceira viga = passagem livre até de madrugada.'),
          tx('(another hand, more recent) the route still holds. I have crossed here thirty times. — R.B.', '(outra letra, mais recente) a rota ainda serve. já passei aqui trinta vezes. — R.B.'),
          tx('(below) if you read this and you have a child with you, move at night and do not look down.', '(por baixo) se lês isto e tens uma criança contigo, anda de noite e não olhes para baixo.'),
        ] },
      // --- the Bolhão: the market became a trading post, and the trading post killed it
      { id: 'note15', pos: new THREE.Vector3(14, 25.75, -195), stage: 3,
        title: tx('Market ledger, nailed to a post', 'Livro do mercado, pregado a um poste'), src: tx('the market keeper', 'a guarda do mercado'),
        journal: tx('Survivors turned the Bolhão into the city\'s last market — barter only, no coin, weapons left at the gate. It worked for two years. It ended when they let a sick man trade indoors, out of pity.', 'Os sobreviventes transformaram o Bolhão no último mercado da cidade — só troca, sem dinheiro, armas à porta. Funcionou dois anos. Acabou quando, por pena, deixaram um homem doente negociar lá dentro.'),
        lines: [
          tx('Market rules: no coin, barter only. Weapons stay at the gate. If you cough, you trade from outside.', 'Regras do mercado: nada de dinheiro, só troca. Armas ficam no portão. Quem tossir, negocia de fora.'),
          tx('Two years of trade. Potatoes for batteries. Bandages for salt. A winter coat for a live cockerel.', 'Dois anos a funcionar. Batatas por pilhas. Ligaduras por sal. Um casaco de inverno por um galo vivo.'),
          tx('Today we let in a man who was coughing. He had a daughter in his arms and I could not say no.', 'Hoje deixámos entrar um homem que tossia. Tinha uma filha ao colo e eu não fui capaz de dizer não.'),
          tx('(the writing stops mid-word) if you read this, take what you need. There is nobody left here to trade with—', '(a letra acaba a meio) se lês isto, leva o que precisares. Já não há aqui ninguém para trocar contigo—'),
        ] },
      // --- the caves: a wall of volunteers who bled for a cure that never came
      { id: 'note14', pos: new THREE.Vector3(92, 0.16, 116), stage: 7,
        title: tx('A volunteer\'s card on the cave wall', 'Um cartão de voluntário, na parede da cave'), src: tx('a resistance volunteer', 'um voluntário da resistência'),
        journal: tx('The caves keep a wall of volunteers who gave blood to Amélia\'s failing cultures. Most names are crossed through. The last card is blank — waiting for a name.', 'As caves guardam uma parede de voluntários que deram sangue às culturas falhadas da Amélia. Quase todos os nomes estão riscados. O último cartão está em branco — à espera de um nome.'),
        lines: [
          tx('I have given blood eight times. The doctor says it is not enough without the original source. I give it anyway.', 'Dei sangue oito vezes. A Dra. diz que sem a fonte original não chega. Mas dou à mesma.'),
          tx('If the immune girl ever crosses, my blood will not have been for nothing. Nor anyone else\'s.', 'Se a menina imune atravessar um dia, o meu sangue não terá sido em vão. Nem o dos outros.'),
          tx('(the last card on the wall is blank, waiting for a name)', '(o último cartão da parede está em branco, à espera de um nome)'),
        ] },
    ];
    return notes.map((n) => {
      this.makeProp(n.id, n.pos, this.noteMesh());
      return {
        id: n.id, pos: n.pos, radius: 2.2, prompt: tx('Read the writing', 'Ler o escrito'),
        when: () => this.stage >= n.stage && !this.props[n.id].taken,
        action: () => {
          this.props[n.id].taken = true;
          this.scene.remove(this.props[n.id].mesh, this.props[n.id].glow);
          this.notesFound++;
          this.audio.play('pickup');
          this.say(n.lines.map((t) => ({ speaker: n.src, text: t })),
            { onEnd: () => this.ui.addJournal(n.title, n.journal) });
        },
      };
    });
  }

  // A Corvo you left alive at the Sé, bleeding out — spare or finish. Sets the tone
  // of your run and colours the ending.
  makeWoundedCorvo() {
    this.wounded = makePerson({ shirt: 0x33302c, pants: 0x26241f, skin: 0xb08a6a, hat: 0x1c1a18 });
    this.wounded.position.set(84, 28, -66);
    this.wounded.rotation.set(Math.PI / 2 - 0.1, 0.6, 0); // slumped against the wall
    this.wounded.visible = false;
    this.scene.add(this.wounded);
    return {
      id: 'wounded', pos: new THREE.Vector3(84, 28, -66), radius: 2.6,
      prompt: tx('The wounded Corvo', 'O Corvo ferido'),
      when: () => this.stage === 5 && this.flags.corvoBeaten && this.mercy === null && this.wounded.visible,
      action: () => this.woundedChoice(),
    };
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

  molotovMesh() {
    const g = new THREE.Group();
    const glass = new THREE.MeshStandardMaterial({ color: 0x2f5238, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.72 });
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.32, 10), glass);
    bottle.position.y = 0.16;
    bottle.castShadow = true;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.12, 8), glass);
    neck.position.y = 0.38;
    const rag = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshStandardMaterial({ color: 0xd8c89a, roughness: 0.9 }));
    rag.position.y = 0.46;
    g.add(bottle, neck, rag);
    return g;
  }

  componentMesh(kind) {
    const g = new THREE.Group();
    if (kind === 'rag') {
      const m = new THREE.MeshStandardMaterial({ color: 0x9a8f7a, roughness: 1 });
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.2), m);
      cloth.position.y = 0.04; cloth.rotation.y = 0.3; cloth.castShadow = true;
      const fold = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.16), m);
      fold.position.set(0.03, 0.1, 0.02); fold.rotation.y = -0.2;
      g.add(cloth, fold);
    } else if (kind === 'alcohol') {
      const glass = new THREE.MeshStandardMaterial({ color: 0x7a5a2a, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.7 });
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.28, 10), glass);
      bottle.position.y = 0.14; bottle.castShadow = true;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.1, 8), glass);
      neck.position.y = 0.33;
      g.add(bottle, neck);
    } else if (kind === 'blade') {
      const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.35, metalness: 0.85 });
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.32), steel);
      blade.position.y = 0.06; blade.castShadow = true;
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.9 }));
      handle.position.set(0, 0.06, 0.19);
      g.add(blade, handle);
    } else { // scrap — a little heap of rusted metal bits
      const rust = new THREE.MeshStandardMaterial({ color: 0x6a5540, roughness: 0.85, metalness: 0.5 });
      for (let i = 0; i < 4; i++) {
        const bit = new THREE.Mesh(new THREE.BoxGeometry(0.08 + Math.random() * 0.08, 0.05, 0.1 + Math.random() * 0.08), rust);
        bit.position.set((Math.random() - 0.5) * 0.2, 0.03 + Math.random() * 0.04, (Math.random() - 0.5) * 0.2);
        bit.rotation.set(Math.random(), Math.random() * 3, Math.random());
        bit.castShadow = true;
        g.add(bit);
      }
    }
    return g;
  }

  // build a component-pickup interactable (the first one also teaches the craft menu)
  compPickup(id, kind, stage, first = false) {
    const names = {
      rag: tx('Grab the rag', 'Apanhar o pano'),
      alcohol: tx('Take the alcohol', 'Levar o álcool'),
      blade: tx('Take the blade', 'Pegar na lâmina'),
      scrap: tx('Gather the scrap', 'Juntar a sucata'),
    };
    const label = { rag: ['Rag', 'Pano'], alcohol: ['Alcohol', 'Álcool'], blade: ['Blade', 'Lâmina'], scrap: ['Scrap', 'Sucata'] }[kind];
    return this.pickup(id, names[kind], () => {
      this.player.addComponent(kind, 1);
      const en = `${label[0]} +1.` + (first ? ' Scavenged parts craft into bandages, molotovs and shivs — open the kit with [X].' : '');
      const pt = `${label[1]} +1.` + (first ? ' As peças recolhidas fabricam ligaduras, molotovs e navalhas — abre o kit com [X].' : '');
      this.ui.toast({ en, pt });
    }, () => this.stage >= stage);
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
    // a pickup buried in a wall is invisible and unreachable — slide it into the open
    if (this.world.insideSolid(pos.x, pos.y + 0.15, pos.z)) {
      const out = this.world.pushOutOfSolids(pos.x, pos.y + 0.15, pos.z);
      pos = pos.clone().set(out.x, pos.y, out.z);
      const gh = this.world.groundAt(out.x, out.z, pos.y + 3);
      if (gh !== null && Math.abs(gh + 0.15 - pos.y) < 3) pos.y = gh + 0.15;
    }
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
    this.onCheckpoint?.();      // main autosaves here
  }

  setStage(n) {
    this.stage = n;
    const objectives = {
      0: tx('Gather what Rui left you — the notebook, and something to swing',
        'Reúne o que o Rui te deixou — o caderno, e algo para bater'),
      1: tx('The quay east is collapsed — climb through the city. Reach Rua de São João',
        'O cais a leste ruiu — sobe pela cidade. Chega à Rua de São João'),
      2: tx('Cross the Largo de São Domingos and climb Rua das Flores',
        'Atravessa o Largo de São Domingos e sobe a Rua das Flores'),
      3: tx('Reach São Bento station on Praça de Almeida Garrett',
        'Chega à estação de São Bento, na Praça de Almeida Garrett'),
      4: tx('Cross the station hall — silently — and take the south alley to the Sé',
        'Atravessa o átrio da estação — em silêncio — e sobe o beco sul até à Sé'),
      5: tx('Get past the Corvos to the Escadas do Codeçal, south-east corner',
        'Passa pelos Corvos até às Escadas do Codeçal, canto sudeste'),
      6: tx('Cross the lower deck of Ponte Luís I — girder to girder, quiet and slow',
        'Atravessa o tabuleiro inferior da Ponte Luís I — viga a viga, devagar e calado'),
      7: tx('Find the doctors in the Caves do Douro, along the Gaia bank',
        'Encontra os médicos nas Caves do Douro, ao longo do cais de Gaia'),
    };
    this.subMarker = null;   // fresh stage — clear any mid-stage waypoint
    if (objectives[n]) this.ui.setObjective(objectives[n]);
    if (this.onStageChange) this.onStageChange(n);
  }

  // update the objective mid-stage and point the marker at an interim waypoint
  step(objective, marker = null) {
    this.ui.setObjective(objective);
    this.subMarker = marker;
  }

  markerTarget() {
    if (this.subMarker) return this.subMarker;
    const L = this.world.locations;
    switch (this.stage) {
      case -1: return this.rui.position;   // the opening: guide the player to turn around
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
    this.ui.areaCard('Cais da Ribeira', tx('Porto — year 8 of the Cinza', 'Porto — ano 8 da Cinza'));
    this.ui.setObjective(tx('Turn around — Rui is behind you, on the mattress',
      'Vira-te — o Rui está atrás de ti, no colchão'));
    this.say([
      { speaker: 'Inês', text: tx('The river still smells the same. Salt, silt, and rust. Everything else this city was — the ash took.', 'O rio ainda cheira ao mesmo. Sal, lodo e ferrugem. Tudo o resto que esta cidade foi — a cinza levou.') },
      { speaker: 'Inês', text: tx('Rui\'s message reached me at the west wall this morning: "Come before dark. Bring nothing. Tell no one." Eight years of smuggling taught me what that grammar means.', 'O recado do Rui chegou-me à muralha oeste esta manhã: "Vem antes de escurecer. Não tragas nada. Não digas a ninguém." Oito anos de contrabando ensinaram-me o que essa gramática quer dizer.') },
      { speaker: 'Inês', text: tx('It means goodbye.', 'Quer dizer adeus.') },
    ]);
  }

  prologue() {
    this.player.frozen = true;
    this.say([
      { speaker: 'Rui', text: tx('Inês. You came. Don\'t — don\'t look at the arm. We both know the arithmetic of a bite.', 'Inês. Vieste. Não — não olhes para o braço. Ambos sabemos a aritmética de uma dentada.') },
      { speaker: 'Inês', text: tx('I have bandages. Alcohol. Shut up and let me work.', 'Tenho ligaduras. Álcool. Cala-te e deixa-me trabalhar.') },
      { speaker: 'Rui', text: tx('Fourteen hours, maybe less. So listen like it\'s the last thing I ask — because it is. Beatriz. The spores don\'t take her. They never have.', 'Catorze horas, se calhar menos. Por isso ouve como se fosse a última coisa que peço — porque é. A Beatriz. Os esporos não lhe pegam. Nunca pegaram.') },
      { speaker: 'Inês', text: tx('...That\'s not possible. Nobody\'s immune.', '...Isso não é possível. Ninguém é imune.') },
      { speaker: 'Rui', text: tx('Mariana proved it before the Corvos burned her lab. Her notebook survived — it\'s on that crate. Blood work, cultures, all of it. A cure starts with that book and my daughter\'s pulse.', 'A Mariana provou-o antes de os Corvos lhe queimarem o laboratório. O caderno dela sobreviveu — está naquele caixote. Análises de sangue, culturas, tudo. Uma cura começa com esse caderno e com o pulso da minha filha.') },
      { speaker: 'Rui', text: tx('There are doctors in the old wine caves, Gaia side. Resistance. Dr. Amélia Rocha. Get them across the river, Inês.', 'Há médicos nas velhas caves do vinho, do lado de Gaia. Resistência. A Dra. Amélia Rocha. Leva-os para o outro lado do rio, Inês.') },
      { speaker: 'Inês', text: tx('The bridge belongs to the herd, Rui. Nobody crosses.', 'A ponte é da horda, Rui. Ninguém atravessa.') },
      { speaker: 'Rui', text: tx('You do. You\'re the best smuggler left on this side of the wall — and the only person alive I\'d trust with her. ...Bia. Come out, filha. It\'s time.', 'Tu atravessas. És a melhor contrabandista que resta deste lado da muralha — e a única pessoa viva a quem eu a confiaria. ...Bia. Sai, filha. Está na hora.') },
      { speaker: 'Beatriz', text: tx('I\'m not leaving you.', 'Não te vou deixar.') },
      { speaker: 'Rui', text: tx('You\'re not leaving me. You\'re carrying me — everything of me that matters walks out that door with you. Vai. E não olhes para trás.', 'Não me estás a deixar. Estás a levar-me — tudo o que de mim importa sai por aquela porta contigo. Vai. E não olhes para trás.') },
    ], {
      onEnd: () => {
        this.player.frozen = false;
        this.follower.setActive(true, new THREE.Vector3(-54, 0, 9));
        this.ui.addJournal('Rui', tx('Bitten, dying, and still giving orders. Take Beatriz and Mariana\'s notebook to Dr. Amélia in the Gaia caves. His last run, traded to me.', 'Mordido, a morrer, e ainda a dar ordens. Levar a Beatriz e o caderno da Mariana à Dra. Amélia, nas caves de Gaia. A última entrega dele, passada a mim.'));
        this.setStage(0);
      },
    });
  }

  checkPrologueDone() {
    if (this.hasNotebook && this.weapons.owned.plank && this.stage === 0) {
      this.say([
        { speaker: 'Beatriz', text: tx('...The quay east of the square fell into the river two winters ago. We can\'t just walk to the bridge.', '...O cais a leste da praça caiu ao rio há dois invernos. Não podemos ir a pé até à ponte.') },
        { speaker: 'Inês', text: tx('Then we go up — São João, the largo, through São Bento, past the Sé, and down the old wall to the deck. The long way. My way.', 'Então vamos por cima — São João, o largo, por São Bento, pela Sé, e descemos a muralha velha até ao tabuleiro. O caminho longo. O meu caminho.') },
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

  woundedChoice() {
    this.player.frozen = true;
    this.say([
      { speaker: 'Corvo', text: tx('Wait— wait. I have nothing. Falcão took all of it. Please, don\'t.', 'Espera— espera. Não tenho nada. O Falcão levou tudo. Por favor, não.') },
      { speaker: 'Beatriz', text: tx('(quiet) He\'s just bleeding there, Inês. He\'s younger than you said they\'d be.', '(baixinho) Ele está só ali a sangrar, Inês. É mais novo do que disseste que eram.') },
      { speaker: 'Inês', text: tx('He\'s a Corvo, Bia. His people burned your mother\'s work. Burned people.', 'É um Corvo, Bia. A gente dele queimou o trabalho da tua mãe. Queimou pessoas.') },
      { speaker: 'Corvo', text: tx('I burned nothing. I was fourteen when this started. Just... do not leave me here for the ecos to find. Either finish it, or help me.', 'Eu não queimei nada. Tinha catorze anos quando isto começou. Só... não me deixem aqui para os ecos me encontrarem. Ou acabem, ou ajudem.') },
    ], {
      choices: [
        {
          label: tx('Lower the weapon. He keeps his life.', 'Baixar a arma. Ele fica com a vida.'),
          onPick: () => { this.mercy = 'spare'; this.afterWounded(); },
        },
        {
          label: tx('Finish it — quick. He\'d have done the same to Beatriz.', 'Acabar — depressa. Ele teria feito o mesmo à Beatriz.'),
          onPick: () => { this.mercy = 'kill'; this.afterWounded(); },
        },
      ],
    });
  }

  afterWounded() {
    this.player.frozen = false;
    if (this.mercy === 'spare') {
      this.wounded.rotation.z = 0.25;
      this.ui.addJournal(tx('The wounded Corvo', 'O Corvo ferido'), tx('I left him alive. Beatriz watched me choose it — watched me choose it in front of her. Whatever it costs later, she saw her mother\'s daughter make that call.', 'Deixei-o vivo. A Beatriz viu-me escolher isso — viu-me escolher à frente dela. Custe o que custar mais tarde, viu a filha da mãe dela fazer essa escolha.'));
      this.ui.toast(tx('You lower the plank. At your side, Beatriz\'s fist slowly unclenches.', 'Baixas a tábua. Ao teu lado, o punho da Beatriz vai-se abrindo devagar.'));
    } else {
      this.wounded.visible = false;
      this.audio.play('hitFlesh', this.wounded.position);
      this.ui.addJournal(tx('The wounded Corvo', 'O Corvo ferido'), tx('I finished him. Quick, at least. Beatriz looked away — but she did not argue. The city teaches that lesson early, and cheap.', 'Acabei com ele. Depressa, ao menos. A Beatriz desviou o olhar — mas não discutiu. A cidade ensina essa lição cedo, e barata.'));
      this.ui.toast(tx('It is done. Beatriz says nothing for a long while.', 'Está feito. A Beatriz fica muito tempo sem dizer nada.'));
    }
  }

  finale() {
    this.player.frozen = true;
    const kills = this.infectedKilled;
    this.say([
      { speaker: 'Dr. Amélia', text: tx('Stop there. ...A smuggler, armed with a fence post, and a child. Of everything the river has washed up this year—', 'Alto aí. ...Uma contrabandista, armada com uma estaca de cerca, e uma criança. De tudo o que o rio trouxe este ano—') },
      { speaker: 'Inês', text: tx('Rui Barbosa sent us. This is Beatriz. And this—', 'Foi o Rui Barbosa que nos mandou. Esta é a Beatriz. E isto—') },
      { speaker: 'Dr. Amélia', text: tx('...Mariana\'s notebook. Deus. We thought it burned with her. Child, your mother\'s work — do you know what this is?', '...O caderno da Mariana. Deus. Julgávamos que tinha ardido com ela. Menina, o trabalho da tua mãe — sabes o que é isto?') },
      { speaker: 'Beatriz', text: tx('It\'s me. Page forty-one. I\'m what\'s left of her experiment.', 'Sou eu. Página quarenta e um. Sou o que resta da experiência dela.') },
      { speaker: 'Dr. Amélia', text: tx('With the notebook we can begin. But the cultures need her — months of draws, spinal fluid, marrow. She would stay here, inside the caves, until it\'s done. Perhaps years.', 'Com o caderno podemos começar. Mas as culturas precisam dela — meses de colheitas, líquido da espinha, medula. Ela teria de ficar aqui, dentro das caves, até estar feito. Talvez anos.') },
      { speaker: 'Dr. Amélia', text: tx('Or you take her, leave the book, and we work from paper alone — slower, blinder, maybe never. I won\'t force a child. So it falls to you, smuggler. What crosses back over that bridge?', 'Ou levas-la, deixas o caderno, e trabalhamos só a partir do papel — mais devagar, mais às cegas, talvez nunca. Não obrigo uma criança. Por isso cabe a ti, contrabandista. O que volta a atravessar aquela ponte?') },
      { speaker: 'Beatriz', text: tx('Inês. You don\'t get to carry me and decide for me both.', 'Inês. Não podes carregar-me e decidir por mim ao mesmo tempo.') },
      { speaker: 'Inês', text: tx('...No. I don\'t. But your father put you in my hands, Bia. I have to answer for what I do with them. Look at me — whatever I choose now, I choose it with you, not around you.', '...Não. Não posso. Mas o teu pai pôs-te nas minhas mãos, Bia. Tenho de responder pelo que faço com elas. Olha para mim — o que quer que eu escolha agora, escolho-o contigo, não à tua revelia.') },
    ], {
      choices: [
        {
          label: tx('She stays. Make the cure. (I\'ll stay with her.)', 'Ela fica. Façam a cura. (Eu fico com ela.)'),
          onPick: () => { this.endingChoice = 'stay'; this.epilogue(); },
        },
        {
          label: tx('The notebook stays. Beatriz comes with me.', 'O caderno fica. A Beatriz vem comigo.'),
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
      ? tr(tx('You crossed a dead city without adding one body to its count. Rui would have called that art.',
        'Atravessaste uma cidade morta sem lhe acrescentar um único corpo à conta. O Rui teria chamado a isso arte.'))
      : tr(tx(`The plank is notched ${this.infectedKilled} times over. You stopped counting; the wood didn't.`,
        `A tábua tem ${this.infectedKilled} entalhes. Tu deixaste de contar; a madeira não.`));
    const deathLine = this.timesDied === 0 ? '' : '<br><br>' + tr(tx(
      'You still dream of the times the ash nearly had you. In the dream, Beatriz keeps walking south, like she promised.',
      'Ainda sonhas com as vezes em que a cinza quase te apanhou. No sonho, a Beatriz continua a andar para sul, como prometeu.'));
    // the mercy you showed (or didn't) at the Sé follows you into the epilogue
    const mercyLine = this.mercy === 'spare'
      ? tr(tx('The Corvo you spared at the Sé lived. A year on he walked into the Gaia caves with two others and asked, without meeting anyone\'s eye, whether the cure took volunteers. Beatriz was the one who said yes.',
        'O Corvo que poupaste na Sé sobreviveu. Um ano depois entrou nas caves de Gaia com outros dois e perguntou, sem olhar ninguém nos olhos, se a cura aceitava voluntários. Foi a Beatriz quem disse que sim.'))
      : this.mercy === 'kill'
        ? tr(tx('Beatriz never mentions the Corvo you finished on the terrace. But she has her mother\'s habit of writing everything down, and some pages she keeps turned face to the wall.',
          'A Beatriz nunca fala do Corvo que acabaste no terreiro. Mas tem o hábito da mãe de escrever tudo, e há páginas que mantém viradas para a parede.'))
        : '';
    // reading the city's writings changes what Beatriz carries out of it
    const loreLine = this.notesFound >= 10
      ? tr(tx('Beatriz read every scrap the dead Porto left behind — the chalk, the ledgers, the letter her mother never sent. She is twelve and she knows exactly what was taken, and from whom. That knowledge will be its own kind of weapon.',
        'A Beatriz leu cada pedaço que o Porto morto deixou para trás — o giz, os livros, a carta que a mãe nunca enviou. Tem doze anos e sabe exatamente o que foi tirado, e a quem. Esse conhecimento será a sua própria arma.'))
      : this.notesFound >= 5
        ? tr(tx('Between you, you carried out a handful of the city\'s last writings — enough that Beatriz will not grow up believing the Porto beyond the walls was always a graveyard.',
          'Entre as duas, levaram convosco alguns dos últimos escritos da cidade — o suficiente para que a Beatriz não cresça a acreditar que o Porto para lá das muralhas foi sempre um cemitério.'))
        : tr(tx('You carried out almost nothing of what the city wrote in its final days. Beatriz will have to take the ruin\'s word for what it was — and the ruin lies.',
          'Não levaste quase nada do que a cidade escreveu nos seus últimos dias. A Beatriz terá de acreditar na palavra da ruína sobre o que ela foi — e a ruína mente.'));
    const endings = {
      stay: [
        tr(tx('Beatriz stayed. So did you — Amélia found she had two uses for a smuggler: needles come up the river now, glass and reagents and stolen generators, every run yours.',
          'A Beatriz ficou. Tu também — a Amélia descobriu que tinha dois usos para uma contrabandista: agora as agulhas sobem o rio, vidro e reagentes e geradores roubados, cada entrega tua.')),
        tr(tx('On the wall of the cellar, Beatriz keeps a tally in chalk: not of days, but of draws. "Every line is a street we get back," she says. She sounds like her mother, according to Amélia. She sounds like her father, according to you.',
          'Na parede da cave, a Beatriz mantém uma conta a giz: não de dias, mas de colheitas. "Cada risco é uma rua que recuperamos", diz ela. Parece a mãe, segundo a Amélia. Parece o pai, segundo tu.')),
        tr(tx('In the spring of the ninth year, a rabelo crossed at dawn flying a white rag — the first vaccine lot, going north. The herd on the bridge parted around the bell of its wake like it heard something it remembered.',
          'Na primavera do nono ano, um rabelo atravessou de madrugada com um trapo branco içado — o primeiro lote de vacina, a subir para norte. A horda na ponte abriu-se em torno do sino da sua esteira como se ouvisse algo de que se lembrava.')),
        cleanLine + deathLine,
        tr(tx('<br><i>O Porto ainda respira. — Porto still breathes.</i>', '<br><i>O Porto ainda respira.</i>')),
      ],
      leave: [
        tr(tx('You left the notebook weighted under a lamp, and walked Beatriz back over the bridge before the tide — girder to girder, her hand in yours, the herd swaying past like drowned dancers.',
          'Deixaste o caderno preso debaixo de um candeeiro, e levaste a Beatriz de volta pela ponte antes da maré — viga a viga, a mão dela na tua, a horda a oscilar ao lado como dançarinos afogados.')),
        tr(tx('The doctors work from Mariana\'s pages. Slower, blinder — but every month a runner brings a vial of Beatriz\'s blood down the wall at Matosinhos, drawn at her aunt\'s kitchen table, labelled in a twelve-year-old\'s handwriting: "para o Porto, com juros".',
          'Os médicos trabalham a partir das páginas da Mariana. Mais devagar, mais às cegas — mas todos os meses um mensageiro traz um frasco do sangue da Beatriz pela muralha de Matosinhos, colhido na mesa da cozinha da tia, rotulado pela letra de uma miúda de doze anos: "para o Porto, com juros".')),
        tr(tx('Amélia says paper and post may take ten years. Beatriz says her mother started with less. You say nothing; you\'re a smuggler, and you\'ve learned what always crosses in the end: everything, if someone carries it.',
          'A Amélia diz que o papel e o correio podem levar dez anos. A Beatriz diz que a mãe começou com menos. Tu não dizes nada; és contrabandista, e aprendeste o que acaba sempre por atravessar: tudo, se alguém o levar.')),
        cleanLine + deathLine,
        tr(tx('<br><i>O rio guarda segredos. As pessoas, não. — The river keeps secrets. People don\'t.</i>', '<br><i>O rio guarda segredos. As pessoas, não.</i>')),
      ],
    };
    // stitch the moral/lore reflections into the chosen ending
    const chosen = endings[this.endingChoice].slice();
    chosen.splice(chosen.length - 1, 0, [mercyLine, loreLine].filter(Boolean).join('<br><br>'));
    setTimeout(() => {
      if (this.onGameEnd) this.onGameEnd(chosen.filter(Boolean).join('<br><br>'));
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
