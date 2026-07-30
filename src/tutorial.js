// CINZA — the opening lessons, taught by doing rather than by a toast you can miss.
//
// Each step shows a persistent prompt and only clears when the player actually performs
// the action. Nothing blocks: every step also has a patience timer, so a player who
// already knows the game (or simply wanders off) is never held up by it.
import { L as tx } from './lang.js';

const STEPS = [
  {
    id: 'crouch',
    when: (c) => c.stage >= 1,
    hint: tx('Hold [C] to crouch — upright footsteps carry',
             'Mantém [C] para te agachares — passos em pé ouvem-se ao longe'),
    done: (c) => c.crouchHeld > 0.6,
    praise: tx('Good. Crouched, you are almost silent.', 'Boa. Agachada, és quase silenciosa.'),
    patience: 75,
  },
  {
    id: 'listen',
    when: (c) => c.stage >= 1,
    hint: tx('Hold [V] to listen — you will sense them through the walls',
             'Mantém [V] para escutar — vais senti-los através das paredes'),
    done: (c) => c.listenHeld > 0.8,
    praise: tx('That is how you read a street before you walk it.',
               'É assim que se lê uma rua antes de a andar.'),
    patience: 75,
  },
  {
    id: 'craft',
    // only once they are actually carrying something worth combining
    when: (c) => c.components >= 2,
    hint: tx('Press [X] — two scraps make a bandage', 'Carrega em [X] — duas peças fazem uma ligadura'),
    done: (c) => c.craftOpened,
    praise: tx('Rags, alcohol, a blade. Out here that is a medicine cabinet.',
               'Panos, álcool, uma lâmina. Aqui fora, isso é um armário de farmácia.'),
    patience: 90,
  },
];

export class Tutorial {
  constructor() {
    this.index = 0;
    this.armed = false;       // waits for its trigger condition
    this.t = 0;               // time the current step has been showing
    this.praiseT = 0;
    this.praiseText = null;
    this.done = false;
    this.crouchHeld = 0;
    this.listenHeld = 0;
    this.craftOpened = false;
  }

  // a returning player who already got past the opening should not be re-taught
  skipAll() { this.done = true; this.index = STEPS.length; }

  get current() { return this.done ? null : STEPS[this.index]; }

  // returns the text to show (or null)
  update(dt, ctx) {
    if (this.praiseT > 0) {
      this.praiseT -= dt;
      if (this.praiseT > 0) return this.praiseText;
      this.praiseText = null;
    }
    const step = this.current;
    if (!step) return null;

    // accumulate the "held" inputs the steps test against
    this.crouchHeld = ctx.crouching ? this.crouchHeld + dt : 0;
    this.listenHeld = ctx.listening ? this.listenHeld + dt : 0;
    if (ctx.craftOpen) this.craftOpened = true;

    if (!step.when({ ...ctx, components: ctx.components })) return null;
    this.t += dt;

    const c = { ...ctx, crouchHeld: this.crouchHeld, listenHeld: this.listenHeld, craftOpened: this.craftOpened };
    if (step.done(c)) {
      this.praiseText = step.praise;
      this.praiseT = 3.2;
      this.advance();
      return this.praiseText;
    }
    // never nag: after its patience runs out the step steps aside
    if (this.t > step.patience) { this.advance(); return null; }
    return step.hint;
  }

  advance() {
    this.index++;
    this.t = 0;
    this.crouchHeld = 0;
    this.listenHeld = 0;
    this.craftOpened = false;
    if (this.index >= STEPS.length) this.done = true;
  }
}
