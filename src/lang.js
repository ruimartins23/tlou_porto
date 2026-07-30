// CINZA — bilingual (English / Português) support.
// Displayed text can be a plain string (English) or a {en, pt} object; tr() resolves
// it against the current language at render time, falling back to English.
export const Lang = { cur: 'en' };

export function setLang(l) { Lang.cur = (l === 'pt') ? 'pt' : 'en'; }

export function tr(v) {
  if (v && typeof v === 'object' && !Array.isArray(v) && ('en' in v || 'pt' in v)) {
    return v[Lang.cur] ?? v.en ?? v.pt ?? '';
  }
  return v;
}

// convenience: build a bilingual pair
export function L(en, pt) { return { en, pt }; }

// static UI strings (title screen, HUD labels, screens) keyed by id
export const UI_TEXT = {
  tagline: L('uma história do Porto', 'uma história do Porto'),
  intro: L(
    "Eight years since the spores came up the river and the bridges closed. Porto is a walled ruin of moss and ash — and you, Inês Barbosa, know every stone of it. Tonight your oldest friend is dying in a cellar on the Cais da Ribeira, and what he asks of you weighs more than the city: his daughter, and a notebook that could end the plague.",
    "Oito anos desde que os esporos subiram o rio e as pontes fecharam. O Porto é uma ruína murada de musgo e cinza — e tu, Inês Barbosa, conheces cada pedra dele. Esta noite o teu amigo mais antigo está a morrer numa cave no Cais da Ribeira, e o que te pede pesa mais do que a cidade: a filha dele, e um caderno que podia acabar com a praga."),
  begin: L('Begin', 'Começar'),
  loadingNote: L('Aim for the head. Take them silently from behind. Runners are loud; walkers live longer.',
    'Aponta à cabeça. Apanha-os por trás, em silêncio. Correr faz barulho; quem anda devagar vive mais.'),
  paused: L('Paused', 'Em pausa'),
  resume: L('Resume', 'Continuar'),
  tryAgain: L('Try Again', 'Tentar de novo'),
  playAgain: L('Play Again', 'Jogar de novo'),
  epilogue: L('Epílogo', 'Epílogo'),
  deathTitle: L('a cinza leva-te', 'a cinza leva-te'),
  langLabel: L('Português', 'English'),   // the button shows the OTHER language
  // HUD
  bandages: L('Bandages', 'Ligaduras'),
  bricks: L('Bricks', 'Tijolos'),
  molotov: L('Molotov', 'Molotov'),
  torch: L('Torch', 'Lanterna'),
  reload: L('reload', 'recarregar'),
  unarmed: L('Unarmed', 'Desarmado'),
  objectiveLabel: L('Objective', 'Objetivo'),
  notebook: L('Notebook', 'Caderno'),
  notebookClose: L('[J] close', '[J] fechar'),
  notebookSub: L("Inês Barbosa — what's left of the truth", 'Inês Barbosa — o que resta da verdade'),
  notebookEmpty: L('Nothing written yet.', 'Ainda nada escrito.'),
  interactContinue: L('continue', 'continuar'),
  crouched: L('crouched', 'agachado'),
  listening: L('listening', 'a escutar'),
  shiv: L('Shiv', 'Navalha'),
  // crafting
  craftTitle: L('Craft', 'Fabricar'),
  craftSub: L('Scavenged parts — spend them wisely.', 'Peças recolhidas dos escombros — gasta-as bem.'),
  craftClose: L('[X] close', '[X] fechar'),
  craftCarry: L('carrying', 'levas'),
  // settings + loading + save
  settingsTitle: L('Settings', 'Definições'),
  setSensitivity: L('Mouse sensitivity', 'Sensibilidade do rato'),
  setBrightness: L('Brightness', 'Brilho'),
  setVolume: L('Volume', 'Volume'),
  setQuality: L('Graphics quality', 'Qualidade gráfica'),
  qLow: L('Low', 'Baixa'),
  qMedium: L('Medium', 'Média'),
  qHigh: L('High', 'Alta'),
  setClose: L('Close', 'Fechar'),
  continueRun: L('Continue', 'Continuar'),
  loadingBuild: L('building Porto…', 'a construir o Porto…'),
  saved: L('Progress saved', 'Progresso guardado'),
  craftEmpty: L('You have nothing to build with. Search the ruins for parts.', 'Não tens nada para construir. Vasculha as ruínas por peças.'),
  comp_rag: L('Rag', 'Pano'),
  comp_alcohol: L('Alcohol', 'Álcool'),
  comp_blade: L('Blade', 'Lâmina'),
  comp_scrap: L('Scrap', 'Sucata'),
  item_bandage: L('Bandage', 'Ligadura'),
  item_molotov: L('Molotov', 'Molotov'),
  item_shiv: L('Shiv', 'Navalha'),
  // weapon names
  wpn_plank: L('Plank', 'Tábua'),
  wpn_revolver: L('Revolver', 'Revólver'),
  wpn_shotgun: L('Sawn-off', 'Caçadeira'),
};
