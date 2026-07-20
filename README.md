# CINZA — uma história do Porto

**A The Last of Us–style first-person survival narrative set in a post-outbreak, ruined Porto.**
Built from scratch in **Three.js + Vite** — no game engine, no asset store. Every building, texture, sound, and character is generated in code.

> Eight years since the spores came up the river and the bridges closed. Porto is a walled ruin of moss and ash — and you, **Inês Barbosa**, know every stone of it. Tonight your oldest friend is dying in a cellar on the Cais da Ribeira, and what he asks of you weighs more than the city: his daughter, **Beatriz**, and a notebook that could end the plague.

---

## The game

You play Inês, a smuggler escorting a girl and a cure across the corpse of the city — from Rui's Ribeira shelter, up through the real streets of Porto, over the lower deck of the **Ponte Luís I**, to the wine caves of Gaia. It's a stealth-survival journey with a branching ending: what you carry, who you spare, and whether you **stay or leave** changes how it ends.

The route follows the actual city:
**Cais da Ribeira → Rua de São João → Largo de São Domingos → Rua das Flores → São Bento station → Terreiro da Sé → Escadas do Codeçal → Ponte Luís I → the Gaia caves.**

### Three things hunt you
- **Errantes** (runners) — fast, they see and swarm you. Loud, and they bring friends.
- **Ecos** (clickers) — blind but lethal; two hits and you're gone. They hunt by sound alone. Crouch, or die.
- **Corvos** (scavengers) — a coordinated human gang holding the Sé. They take cover, peek to shoot, flank, and rally the moment one of them spots you.

## Features

- **Stealth that thinks** — enemies patrol, hear your footsteps, investigate noises, and **search the area** where they lost you before giving up. Spot one Corvo and the whole gang converges.
- **Listen Mode** (hold `V`) — TLOU-style focus: the world drains to cold monochrome and enemies glow through walls, colour-coded by how alert they are.
- **Stealth takedowns** — approach an unaware enemy from behind and take them silently.
- **Sprint stamina** — you can outrun a chaser in a burst, but not forever; sprinting is loud and drains fast.
- **Improvised arsenal** — a nail-studded plank (with real hit feedback), a revolver, a sawn-off shotgun, distraction **bricks**, and **molotovs** that pool into fire and clear a whole pack.
- **Survival economy** — scarce bandages, ammo, and throwables scattered across the ruins.
- **14 hidden notes** — the city's last writings, telling the story of how Porto fell, for you to find.
- **Cinematic presentation** — HDR bloom, a custom colour-grade shader, positional 3D audio, and procedurally-built landmarks (twin-towered Sé, the crescent iron bridge, azulejo-tiled São Bento).
- **Fully bilingual** — English / European Portuguese, switchable live.

## Run it

Requires [Node.js](https://nodejs.org/) (v18+).

```bash
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser and press **Begin**.

To build a static production bundle:

```bash
npm run build     # outputs to dist/
npm run preview   # serve the built bundle locally
```

## Controls

| | |
|---|---|
| **W A S D** | Move |
| **Shift** | Sprint (uses stamina) |
| **C** | Crouch (sneak) |
| **V** | Listen / focus |
| **Mouse** | Look |
| **Left click** | Attack / fire |
| **Right click** | Aim |
| **1 2 3** | Switch weapon |
| **E** | Interact / stealth takedown |
| **R** | Reload |
| **Q** | Throw brick (distraction) |
| **G** | Throw molotov |
| **H** | Bandage (heal) |
| **F** | Flashlight |
| **J** | Notebook (collected notes) |
| **Esc** | Pause |

**Tips:** Aim for the head. Take them silently from behind. Runners are loud; walkers live longer. The ecos can't see you — but they hear everything.

## Tech

- **[Three.js](https://threejs.org/)** — WebGL rendering
- **[Vite](https://vitejs.dev/)** — dev server & bundler
- **WebAudio** — all sound is synthesized at runtime (no audio files)
- **Canvas 2D** — all textures are drawn procedurally (no image assets)

Everything is plain ES modules under [`src/`](src/): `world.js` (terrain, bridge, sky), `districts.js` (buildings & interiors), `characters.js` (enemy AI & companion), `player.js` (controller, combat, throwables), `story.js` (stages, dialogue, pickups), `weapons.js`, `audio.js`, `ui.js`, `textures.js`, `grade.js` (colour-grade shader), and `main.js` (render pipeline & game loop).

---

*A fan-made, non-commercial project inspired by the tone of Naughty Dog's* The Last of Us*, set in the real geography of Porto, Portugal.*
