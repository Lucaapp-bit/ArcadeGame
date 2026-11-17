/* LEOPOLDO — Gran Pesca di Natale (edizione regalo brutto)
 * Un solo comando: TIENI PREMUTO / RILASCIA (spazio, mouse o touch).
 * Canvas + WebAudio, nessuna dipendenza. Oggetti pescabili in items.js.
 */
(() => {
'use strict';
const ITEMS = window.PESCA_ITEMS, drawIcon = window.pescaDrawIcon, fishShape = window.pescaFishShape;
const W = 960, H = 540, TAU = Math.PI * 2, DT = 1 / 60, SEA = 292;
const LX = 176, LY = SEA - 10;                       // piedi di Leopoldo sul molo
const FONT = '"Trebuchet MS","Segoe UI",system-ui,sans-serif';
const BITE_WIN = 1.1;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scale = 1, offX = 0, offY = 0, dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vw = window.innerWidth, vh = window.innerHeight;
  canvas.width = Math.floor(vw * dpr); canvas.height = Math.floor(vh * dpr);
  canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
  scale = Math.min(vw / W, vh / H); offX = (vw - W * scale) / 2; offY = (vh - H * scale) / 2;
}
window.addEventListener('resize', resize); resize();

const rnd = (a, b) => a + Math.random() * (b - a);
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
const mmss = s => { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function wpick(list, wf) {
  let s = 0; for (const it of list) s += wf(it);
  let r = Math.random() * s;
  for (const it of list) { r -= wf(it); if (r <= 0) return it; }
  return list[list.length - 1];
}

// ───────────────────────── salvataggio ─────────────────────────
let save = { best: 0, dex: {}, runs: 0, bestCombo: 0, done: false };
try { const s = JSON.parse(localStorage.getItem('leopoldo.save')); if (s && s.dex) save = Object.assign(save, s); } catch (e) {}
const persist = () => { try { localStorage.setItem('leopoldo.save', JSON.stringify(save)); } catch (e) {} };
const dexCount = () => ITEMS.filter(i => save.dex[i.id]).length;


// ───────────────────────── stato ─────────────────────────
const G = {
  mode: 'title', t: 0, ph: 'idle', pt: 0, time: 0, score: 0, combo: 0, ansia: 0,
  tc: 0, power: 0, bx: 0, by: SEA, bx0: 0, tx: 0, item: null, wt: 2, zone: 0, reel: null, card: null,
  parts: [], floats: [], ped: null, nextPed: 25, nextKnee: 18, knee: 0, bubble: null, mut: 6, shake: 0, flash: 0,
  stats: null, overT: 0, finT: 0, sel: 0, prevMode: 'title', over: null, cut: 0, lostMsg: '',
};
let holding = false, touchMode = false;

// ───────────────────────── audio ─────────────────────────
let ac = null, muted = false, amb = null;
try { muted = localStorage.getItem('leopoldo.mute') === '1'; } catch (e) {}
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(f, d, type, v, slide, delay) {
  if (muted) return; const a = audio(); if (!a) return;
  const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.07, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.03);
}
function noise(d, v, hp) {
  if (muted) return; const a = audio(); if (!a) return;
  const n = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, n, a.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), g = a.createGain(); s.buffer = buf; g.gain.value = v || 0.1;
  if (hp) { const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; s.connect(f); f.connect(g); } else s.connect(g);
  g.connect(a.destination); s.start();
}
const sfx = {
  charge() { tone(300, 0.08, 'triangle', 0.03, 330); },
  cast() { noise(0.35, 0.09, 1500); tone(700, 0.3, 'sine', 0.04, 220); },
  splash() { noise(0.3, 0.12, 700); tone(200, 0.15, 'sine', 0.05, 90); },
  bite() { tone(1175, 0.1, 'square', 0.07); tone(1568, 0.16, 'square', 0.07, 0, 0.09); },
  hook() { tone(400, 0.12, 'sawtooth', 0.05, 800); },
  tick() { tone(900, 0.03, 'square', 0.02); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'triangle', 0.08, 0, i * 0.08)); },
  big() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.18, 'triangle', 0.09, 0, i * 0.08)); },
  gag() { tone(330, 0.12, 'square', 0.06, 220); tone(247, 0.22, 'square', 0.06, 160, 0.1); },
  lose() { tone(300, 0.3, 'sawtooth', 0.06, 110); },
  ahi() { tone(520, 0.1, 'square', 0.07, 300); tone(300, 0.25, 'sawtooth', 0.06, 110, 0.08); },
  horn() { tone(196, 0.35, 'sawtooth', 0.05); tone(247, 0.35, 'sawtooth', 0.04, 0, 0.02); },
  pill() { [660, 880, 1320].forEach((f, i) => tone(f, 0.1, 'sine', 0.07, 0, i * 0.06)); },
  crisis() { for (let i = 0; i < 6; i++) tone(i % 2 ? 880 : 660, 0.16, 'square', 0.06, 0, i * 0.17); },
  select() { tone(700, 0.05, 'square', 0.04); },
  fanfare() { [523, 523, 523, 659, 784, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'triangle', 0.08, 0, i * 0.13)); },
};
function startAmb() {
  const a = audio(); if (!a || amb || muted) return;
  const n = a.sampleRate * 2, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < n; i++) { last = (last + (Math.random() * 2 - 1) * 0.04) * 0.985; d[i] = last * 8; }
  const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(), lfo = a.createOscillator(), lg = a.createGain();
  s.buffer = buf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 520; g.gain.value = 0.05;
  lfo.frequency.value = 0.11; lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain); lfo.start();
  s.connect(f); f.connect(g); g.connect(a.destination); s.start(); amb = { g };
}
function setAmb() { if (amb) amb.g.gain.value = muted ? 0 : 0.05; }
// musichetta marinara procedurale
const MU = { bpm: 88, root: 57, sc: [0, 2, 4, 7, 9], bass: [0, 5, 7, 4], step: 0, next: 0, lead: [] };
(() => {
  let seed = 9; const r = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let idx = 2; for (let i = 0; i < 64; i++) { if (i % 16 === 0) idx = Math.floor(r() * 5); if (r() < 0.55) { idx = cl(idx + Math.floor(r() * 5) - 2, 0, 9); MU.lead.push(idx); } else MU.lead.push(-1); }
})();
const mf = n => 440 * Math.pow(2, (n - 69) / 12);
function musicTick() {
  if (!ac || muted || G.mode === 'paused') return;
  const sd = 60 / MU.bpm / 4;
  if (MU.next < ac.currentTime - 0.2) MU.next = ac.currentTime + 0.05;
  while (MU.next < ac.currentTime + 0.12) {
    const s = MU.step, li = MU.lead[s % 64], t0 = MU.next - ac.currentTime;
    if (li >= 0) tone(mf(MU.root + 12 + 12 * Math.floor(li / 5) + MU.sc[li % 5]), sd * 2.2, 'triangle', 0.018, 0, t0);
    if (s % 8 === 0) tone(mf(MU.root - 12 + MU.bass[Math.floor(s / 16) % 4]), sd * 7, 'sine', 0.045, 0, t0);
    MU.next += sd; MU.step++;
  }
}

// ───────────────────────── effetti ─────────────────────────
function puff(x, y, n, col, spd, life, size, g) {
  for (let i = 0; i < n && G.parts.length < 260; i++) {
    const a = rnd(0, TAU), s = rnd(0.3, 1) * spd;
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * 0.3, life: life * rnd(0.6, 1), max: life, size: size * rnd(0.6, 1.2), col, g: g === undefined ? 380 : g });
  }
}
function floater(x, y, text, col, size) { G.floats.push({ x, y, text, col, size: size || 18, life: 1.5, max: 1.5 }); }
function splash(x) { puff(x, SEA, 16, '#dff6ff', 190, 0.7, 2.6); sfx.splash(); }
function fxUpdate(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 1 - 1.2 * dt;
    if (p.life <= 0) G.parts.splice(i, 1);
  }
  for (let i = G.floats.length - 1; i >= 0; i--) { const f = G.floats[i]; f.life -= dt; f.y -= 28 * dt; if (f.life <= 0) G.floats.splice(i, 1); }
  G.shake = Math.max(0, G.shake - 30 * dt); G.flash = Math.max(0, G.flash - dt);
}

// ───────────────────────── regole del gioco ─────────────────────────
const zoneOf = x => x < 470 ? 0 : x < 700 ? 1 : 2;
const ZN = ['VICINO', 'MEDIO', 'LARGO'];
const RANKS = [[0, 'Pescatore della Domenica (di un altro)'], [250, 'Apprendista Ansioso'], [700, 'Lupo di Mare con Tachipirina'],
  [1400, 'Pescatore Radical Chic'], [2400, 'Leopoldo il Grande, Terrore del Tonno']];
const rankOf = s => { let r = RANKS[0][1]; for (const [m, n] of RANKS) if (s >= m) r = n; return r; };
const MUTTER = {
  sig: ['Quanto cazzo sono forte!', 'Bro, devi andare dallo psicologo.', 'La Meloni è una fascista.', '30 scudetti sul campo!', 'Stiamo FORMANDO l\'Italia.'],
  lo: ['Che bella giornata per pescare.', 'Il mare di Sanremo mi rilassa.', 'Oggi si sta bene.', '30 scudetti sul campo!', 'Stiamo FORMANDO l\'Italia.', 'La Meloni è una fascista.'],
  mid: ['Mi sento strano...', 'Ho un neo sospetto.', 'Secondo me ho la febbre.', 'Mi gira un po\' la testa.', 'Bro, devi andare dallo psicologo.', 'La Meloni è una fascista.', '30 scudetti sul campo!', 'Stiamo FORMANDO l\'Italia.'],
  hi: ['Sto male. Sto MOLTO male.', 'Chiamate il 118!', 'Non respiro bene. (Respiro benissimo.)', 'È la fine. Dite a mamma.'],
};
const PEOPLE = {
  martino: { n: 'Martino', hello: 'Oh no... Martino.', sorry: 'Scusa Leo, sto timbrando!',
    lines: ['Ciao Leo! Sto timbrando!', 'Ho finito di lavorare... alle 8:01.', 'Ho già timbrato, Leo!', 'Leo, il ginocchio?'] },
  lucone: { n: 'Lucone', hello: 'Lucone. Lui e Martino fanno un ufficio.', sorry: 'Pausa caffè, Leo. Torno lunedì.',
    lines: ['Timbrato. Si va a casa.', 'Pausa caffè: tre ore.', 'Io e Martino reggiamo l\'Italia.', 'Leo, le tasse le paghi tu?'] },
  tommyv: { n: 'Tommy V', hello: 'Tommy V... aiuto.', sorry: 'Ai miei tempi si pescava meglio.',
    lines: ['Milano non è più quella di una volta.', 'Leo, aperitivo a Brera?', 'Stai coi radical chic, eh?', 'Qui ci vuole ordine!'] },
  donati: { n: 'Donati', hello: '30 scudetti sul campo!', sorry: 'Juventino! Ahahah!',
    lines: ['Juventino! Ahahah!', 'Inter campione, Leo!', 'Calciopoli, Leo. Calciopoli.', 'La Juve? Dai, dai...'] },
};
const PEOPLE_IDS = ['martino', 'lucone', 'tommyv', 'donati'];
const FORT = {
  pos: [
    'Il PD ha superato Fratelli d\'Italia!', 'È agosto: vai al mare a Sanremo!', 'Donati ha perso il derby. Bro.',
    'Oggi il ginocchio non fa male!', 'Tommy V è bloccato in tangenziale.', '30 scudetti sul campo!',
    'Martino ha chiesto scusa. (Sta sognando.)', 'Il medico dice: sei sanissimo!', 'Stiamo FORMANDO l\'Italia!',
  ],
  neg: [
    'Weekend lungo a Milano: paghi lo spritz 15 euro.', 'Paghi più tasse per mantenere Lucone e Martino.',
    'Niente calcetto il lunedì: il ginocchio ti fa male.', 'Donati ti manda il meme dell\'Inter.',
    'Lucone ti sorpassa in coda. Con il cartellino.', 'Tommy V ti invita a cena a Milano.',
    'Hai comunicato la destinazione dell\'addio al celibato: è ieri.', 'Il tuo piede-ferro-da-stiro sbaglia il rigore.',
    'Martino timbra e va a casa: il caffè lo paghi tu.',
  ],
};
const pickL = L => L[Math.floor(Math.random() * L.length)];
function rollFort() { return { pos: true, t: pickL(FORT.pos), a: -4, p: 60 }; }

function startRun() {
  Object.assign(G, { mode: 'play', ph: 'idle', pt: 0, time: 0, score: 0, combo: 0, ansia: 8, tc: 0, power: 0, item: null, card: null, reel: null,
    parts: [], floats: [], ped: null, pedN: 0, nextPed: 20, nextKnee: rnd(15, 24), knee: 0, bubble: null, mut: rnd(5, 8), shake: 0, flash: 0, over: null, bx: LX + 100, by: SEA });
  G.stats = { fish: 0, gag: 0, martino: 0, pills: 0, lost: 0, bestCombo: 0, dexNew: 0 };
  save.runs++; persist(); sfx.select();
}
const setPh = p => { G.ph = p; G.pt = 0; };

function playPress() {
  if (G.ph === 'idle') { setPh('charge'); G.tc = 0; G.power = 0; sfx.charge(); }
  else if (G.ph === 'wait') { G.bx0 = G.bx; setPh('retrieve'); }
  else if (G.ph === 'bite') { initReel(); setPh('reel'); }
  else if (G.ph === 'reveal') { if (G.pt > 0.6) dismissCard(); }
}
function playRelease() { if (G.ph === 'charge') doCast(); }
function press() {
  const m = G.mode;
  if (m === 'title') startRun();
  else if (m === 'over') { if (G.overT > 0.9) startRun(); }
  else if (m === 'paused') G.mode = 'play';
  else if (m === 'finale') { if (G.finT > 1.5) G.mode = 'play'; }
  else if (m === 'play') playPress();
}
function release() { if (G.mode === 'play') playRelease(); }

function doCast() {
  const p = G.power; G.tx = lerp(300, 900, p); G.zone = zoneOf(G.tx);
  setPh('cast'); sfx.cast();
}
function pickItem(zone) {
  const g = 1 + Math.min(1.2, G.time / 150);
  return wpick(ITEMS, it => it.z[zone] * (it.k === 'gag' ? g : 1));
}
function initReel() {
  const it = G.item;
  G.reel = { f: 0.5, ft: 0.5, ftimer: 0, z: 0.5, zv: 0, prog: 0.4, d: it.d, size: lerp(0.38, 0.2, it.d), inside: true, acc: 0 };
  G.bx0 = G.bx; sfx.hook();
}
function updateReel(dt) {
  const r = G.reel;
  r.ftimer -= dt;
  if (r.ftimer <= 0) { r.ft = rnd(0.06, 0.94); r.ftimer = rnd(0.5, 1.4) * (1.25 - r.d * 0.6); }
  const sp = 0.28 + 0.75 * r.d, df = r.ft - r.f;
  r.f += Math.sign(df) * Math.min(Math.abs(df), sp * dt);
  r.f = cl(r.f + Math.sin(G.time * 9) * 0.12 * r.d * dt, 0.03, 0.97);
  if (G.knee > 0 && Math.random() < dt * 5) r.zv += rnd(-2.4, 2.4);
  r.zv += (holding ? 2.6 : -2.2) * dt; r.zv *= 1 - 1.5 * dt; r.z += r.zv * dt;
  const lo = r.size / 2, hi = 1 - r.size / 2;
  if (r.z < lo) { r.z = lo; r.zv = Math.abs(r.zv) * 0.2; }
  if (r.z > hi) { r.z = hi; r.zv = -Math.abs(r.zv) * 0.2; }
  r.inside = Math.abs(r.f - r.z) <= r.size / 2;
  r.prog += (r.inside ? 0.36 * (1.1 - r.d * 0.3) : -0.16 * (0.6 + 0.7 * r.d)) * dt;
  r.acc += dt; if (r.acc > 0.12 && r.inside) { r.acc = 0; sfx.tick(); }
  G.bx = lerp(G.bx0, LX + 120, ease(cl(r.prog, 0, 1)));
  if (r.prog >= 1) catchItem();
  else if (r.prog <= 0) { G.lostMsg = 'Il pesce è scappato!'; loseLine(4, false); }
}
function loseLine(a, byPedalo) {
  G.ansia += a; G.combo = 0; G.stats.lost++; sfx.lose();
  G.malus = { t: pickL(FORT.neg), a: 5, p: -40 }; G.ansia += G.malus.a; G.score = Math.max(0, G.score + G.malus.p);
  floater(G.bx, SEA - 20, byPedalo ? (G.ped ? PEOPLE[G.ped.who].n : 'Martino') + ' ti ha tranciato la lenza!' : G.lostMsg, '#ff8a7a', 18);
  if (byPedalo && G.ped) G.ped.say = PEOPLE[G.ped.who].sorry;
  puff(G.bx, SEA, 10, '#dff6ff', 160, 0.6, 2.4); G.cut = 1; setPh('lost');
}
function catchItem() {
  const it = G.item, first = !save.dex[it.id];
  save.dex[it.id] = (save.dex[it.id] || 0) + 1;
  let pts = it.pts;
  if (it.k === 'fish') { G.combo = Math.min(5, G.combo + 1); pts = it.pts * G.combo; G.stats.fish++; sfx[it.pts >= 180 ? 'big' : 'win'](); }
  else if (it.k === 'pill') { G.stats.pills++; sfx.pill(); }
  else { G.combo = 0; G.stats.gag++; if (['martino', 'cartellino', 'cappello', 'lucone', 'tommyv', 'sciarpa'].includes(it.id)) G.stats.martino++; sfx.gag(); }
  G.stats.bestCombo = Math.max(G.stats.bestCombo, G.combo);
  save.bestCombo = Math.max(save.bestCombo, G.combo);
  if (first) { pts += 100; G.stats.dexNew++; }
  const fo = rollFort(it); G.score = Math.max(0, G.score + pts + fo.p); G.ansia = Math.max(0, G.ansia + (it.a > 0 ? it.a * 0.75 : it.a) + fo.a);
  (fo.pos ? sfx.win : sfx.lose)();
  G.card = { it, pts, first, combo: G.combo, done: false, fo };
  if (dexCount() === ITEMS.length && !save.done) { save.done = true; G.card.done = true; }
  persist(); setPh('reveal'); G.shake = it.k === 'gag' ? 6 : 0; if (it.k === 'gag') G.flash = 0.15;
}
function dismissCard() {
  const done = G.card && G.card.done; G.card = null; G.item = null; setPh('idle'); G.bx = LX + 100;
  if (done) { G.mode = 'finale'; G.finT = 0; sfx.fanfare(); }
}
function crisis() {
  G.mode = 'over'; G.overT = 0; G.shake = 14; G.flash = 0.6; holding = false;
  const newBest = G.score > save.best; if (newBest) save.best = G.score; persist();
  G.over = { newBest }; sfx.crisis();
}

function updateEvents(dt) {
  // ginocchio
  G.nextKnee -= dt;
  if (G.nextKnee <= 0 && ['charge', 'wait', 'bite', 'reel'].includes(G.ph)) {
    G.knee = 1.5; G.nextKnee = rnd(24, 42); G.ansia += 3; sfx.ahi(); G.shake = 6;
    G.bubble = { t: 'AHI, IL GINOCCHIO!', life: 1.6, hot: true };
  }
  if (G.knee > 0) G.knee -= dt;
  // pedalò di Martino
  G.nextPed -= dt;
  if (G.nextPed <= 0 && !G.ped) {
    const who = PEOPLE_IDS[G.pedN++ % 4], P = PEOPLE[who];
    G.ped = { x: W + 90, who, say: P.lines[Math.floor(Math.random() * P.lines.length)] };
    G.nextPed = rnd(28, 44); G.ansia += 2; sfx.horn();
    G.bubble = { t: P.hello, life: 2.4 };
  }
  if (G.ped) { G.ped.x -= 88 * dt; if (G.ped.x < -110) G.ped = null; }
  // borbottii
  if (G.bubble) { G.bubble.life -= dt; if (G.bubble.life <= 0) G.bubble = null; }
  G.mut -= dt;
  if (G.mut <= 0 && !G.bubble) {
    const set = Math.random() < 0.55 ? MUTTER.sig : G.ansia < 35 ? MUTTER.lo : G.ansia < 70 ? MUTTER.mid : MUTTER.hi;
    G.bubble = { t: set[Math.floor(Math.random() * set.length)], life: 2.6 }; G.mut = rnd(5, 8);
  }
}

function updatePlay(dt) {
  G.pt += dt;
  if (G.ph !== 'reveal') {
    G.time += dt;
    G.ansia += (0.5 + Math.min(0.9, G.time / 240 * 0.9)) * dt;
    updateEvents(dt);
  }
  switch (G.ph) {
    case 'charge': G.tc += dt; G.power = 0.5 - 0.5 * Math.cos(G.tc * TAU / 1.5); break;
    case 'cast': {
      const u = cl(G.pt / 0.6, 0, 1), rp = rodPose();
      G.bx = lerp(rp.tx, G.tx, u); G.by = lerp(rp.ty, SEA, u) - Math.sin(u * Math.PI) * 70;
      if (u >= 1) { G.by = SEA; splash(G.bx); G.wt = rnd(1.4, 3.4) + G.zone * 0.5; G.item = pickItem(G.zone); setPh('wait'); }
      break;
    }
    case 'wait': G.by = SEA + Math.sin(G.time * 3) * 1.5; if (G.pt >= G.wt) { setPh('bite'); sfx.bite(); puff(G.bx, SEA, 8, '#dff6ff', 120, 0.5, 2); } break;
    case 'bite':
      G.by = SEA + 7 + Math.sin(G.time * 50) * 2;
      if (G.pt > BITE_WIN) { G.lostMsg = 'Scappato! Eri distratto.'; loseLine(4, false); }
      break;
    case 'reel': updateReel(dt); G.by = SEA + 4; break;
    case 'retrieve': {
      const u = cl(G.pt / 0.45, 0, 1), rp = rodPose();
      G.bx = lerp(G.bx0, rp.tx, ease(u)); G.by = lerp(SEA, rp.ty + 26, ease(u));
      if (u >= 1) { setPh('idle'); G.bx = LX + 100; }
      break;
    }
    case 'lost': if (G.pt > 2.4) { G.item = null; setPh('idle'); G.bx = LX + 100; } break;
    default: break;
  }
  // pedalò che trancia la lenza
  if (G.ped && ['wait', 'bite', 'reel'].includes(G.ph) && Math.abs(G.ped.x - G.bx) < 48) loseLine(7, true);
  if (G.ph !== 'reveal' && G.ansia >= 100) crisis();
}

function update(dt) {
  G.t += dt;
  ambTick(dt);
  fxUpdate(dt);
  if (G.mode === 'play') updatePlay(dt);
  else if (G.mode === 'over') G.overT += dt;
  else if (G.mode === 'finale') { G.finT += dt; if (Math.random() < 0.4) puff(rnd(80, 880), -10, 1, ['#ffd24d', '#ff6b6b', '#8ff7ff', '#9bff8f', '#ff8fe6'][Math.floor(Math.random() * 5)], 40, 3, 3, 120); }
}
let ambT = 0;
function ambTick(dt) { ambT -= dt; if (ambT <= 0) { ambT = 0.35; if (G.mode !== 'dex') G.parts.push({ x: rnd(0, W), y: H + 4, vx: rnd(-6, 6), vy: -rnd(30, 60), life: 6, max: 6, size: rnd(1.5, 3.2), col: 'rgba(220,245,255,0.7)', g: -4, bub: true }); } }

// ───────────────────────── disegno: utilità ─────────────────────────
function txt(s, x, y, size, col, align, alpha, outline) {
  ctx.font = 'bold ' + size + 'px ' + FONT; ctx.textBaseline = 'middle'; ctx.textAlign = align || 'left';
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  if (outline) { ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = outline; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.globalAlpha = 1;
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function wrap(text, maxW, size) {
  ctx.font = 'bold ' + size + 'px ' + FONT;
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function glow(x, y, r, col, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
}
function bubble(x, y, text, o) {
  o = o || {}; const size = o.size || 15, lines = wrap(text, o.w || 190, size), lh = size + 4;
  ctx.font = 'bold ' + size + 'px ' + FONT;
  let mw = 0; for (const l of lines) mw = Math.max(mw, ctx.measureText(l).width);
  const bw = mw + 22, bh = lines.length * lh + 14, bx = cl(x - bw / 2, 8, W - bw - 8), by = y - bh;
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  ctx.fillStyle = o.hot ? '#fff1ee' : '#fff'; rr(ctx, bx, by, bw, bh, 10); ctx.fill();
  ctx.strokeStyle = o.hot ? '#d23b3b' : '#2a2a44'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = o.hot ? '#fff1ee' : '#fff'; ctx.beginPath(); ctx.moveTo(x - 7, by + bh - 1); ctx.lineTo(x, by + bh + 11); ctx.lineTo(x + 7, by + bh - 1); ctx.fill();
  ctx.globalAlpha = 1;
  lines.forEach((l, i) => txt(l, bx + bw / 2, by + 7 + lh * (i + 0.5), size, o.hot ? '#b32525' : '#22223a', 'center', o.alpha));
}

// ───────────────────────── disegno: scena ─────────────────────────
const BGF = []; for (let i = 0; i < 11; i++) BGF.push({ x: rnd(0, W), y: rnd(SEA + 40, H - 50), s: rnd(0.35, 0.8), sp: rnd(14, 38), d: Math.random() < 0.5 ? 1 : -1 });
const SNOW = []; for (let i = 0; i < 36; i++) SNOW.push({ x: rnd(0, W), y: rnd(0, SEA), s: rnd(1, 2.4), sp: rnd(14, 34), ph: rnd(0, 6) });
const waveY = (x, t, a, f, s) => Math.sin(x * f + t * s) * a;

function drawSky() {
  const t = G.t, g = ctx.createLinearGradient(0, 0, 0, SEA);
  g.addColorStop(0, '#1b2455'); g.addColorStop(0.45, '#6b3b80'); g.addColorStop(0.8, '#ff8a5c'); g.addColorStop(1, '#ffd48a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, SEA + 2);
  ctx.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { ctx.globalAlpha = (0.25 + 0.5 * Math.abs(Math.sin(t * 1.3 + i))) * (1 - hash(i, 3) * 0.5); ctx.fillRect(hash(i, 1) * W, hash(i, 2) * SEA * 0.5, 2, 2); }
  ctx.globalAlpha = 1;
  glow(690, SEA - 14, 200, '#fff0b8', 0.55); ctx.fillStyle = '#fff6cf'; ctx.beginPath(); ctx.arc(690, SEA - 14, 52, Math.PI, TAU); ctx.fill();
  // nuvole
  for (let i = 0; i < 4; i++) {
    const x = ((i * 290 + t * (7 + i * 2)) % (W + 300)) - 150, y = 70 + i * 36;
    ctx.fillStyle = 'rgba(255,190,170,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, 90, 13, 0, 0, TAU); ctx.ellipse(x + 40, y - 9, 56, 12, 0, 0, TAU); ctx.fill();
  }
  // Sanremo: colline, case liguri, Ariston, palme
  const hy = SEA - 4;
  ctx.fillStyle = '#3d2b5e'; ctx.beginPath(); ctx.moveTo(250, hy); ctx.quadraticCurveTo(400, hy - 70, 560, hy - 22); ctx.quadraticCurveTo(760, hy - 90, W, hy - 30); ctx.lineTo(W, hy); ctx.fill();
  const HC = ['#e8b27a', '#d97b6c', '#f2d28a', '#8fb5c9', '#c98a9c', '#e6c19a'];
  for (let i = 0; i < 17; i++) { const hx = 290 + i * 40 + hash(i, 11) * 10, hh = 20 + hash(i, 12) * 22, hw = 26 + hash(i, 13) * 10;
    ctx.fillStyle = HC[i % 6]; ctx.fillRect(hx, hy - hh, hw, hh); ctx.fillStyle = 'rgba(80,40,30,0.45)'; ctx.beginPath(); ctx.moveTo(hx - 2, hy - hh); ctx.lineTo(hx + hw / 2, hy - hh - 8); ctx.lineTo(hx + hw + 2, hy - hh); ctx.fill();
    ctx.fillStyle = 'rgba(40,30,70,0.55)'; for (let k = 0; k < 2; k++) ctx.fillRect(hx + 5 + k * 12, hy - hh + 6, 5, 7); }
  const ax = 560, ay = hy; ctx.fillStyle = '#efe3cf'; ctx.fillRect(ax - 58, ay - 46, 116, 46); ctx.fillStyle = '#b3453a'; ctx.fillRect(ax - 58, ay - 52, 116, 7);
  ctx.fillStyle = '#7a2a28'; for (let i = 0; i < 5; i++) ctx.fillRect(ax - 48 + i * 22, ay - 30, 10, 30);
  ctx.fillStyle = '#2a1330'; rr(ctx, ax - 48, ay - 78, 96, 24, 5); ctx.fill();
  ctx.globalAlpha = 0.75 + 0.25 * Math.sin(G.t * 5); txt('ARISTON', ax, ay - 70, 15, '#ff7ad9', 'center', 1, '#ff2fb8'); txt('SANREMO', ax, ay - 57, 9, '#8ff7ff', 'center'); ctx.globalAlpha = 1;
  for (const px of [296, 468, 760, 905]) { const sw = Math.sin(G.t * 1.2 + px) * 2;
    ctx.strokeStyle = '#4a3322'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px, hy); ctx.quadraticCurveTo(px + 6, hy - 34, px + sw, hy - 66); ctx.stroke();
    ctx.strokeStyle = '#2f7a4a'; ctx.lineWidth = 3; for (let k = 0; k < 7; k++) { const an2 = -Math.PI + k * (Math.PI / 6); ctx.beginPath(); ctx.moveTo(px + sw, hy - 66); ctx.quadraticCurveTo(px + sw + Math.cos(an2) * 16, hy - 66 + Math.sin(an2) * 16 - 6, px + sw + Math.cos(an2) * 30, hy - 66 + Math.sin(an2) * 22 + 8); ctx.stroke(); } }
  // gabbiani
  ctx.strokeStyle = '#2a2142'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const gx = ((t * (22 + i * 7) + i * 330) % (W + 120)) - 60, gy = 90 + i * 28 + Math.sin(t * 0.8 + i) * 8, fl = Math.sin(t * 6 + i * 2) * 6;
    ctx.beginPath(); ctx.moveTo(gx - 12, gy - fl); ctx.quadraticCurveTo(gx - 5, gy - 6, gx, gy); ctx.quadraticCurveTo(gx + 5, gy - 6, gx + 12, gy - fl); ctx.stroke();
  }
}
function drawSnow() {
  ctx.fillStyle = '#fff';
  for (const s of SNOW) {
    const y = (s.y + G.t * s.sp) % SEA, x = s.x + Math.sin(G.t + s.ph) * 14;
    ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(x, y, s.s, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawSea() {
  const t = G.t;
  const g = ctx.createLinearGradient(0, SEA, 0, H); g.addColorStop(0, '#46c0cf'); g.addColorStop(0.3, '#1f84ab'); g.addColorStop(1, '#09264f');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 12) ctx.lineTo(x, SEA + waveY(x, t, 2.4, 0.03, 1.7) + waveY(x, t, 1.4, 0.07, 2.6));
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  // riflesso del sole
  for (let i = 0; i < 14; i++) {
    const w = (46 - i * 2.6) * (1 + 0.35 * Math.sin(t * 2 + i)), y = SEA + 5 + i * 7;
    ctx.fillStyle = 'rgba(255,232,170,' + (0.4 - i * 0.025).toFixed(3) + ')'; ctx.fillRect(690 - w / 2 + Math.sin(t * 1.5 + i) * 8, y, w, 2.4);
  }
  // raggi di luce
  ctx.globalAlpha = 0.07; ctx.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) { const x = 220 + i * 170 + Math.sin(t * 0.4 + i) * 30; ctx.beginPath(); ctx.moveTo(x - 20, SEA); ctx.lineTo(x + 30, SEA); ctx.lineTo(x + 110, H); ctx.lineTo(x + 40, H); ctx.fill(); }
  ctx.globalAlpha = 1;
  // pesci di sfondo
  for (const f of BGF) {
    f.x += f.d * f.sp * DT; if (f.x > W + 60) f.x = -60; if (f.x < -60) f.x = W + 60;
    ctx.save(); ctx.translate(f.x, f.y + Math.sin(t + f.x * 0.01) * 6); ctx.scale(-f.d * f.s, f.s); ctx.globalAlpha = 0.18;
    fishShape(ctx, '#052a44', '#052a44', 0.8, false); ctx.restore();
  }
  ctx.globalAlpha = 1;
  // fondale e alghe
  const sg = ctx.createLinearGradient(0, H - 34, 0, H); sg.addColorStop(0, 'rgba(194,170,120,0)'); sg.addColorStop(1, 'rgba(160,138,96,0.85)');
  ctx.fillStyle = sg; ctx.fillRect(0, H - 34, W, 34);
  for (let i = 0; i < 16; i++) {
    const x = 20 + i * 61 + hash(i, 5) * 20, h = 40 + hash(i, 6) * 40; ctx.strokeStyle = i % 3 ? '#1f7a56' : '#2a9a6a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, H); ctx.quadraticCurveTo(x + Math.sin(t * 1.4 + i) * 12, H - h * 0.5, x + Math.sin(t * 1.4 + i + 1) * 16, H - h); ctx.stroke();
  }
  // linea di schiuma
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = 0; x <= W; x += 12) { const y = SEA + waveY(x, t, 2.4, 0.03, 1.7) + waveY(x, t, 1.4, 0.07, 2.6); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
}
function drawPier() {
  const dy = SEA - 10;
  // pali
  for (const px of [34, 118, 232]) { ctx.fillStyle = '#5a3d22'; ctx.fillRect(px - 6, dy, 12, H - dy); ctx.fillStyle = 'rgba(8,40,80,0.45)'; ctx.fillRect(px - 6, SEA + 4, 12, H - SEA); }
  // tavolato
  ctx.fillStyle = '#9a6a3a'; ctx.fillRect(0, dy, 268, 14); ctx.fillStyle = '#7b5230'; ctx.fillRect(0, dy + 11, 268, 4);
  ctx.strokeStyle = 'rgba(60,36,18,0.55)'; ctx.lineWidth = 1.5; for (let x = 20; x < 268; x += 34) { ctx.beginPath(); ctx.moveTo(x, dy); ctx.lineTo(x, dy + 11); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, dy, 268, 2);
  // albero di Natale
  ctx.fillStyle = '#5a3d22'; ctx.fillRect(40, dy - 8, 8, 8);
  ctx.fillStyle = '#2f8a4a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(44 - 24 + i * 4, dy - 8 - i * 22); ctx.lineTo(44, dy - 40 - i * 22); ctx.lineTo(44 + 24 - i * 4, dy - 8 - i * 22); ctx.closePath(); ctx.fill(); }
  const cols = ['#ff5a5a', '#ffd24d', '#6bb8ff', '#ff8fe6'];
  for (let i = 0; i < 9; i++) { const lx = 44 + Math.sin(i * 2.1) * (18 - Math.floor(i / 3) * 5), ly = dy - 18 - i * 6.5; ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(G.t * 3 + i)); ctx.fillStyle = cols[i % 4]; ctx.beginPath(); ctx.arc(lx, ly, 2.8, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.fillStyle = '#ffd24d'; ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2, b = a + TAU / 10; ctx.lineTo(44 + Math.cos(a) * 7, dy - 136 + Math.sin(a) * 7); ctx.lineTo(44 + Math.cos(b) * 3, dy - 136 + Math.sin(b) * 3); } ctx.closePath(); ctx.fill();
  // cartello
  ctx.fillStyle = '#6a4a2a'; ctx.fillRect(98, dy - 44, 5, 44); ctx.fillStyle = '#e8d6a8'; rr(ctx, 44, dy - 86, 114, 44, 4); ctx.fill(); ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2; ctx.stroke();
  txt('QUANTO CAZZO', 101, dy - 72, 10.5, '#7a1f1f', 'center'); txt('SONO', 101, dy - 61, 11, '#7a1f1f', 'center'); txt('FORTE!', 101, dy - 50, 11, '#7a1f1f', 'center');
  // lucine lungo il bordo
  ctx.strokeStyle = 'rgba(30,20,10,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, dy - 4); for (let x = 0; x <= 268; x += 8) ctx.lineTo(x, dy - 4 + Math.sin(x * 0.12) * 3 + 3); ctx.stroke();
  for (let x = 6; x < 268; x += 18) { ctx.fillStyle = cols[Math.floor(x / 18) % 4]; ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(G.t * 4 + x)); ctx.beginPath(); ctx.arc(x, dy - 1 + Math.sin(x * 0.12) * 3, 2.4, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function rodPose() {
  const ph = G.ph; let ang = -38, bend = 3, hx = LX + 16, hy = LY - 56;
  if (ph === 'charge') { const k = ease(Math.min(1, G.pt / 0.25)); ang = lerp(-38, -120, k); hx = LX + lerp(16, 6, k); hy = LY - lerp(56, 68, k); bend = lerp(3, 10, G.power); }
  else if (ph === 'cast') { const k = ease(Math.min(1, G.pt / 0.2)); ang = lerp(-120, -24, k); hx = LX + lerp(6, 22, k); hy = LY - lerp(68, 58, k); bend = lerp(-6, 2, k); }
  else if (ph === 'wait') { ang = -32 + Math.sin(G.t * 2) * 1.5; }
  else if (ph === 'bite') { ang = -30; bend = 5 + Math.sin(G.t * 45) * 4; }
  else if (ph === 'reel') { ang = -48 + Math.sin(G.t * 28) * 2.5; bend = 13 + (G.reel ? (1 - G.reel.prog) * 5 : 0); hx = LX + 14 + Math.sin(G.t * 28) * 1; }
  else if (ph === 'retrieve') { ang = -44; bend = 8; }
  const a = ang * Math.PI / 180, len = 104;
  return { hx, hy, tx: hx + Math.cos(a) * len, ty: hy + Math.sin(a) * len, bend, a };
}
// Testa di Leopoldo: cappellino bordeaux, occhiali da aviatore, barba lunga da hipster.
function drawLeoHead(c, x, y, s, an, scared, t) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const worry = an > 50 ? 3 : 0, beard = '#2a1f21';
  // orecchie
  c.fillStyle = '#d3996f'; c.beginPath(); c.ellipse(-20.5, 3, 3.6, 6, 0, 0, TAU); c.ellipse(20.5, 3, 3.6, 6, 0, 0, TAU); c.fill();
  // faccia
  c.fillStyle = '#e0b088'; c.beginPath(); c.ellipse(0, 0, 20, 23, 0, 0, TAU); c.fill();
  if (an > 85) { c.fillStyle = 'rgba(120,200,90,0.4)'; c.beginPath(); c.ellipse(0, 0, 20, 23, 0, 0, TAU); c.fill(); }
  // naso
  c.fillStyle = '#d29a72'; c.beginPath(); c.ellipse(1.5, 6.5, 3.6, 3.2, 0, 0, TAU); c.fill();
  // sopracciglia (alzate e preoccupate quando l'ansia sale)
  c.strokeStyle = '#2a1a14'; c.lineWidth = 2.6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-15, -6.5); c.lineTo(-4, -7.5 - worry); c.moveTo(15, -6.5); c.lineTo(4, -7.5 - worry); c.stroke();
  // occhi dietro le lenti
  const er = scared ? 4.9 : 3.9, ery = scared ? 4.5 : 2.5;
  c.fillStyle = '#fff'; c.beginPath(); c.ellipse(-9.5, 1, er, ery, 0, 0, TAU); c.ellipse(9.5, 1, er, ery, 0, 0, TAU); c.fill();
  c.fillStyle = '#1a120e'; const pr = scared ? 1.3 : 1.9;
  c.beginPath(); c.arc(-8.4, 1.2, pr, 0, TAU); c.arc(10.6, 1.2, pr, 0, TAU); c.fill();
  c.strokeStyle = '#2a1a14'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(-9.5, 1, er, ery, 0, Math.PI, TAU); c.stroke(); c.beginPath(); c.ellipse(9.5, 1, er, ery, 0, Math.PI, TAU); c.stroke();
  // ombra della visiera sugli occhi
  c.fillStyle = 'rgba(50,10,25,0.2)'; c.beginPath(); c.ellipse(2, -4, 19, 4, 0, 0, TAU); c.fill();
  // occhiali da aviatore: montatura sottile, lenti a goccia
  c.strokeStyle = '#2b2420'; c.lineWidth = 1.5; c.fillStyle = 'rgba(150,120,90,0.26)';
  for (const sg of [-1, 1]) {
    c.save(); c.scale(sg, 1); c.translate(9.6, 1);
    c.beginPath(); c.moveTo(-8, -5); c.bezierCurveTo(-8, -9.5, 8, -9.5, 8.6, -4); c.bezierCurveTo(8.2, 4, 3.5, 10.5, -2, 9.5); c.bezierCurveTo(-8, 7.5, -9, 1, -8, -5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(-3.5, -4.5, 3, 1.3, -0.4, 0, TAU); c.fill(); c.fillStyle = 'rgba(150,120,90,0.26)';
    c.restore();
  }
  c.beginPath(); c.moveTo(-1.6, -4.2); c.quadraticCurveTo(0, -6.2, 1.6, -4.2); c.stroke();
  c.beginPath(); c.moveTo(-18.2, -3.5); c.lineTo(-21, -1.5); c.moveTo(18.2, -3.5); c.lineTo(21, -1.5); c.stroke();
  // barba lunga e folta
  c.fillStyle = beard; c.beginPath(); c.moveTo(-20.5, 1);
  c.bezierCurveTo(-24, 22, -16, 46, -5, 57); c.bezierCurveTo(-2, 60, 2, 60, 5, 57);
  c.bezierCurveTo(16, 46, 24, 22, 20.5, 1); c.bezierCurveTo(19.5, 9, 14, 12.5, 9, 12.5);
  c.quadraticCurveTo(0, 8.5, -9, 12.5); c.bezierCurveTo(-14, 12.5, -19.5, 9, -20.5, 1); c.closePath(); c.fill();
  // riflessi e fili grigi
  c.lineWidth = 1.1; c.lineCap = 'round';
  const st = [[-12, 18, -14, 34, -9, 49], [-5, 17, -6, 36, -3, 54], [3, 17, 4, 36, 2, 55], [10, 18, 13, 34, 8, 49], [-17, 14, -19, 28, -15, 40], [16, 14, 19, 28, 14, 40]];
  st.forEach((q, i) => { c.strokeStyle = i % 3 === 1 ? 'rgba(190,185,185,0.5)' : 'rgba(255,255,255,0.13)'; c.beginPath(); c.moveTo(q[0], q[1]); c.quadraticCurveTo(q[2], q[3], q[4], q[5]); c.stroke(); });
  // baffi
  c.fillStyle = beard; c.beginPath(); c.moveTo(-14, 11.5); c.quadraticCurveTo(-6, 5.5, 0, 9.5); c.quadraticCurveTo(6, 5.5, 14, 11.5); c.quadraticCurveTo(7, 18, 0, 14.5); c.quadraticCurveTo(-7, 18, -14, 11.5); c.fill();
  // bocca aperta quando è nel panico
  if (an > 60 || scared) { c.fillStyle = '#7a2430'; c.beginPath(); c.ellipse(0, 18.5, 4.2, 3.4, 0, 0, TAU); c.fill(); }
  // termometro nella barba
  if (an > 45) { c.save(); c.translate(2, 18); c.rotate(0.35); c.fillStyle = '#eef3f7'; c.fillRect(0, -2, 22, 4); c.fillStyle = '#e24b4b'; c.fillRect(15, -2, 7, 4); c.restore(); }
  // cappellino bordeaux con patch
  c.fillStyle = '#7b1e3c'; c.beginPath(); c.moveTo(-23, -8); c.bezierCurveTo(-25, -33, 25, -33, 23, -8); c.quadraticCurveTo(0, -13.5, -23, -8); c.closePath(); c.fill();
  c.strokeStyle = '#5a1230'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -30); c.quadraticCurveTo(2, -20, 1, -11.5); c.moveTo(-12, -27); c.quadraticCurveTo(-12, -19, -14, -10.5); c.stroke();
  c.fillStyle = '#5a1230'; c.beginPath(); c.arc(0, -29.5, 2.2, 0, TAU); c.fill();
  c.fillStyle = '#f08470'; c.beginPath(); c.ellipse(9, -20, 6.2, 4.6, -0.25, 0, TAU); c.fill();
  c.strokeStyle = '#b8483c'; c.lineWidth = 1; c.beginPath(); c.ellipse(9, -20, 3.8, 2.6, -0.25, 0, TAU); c.stroke();
  c.fillStyle = '#5c1530'; c.beginPath(); c.moveTo(-3, -11.5); c.quadraticCurveTo(14, -17, 35, -9.5); c.quadraticCurveTo(31, -3.5, 14, -4.8); c.quadraticCurveTo(2, -5.5, -3, -11.5); c.closePath(); c.fill();
  c.strokeStyle = '#a23458'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-1, -11.8); c.quadraticCurveTo(14, -16.8, 34, -9.6); c.stroke();
  // sudore
  if (an > 50) for (let i = 0; i < 2; i++) { const k = (t * 1.6 + i * 0.5) % 1; c.fillStyle = 'rgba(150,215,255,' + (1 - k).toFixed(2) + ')'; c.beginPath(); c.ellipse(i ? 27 : -27, -10 + k * 30, 2.6, 4, 0, 0, TAU); c.fill(); }
  c.restore();
}
function drawLeo(x, y, big) {
  const t = G.t, an = G.ansia, rp = rodPose();
  const bobY = Math.sin(t * 2.2) * 0.8;
  ctx.save(); ctx.translate(x, y + bobY);
  // gambe + ginocchiera
  ctx.fillStyle = '#e8b894'; ctx.fillRect(-12, -24, 9, 22); ctx.fillRect(3, -24, 9, 22);
  ctx.fillStyle = '#d23b3b'; ctx.fillRect(2, -19, 11, 10); ctx.fillStyle = '#fff'; ctx.fillRect(6, -18, 3, 8); ctx.fillRect(3, -15, 9, 2.6);
  ctx.fillStyle = '#f6f6f6'; ctx.fillRect(-15, -4, 15, 7); ctx.fillRect(1, -4, 17, 7); ctx.fillStyle = '#3a3a48'; ctx.fillRect(-15, 1, 15, 2.5); ctx.fillRect(1, 1, 17, 2.5);
  // pantaloncini
  ctx.fillStyle = '#d9c58a'; rr(ctx, -15, -42, 30, 22, 4); ctx.fill();
  // giacca scura + sciarpa chiara
  ctx.fillStyle = '#2b3048'; rr(ctx, -20, -82, 40, 44, 7); ctx.fill();
  ctx.fillStyle = '#3a4160'; ctx.fillRect(-20, -58, 40, 3); ctx.fillStyle = '#8a93a6'; ctx.fillRect(-0.5, -76, 1.6, 38);
  ctx.fillStyle = '#cfd3d9'; rr(ctx, -15, -87, 30, 10, 5); ctx.fill(); ctx.fillStyle = '#b3b8c0'; ctx.fillRect(-15, -81, 30, 1.5);
  // braccio indietro
  ctx.strokeStyle = '#2b3048'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-12, -74); ctx.lineTo(-18, -58); ctx.stroke();
  ctx.strokeStyle = '#e8b894'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-18, -58); ctx.lineTo(-18, -48); ctx.stroke();
  // canna
  const hx = rp.hx - x, hy = rp.hy - y - bobY, tx = rp.tx - x, ty = rp.ty - y - bobY;
  const mx = (hx + tx) / 2, my = (hy + ty) / 2, nx = Math.sin(rp.a), ny = -Math.cos(rp.a);
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(mx + nx * rp.bend * -1, my + ny * rp.bend * -1 + 0, tx, ty); ctx.stroke();
  ctx.strokeStyle = '#c9a26a'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = '#3a3a48'; ctx.beginPath(); ctx.arc(hx - 4, hy + 6, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#c9ced6'; ctx.beginPath(); ctx.arc(hx - 4, hy + 6, 3, 0, TAU); ctx.fill();
  // braccio avanti
  ctx.strokeStyle = '#2b3048'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(10, -74); ctx.lineTo(hx - 2, hy + 4); ctx.stroke();
  ctx.strokeStyle = '#e8b894'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(lerp(10, hx - 2, 0.62), lerp(-74, hy + 4, 0.62)); ctx.lineTo(hx, hy); ctx.stroke();
  // testa (la barba scende sul petto, quindi va disegnata per ultima)
  drawLeoHead(ctx, 0, -104, 1.4, an, G.ph === 'bite', t);
  ctx.restore();
  return rp;
}
function drawPedalo(p) {
  const x = p.x, y = SEA + 7 + Math.sin(G.t * 2 + x * 0.02) * 2, w = p.who;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(0, 6, 50, 6, 0, 0, TAU); ctx.fill();
  if (w === 'martino') {
    ctx.fillStyle = '#f7f7f2'; ctx.beginPath(); ctx.ellipse(0, -4, 48, 16, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#b9c2cc'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#f7f7f2'; ctx.beginPath(); ctx.moveTo(-34, -8); ctx.quadraticCurveTo(-64, -20, -52, -48); ctx.lineTo(-44, -46); ctx.quadraticCurveTo(-52, -22, -26, -2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-50, -52, 9, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#f08a2c'; ctx.beginPath(); ctx.moveTo(-58, -52); ctx.lineTo(-70, -48); ctx.lineTo(-58, -46); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-52, -55, 1.6, 0, TAU); ctx.fill();
  } else if (w === 'lucone') {
    ctx.fillStyle = '#f08a2c'; ctx.beginPath(); ctx.ellipse(0, -5, 50, 13, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#a8530f'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#c9702a'; ctx.beginPath(); ctx.ellipse(0, -2, 38, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#333'; ctx.fillRect(40, -16, 12, 12); ctx.fillStyle = '#999'; ctx.fillRect(46, -4, 3, 10);
  } else if (w === 'tommyv') {
    ctx.fillStyle = '#17171c'; ctx.beginPath(); ctx.moveTo(-54, -10); ctx.quadraticCurveTo(-60, -22, -40, -20); ctx.lineTo(46, -16); ctx.quadraticCurveTo(54, -4, 40, 4); ctx.lineTo(-36, 4); ctx.quadraticCurveTo(-52, 2, -54, -10); ctx.fill();
    ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-50, -9); ctx.lineTo(44, -6); ctx.stroke();
    ctx.fillStyle = 'rgba(160,210,255,0.8)'; ctx.beginPath(); ctx.moveTo(-8, -17); ctx.lineTo(-2, -30); ctx.lineTo(8, -17); ctx.fill();
  } else {
    ctx.fillStyle = '#2a7fd1'; ctx.beginPath(); ctx.moveTo(-50, -8); ctx.quadraticCurveTo(-52, -18, -36, -18); ctx.lineTo(40, -18); ctx.quadraticCurveTo(54, -12, 48, -2); ctx.lineTo(-34, 2); ctx.quadraticCurveTo(-48, 0, -50, -8); ctx.fill();
    ctx.fillStyle = '#0a1a3c'; for (let i = 0; i < 6; i++) ctx.fillRect(-42 + i * 15, -18, 7, 18);
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(36, -88, 3, 72);
    ctx.fillStyle = '#0a1a3c'; ctx.fillRect(39, -88, 46, 30); ctx.fillStyle = '#2a7fd1'; for (let i = 0; i < 4; i++) ctx.fillRect(39 + i * 12 + 6, -88, 6, 30);
    txt('INTER', 62, -73, 9, '#fff', 'center', 1, '#0a1a3c');
  }
  // persona
  const px = w === 'martino' ? 14 : w === 'lucone' ? 6 : w === 'tommyv' ? -4 : 0;
  const body = { martino: '#4c7aa8', lucone: '#3f8a5a', tommyv: '#17171c', donati: '#0a1a3c' }[w], big = w === 'lucone' ? 1.25 : 1;
  ctx.save(); ctx.translate(px, 0); ctx.scale(big, big);
  ctx.fillStyle = body; rr(ctx, -10, -36, 22, 24, 4); ctx.fill();
  if (w === 'donati') { ctx.fillStyle = '#2a7fd1'; for (let i = 0; i < 3; i++) ctx.fillRect(-7 + i * 7, -36, 3.5, 24); }
  ctx.fillStyle = w === 'tommyv' ? '#e0b08e' : '#e8b894'; ctx.beginPath(); ctx.arc(0, -44, 10, 0, TAU); ctx.fill();
  if (w === 'martino') { ctx.fillStyle = '#d02d2d'; ctx.beginPath(); ctx.moveTo(-10, -47); ctx.quadraticCurveTo(-9, -60, 0, -60); ctx.quadraticCurveTo(9, -60, 10, -47); ctx.closePath(); ctx.fill(); ctx.fillRect(-12, -48, 22, 3); ctx.fillRect(4, -48, 14, 3); }
  if (w === 'lucone') { ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.arc(0, -47, 10, Math.PI, TAU); ctx.fill(); ctx.fillRect(-10, -48, 20, 3); }
  if (w === 'tommyv') { ctx.fillStyle = '#1a1a1f'; ctx.beginPath(); ctx.arc(0, -46, 10.5, Math.PI * 1.02, TAU * 0.995); ctx.fill(); ctx.fillStyle = '#000'; ctx.fillRect(-9, -46, 8, 4.5); ctx.fillRect(1, -46, 8, 4.5); ctx.fillRect(-2, -45, 3, 1.4); }
  if (w === 'donati') { ctx.fillStyle = '#3a2418'; ctx.beginPath(); ctx.arc(0, -47, 10, Math.PI, TAU); ctx.fill(); }
  if (w !== 'tommyv') { ctx.fillStyle = '#111'; ctx.fillRect(-4, -45, 2, 2); ctx.fillRect(3, -45, 2, 2); }
  ctx.fillStyle = '#7a1f1f'; ctx.fillRect(-3, -39, 7, 1.6);
  if (w === 'martino' || w === 'lucone') { ctx.strokeStyle = '#2d6cdf'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, -36); ctx.lineTo(-1, -22); ctx.moveTo(4, -36); ctx.lineTo(1, -22); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(-4, -23, 8, 7); ctx.fillStyle = '#c4382f'; ctx.fillRect(-4, -23, 8, 2); }
  if (w === 'tommyv') { ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, -35, 6, 0.2, Math.PI - 0.2); ctx.stroke(); }
  ctx.restore();
  { const nm = PEOPLE[w].n.toUpperCase(), tw = nm.length * 7.6 + 16; ctx.fillStyle = '#c4382f'; const ny = w === 'lucone' ? -92 : w === 'martino' ? -78 : -82; rr(ctx, px - tw / 2, ny, tw, 17, 8); ctx.fill(); txt(nm, px, ny + 9, 11, '#fff', 'center'); }
  ctx.restore();
  bubble(x + 8, y - 106, p.say, { size: 13, w: 160 });
}
function drawLineAndBobber(rp) {
  const ph = G.ph;
  const show = !['idle', 'charge'].includes(ph) || ph === 'idle' || ph === 'charge';
  if (ph === 'idle' || ph === 'charge') {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(rp.tx, rp.ty); ctx.lineTo(rp.tx + (ph === 'charge' ? -6 : 2), rp.ty + 28); ctx.stroke();
    drawFloat(rp.tx + (ph === 'charge' ? -6 : 2), rp.ty + 30, 0);
    return;
  }
  if (ph === 'lost') {
    G.cut = Math.max(0, G.cut - DT * 1.2);
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * G.cut).toFixed(2) + ')'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(rp.tx, rp.ty); ctx.lineTo(rp.tx + 30, rp.ty + 70 * (1 - G.cut)); ctx.stroke();
    return;
  }
  // linea
  const bx = G.bx, by = G.by, taut = ph === 'reel' || ph === 'bite';
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(rp.tx, rp.ty);
  const sag = taut ? 4 : 20 * Math.max(0, 1 - (ph === 'cast' ? 0.5 : 0));
  ctx.quadraticCurveTo((rp.tx + bx) / 2, (rp.ty + by) / 2 + sag, bx, by); ctx.stroke();
  const submerged = ['wait', 'bite', 'reel'].includes(ph);
  if (submerged) {
    // onde concentriche
    const k = (G.t * 1.5) % 1; ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - k)).toFixed(2) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(bx, SEA + 2, 8 + k * 16, 2 + k * 4, 0, 0, TAU); ctx.stroke();
    if (ph === 'reel' || ph === 'bite') {
      ctx.save(); ctx.translate(bx - 6, SEA + 46 + Math.sin(G.t * 12) * 3); ctx.scale(-1, 1); ctx.globalAlpha = 0.5;
      fishShape(ctx, '#052a44', '#052a44', 0.5 + (G.item ? G.item.d * 0.35 : 0), false); ctx.restore(); ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(bx, SEA + 4); ctx.lineTo(bx - 6, SEA + 44); ctx.stroke();
    }
  }
  drawFloat(bx, by, ph === 'bite' ? 1 : 0);
}
function drawFloat(x, y, hot) {
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y - 1, 6, Math.PI, TAU); ctx.fill();
  ctx.fillStyle = hot && Math.floor(G.t * 14) % 2 ? '#ffd24d' : '#e24b4b'; ctx.beginPath(); ctx.arc(x, y - 1, 6, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#e24b4b'; ctx.fillRect(x - 1, y - 11, 2, 6);
}
function drawParts() {
  for (const p of G.parts) {
    const a = cl(p.life / p.max, 0, 1);
    ctx.globalAlpha = p.bub ? a * 0.6 : a; ctx.fillStyle = p.col;
    if (p.bub) { ctx.strokeStyle = 'rgba(220,245,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  for (const f of G.floats) txt(f.text, f.x, f.y, f.size, f.col, 'center', cl(f.life / f.max * 1.6, 0, 1), 'rgba(0,0,0,0.65)');
}

// ───────────────────────── HUD ─────────────────────────
function drawHUD() {
  // punteggio
  ctx.fillStyle = 'rgba(8,14,40,0.55)'; rr(ctx, 12, 10, 206, G.combo > 1 ? 84 : 62, 12); ctx.fill();
  txt('PUNTI', 26, 26, 11, '#9fc0e8', 'left'); txt(String(G.score).padStart(6, '0'), 26, 50, 28, '#fff', 'left', 1, 'rgba(0,0,0,0.4)');
  if (G.combo > 1) txt('COMBO x' + G.combo, 26, 78, 16, '#ffd24d', 'left');
  // ansia
  const ax = 330, ay = 20, aw = 300, ah = 18, an = cl(G.ansia, 0, 100) / 100;
  const sh = an > 0.8 ? Math.sin(G.t * 40) * 1.6 : 0;
  ctx.save(); ctx.translate(sh, 0);
  ctx.fillStyle = 'rgba(8,14,40,0.6)'; rr(ctx, ax - 70, ay - 12, aw + 94, 44, 14); ctx.fill();
  txt('ANSIA', ax - 56, ay + 10, 13, '#fff', 'left');
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, ax, ay, aw, ah, 9); ctx.fill();
  const col = an < 0.4 ? '#6be08a' : an < 0.7 ? '#ffd24d' : '#ff5a5a';
  ctx.fillStyle = col; rr(ctx, ax, ay, Math.max(ah, aw * an), ah, 9); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(ax + 6, ay + 3, Math.max(0, aw * an - 12), 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(ax + aw * i / 10, ay + ah - 5); ctx.lineTo(ax + aw * i / 10, ay + ah); ctx.stroke(); }
  txt('SERENO', ax, ay + 32, 9, '#9fc0e8', 'left'); txt(an > 0.85 ? 'CRISI!!!' : 'CRISI', ax + aw, ay + 32, 9, an > 0.85 ? '#ff7a7a' : '#9fc0e8', 'right');
  ctx.restore();
  // pescadex + tempo
  ctx.fillStyle = 'rgba(8,14,40,0.55)'; rr(ctx, W - 190, 10, 178, 62, 12); ctx.fill();
  txt('PESCADEX', W - 176, 26, 11, '#9fc0e8', 'left'); txt(dexCount() + ' / ' + ITEMS.length, W - 176, 50, 24, '#fff', 'left');
  txt(mmss(G.time), W - 26, 50, 16, '#cfe0ff', 'right');
  if (G.knee > 0) { ctx.fillStyle = 'rgba(210,40,40,' + (0.18 + 0.1 * Math.sin(G.t * 30)).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); txt('AHI, IL GINOCCHIO!', W / 2, 150, 34, '#fff', 'center', 1, '#b32525'); }
  // ritardo / suggerimenti
  const T = touchMode;
  let hint = '';
  if (G.ph === 'idle') hint = (T ? 'TIENI PREMUTO' : 'TIENI PREMUTO (spazio / mouse)') + ' per caricare il lancio';
  else if (G.ph === 'charge') hint = 'RILASCIA per lanciare: più lontano = pesci rari (e guai grossi)';
  else if (G.ph === 'wait') hint = 'Aspetta che abbocchi... (tocca per ritirare la lenza)';
  else if (G.ph === 'reel') hint = 'TIENI PREMUTO per salire, rilascia per scendere: segui il pesce!';
  if (hint) txt(hint, W / 2, G.ph === 'reel' ? 402 : H - 22, 15, '#fff', 'center', 0.92, 'rgba(0,0,0,0.6)');
  if (G.ph === 'bite') txt('ABBOCCATO!  ' + (T ? 'TOCCA' : 'PREMI') + ' ORA!', W / 2, 112, 46 + Math.sin(G.t * 30) * 3, '#ffd24d', 'center', 1, '#7a1f1f');
  if (G.ph === 'charge' || G.ph === 'idle') drawZones();
  if (G.ph === 'reel' && G.reel) drawReel();
  if (G.ph === 'lost' && G.malus) {
    const k = ease(cl(G.pt / 0.2, 0, 1)), m = G.malus, bw = 520, bh = 76, x = W - bw - 24, y = 128 - (1 - k) * 20;
    ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = '#f9dcd6'; rr(ctx, x, y, bw, bh, 12); ctx.fill(); ctx.strokeStyle = '#c4382f'; ctx.lineWidth = 3; ctx.stroke();
    txt('MALUS', x + 18, y + 18, 13, '#c4382f', 'left'); txt('ANSIA +' + m.a + '    ' + m.p + ' punti', x + bw - 18, y + 18, 13, '#c4382f', 'right');
    wrap(m.t, bw - 40, 17).slice(0, 2).forEach((l, i) => txt(l, x + 18, y + 42 + i * 20, 17, '#2a1d10', 'left')); ctx.restore();
  }
}
function drawZones() {
  const y = SEA - 3;
  for (let z = 0; z < 3; z++) {
    const x0 = [300, 470, 700][z], x1 = [470, 700, 900][z];
    ctx.fillStyle = ['rgba(120,230,160,0.12)', 'rgba(255,210,90,0.12)', 'rgba(255,120,110,0.14)'][z]; ctx.fillRect(x0, SEA + 8, x1 - x0, 26);
    txt(ZN[z] + '  ' + '★'.repeat(z + 1), (x0 + x1) / 2, SEA + 21, 11, '#fff', 'center', 0.85, 'rgba(0,0,0,0.5)');
  }
  if (G.ph === 'charge') {
    const x = lerp(300, 900, G.power);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(x, y - 80); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#ffd24d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, SEA + 2, 16, 5, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffd24d'; ctx.beginPath(); ctx.moveTo(x - 7, y - 90); ctx.lineTo(x + 7, y - 90); ctx.lineTo(x, y - 78); ctx.fill();
  }
}
function drawReel() {
  const r = G.reel, x0 = 190, w = 580, y = 458, h = 28;
  ctx.fillStyle = 'rgba(6,16,40,0.75)'; rr(ctx, x0 - 22, y - 38, w + 44, 78, 14); ctx.fill();
  // progresso
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, x0, y - 28, w, 10, 5); ctx.fill();
  ctx.fillStyle = r.prog > 0.6 ? '#6be08a' : r.prog > 0.3 ? '#ffd24d' : '#ff5a5a'; rr(ctx, x0, y - 28, Math.max(10, w * cl(r.prog, 0, 1)), 10, 5); ctx.fill();
  // pista
  ctx.fillStyle = 'rgba(80,150,200,0.35)'; rr(ctx, x0, y - 10, w, h, 8); ctx.fill();
  ctx.fillStyle = r.inside ? 'rgba(107,224,138,0.85)' : 'rgba(107,224,138,0.45)'; rr(ctx, x0 + (r.z - r.size / 2) * w, y - 10, r.size * w, h, 8); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  // pesce
  ctx.save(); ctx.translate(x0 + r.f * w, y + 4); ctx.scale(-0.42, 0.42); fishShape(ctx, '#ffd24d', '#fff3b0', 1, false); ctx.restore();
}

// ───────────────────────── schermate ─────────────────────────
const BTN = {
  title: [{ id: 'play', x: W / 2 - 150, y: 392, w: 300, h: 56 }, { id: 'dex', x: W / 2 - 150, y: 458, w: 300, h: 42 }],
  over: [{ id: 'retry', x: W / 2 - 160, y: 456, w: 150, h: 46 }, { id: 'dex', x: W / 2 + 10, y: 456, w: 150, h: 46 }],
  dex: [{ id: 'back', x: W / 2 - 80, y: 492, w: 160, h: 38 }],
};
function button(b, label, main) {
  ctx.fillStyle = main ? '#ffd24d' : 'rgba(255,255,255,0.18)'; rr(ctx, b.x, b.y, b.w, b.h, 14); ctx.fill();
  if (!main) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.stroke(); }
  txt(label, b.x + b.w / 2, b.y + b.h / 2 + 1, main ? 24 : 16, main ? '#5a2a08' : '#fff', 'center');
}
function drawTitle() {
  drawSky(); drawSea(); drawPier();
  const rp = drawLeo(LX, LY); drawLineAndBobber(rp);
  { const g = ctx.createLinearGradient(0, 40, 0, 360); g.addColorStop(0, 'rgba(8,14,40,0)'); g.addColorStop(0.25, 'rgba(8,14,40,0.5)'); g.addColorStop(0.8, 'rgba(8,14,40,0.5)'); g.addColorStop(1, 'rgba(8,14,40,0)'); ctx.fillStyle = g; ctx.fillRect(0, 40, W, 320); }
  const b = Math.sin(G.t * 2) * 3;
  txt('LEOPOLDO', W / 2, 138 + b, 104, '#ffd24d', 'center', 1, '#4a1a0a');
  txt('GRAN PESCA DI NATALE', W / 2, 218 + b, 34, '#fff', 'center', 1, '#4a1a0a');
  txt('edizione regalo brutto · 2026', W / 2, 258, 18, '#ffb7a8', 'center', 1, 'rgba(0,0,0,0.5)');
  txt('Tieni a bada l\'ansia. Pesca. Evita Martino.', W / 2, 300, 17, '#fff', 'center', 0.92, 'rgba(0,0,0,0.5)');
  button(BTN.title[0], touchMode ? 'TOCCA PER PESCARE' : 'PESCA!', true);
  button(BTN.title[1], 'PESCADEX  ' + dexCount() + '/' + ITEMS.length);
  if (save.best > 0) txt('RECORD ' + String(save.best).padStart(6, '0'), W / 2, 520, 14, '#cfe0ff', 'center', 0.9, 'rgba(0,0,0,0.5)');
}
function drawCard() {
  const c = G.card; if (!c) return;
  const k = ease(cl(G.pt / 0.25, 0, 1));
  ctx.fillStyle = 'rgba(6,10,30,' + (0.62 * k).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2 + (1 - k) * 40); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k); ctx.globalAlpha = k;
  const bw = 560, bh = 336, x = -bw / 2, y = -bh / 2;
  ctx.fillStyle = '#fbf3de'; rr(ctx, x, y, bw, bh, 18); ctx.fill(); ctx.strokeStyle = '#7a5a2c'; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = c.it.k === 'gag' ? '#e05a4a' : c.it.k === 'pill' ? '#2ba3a3' : '#2f7fbf'; rr(ctx, x, y, bw, 40, 18); ctx.fill(); ctx.fillRect(x, y + 20, bw, 20);
  txt(c.it.k === 'gag' ? 'HAI PESCATO... QUALCOSA' : c.it.k === 'pill' ? 'HAI PESCATO UN FARMACO' : 'HAI PESCATO UN PESCE!', 0, y + 21, 17, '#fff', 'center');
  ctx.fillStyle = '#e6d9b4'; rr(ctx, x + 22, y + 60, 190, 170, 14); ctx.fill();
  ctx.save(); ctx.beginPath(); rr(ctx, x + 22, y + 60, 190, 170, 14); ctx.clip(); drawIcon(ctx, c.it.id, x + 117, y + 148, 1.25); ctx.restore();
  txt(c.it.n, x + 236, y + 78, 25, '#3a2410', 'left');
  const sign = c.it.a > 0 ? '+' : '', acol = c.it.a > 0 ? '#c4382f' : '#2f8a4a';
  txt('+' + c.pts + ' punti' + (c.combo > 1 ? '   (combo x' + c.combo + ')' : ''), x + 236, y + 106, 16, '#2f6f9f', 'left');
  txt('ANSIA ' + sign + (c.it.a > 0 ? Math.round(c.it.a * 0.75) : c.it.a), x + 236, y + 130, 16, acol, 'left');
  const lines = wrap(c.it.t, 290, 15); lines.forEach((l, i) => txt(l, x + 236, y + 160 + i * 19, 15, '#4a3a22', 'left'));
  { const f = c.fo, col = f.pos ? '#2f8a4a' : '#c4382f'; ctx.fillStyle = f.pos ? '#dff3df' : '#f9dcd6'; rr(ctx, x + 22, y + 238, bw - 44, 62, 10); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
    txt(f.pos ? 'BONUS' : 'MALUS', x + 36, y + 254, 12, col, 'left');
    txt('ANSIA ' + (f.pos ? '' : '+') + f.a + '    ' + (f.pos ? '+' : '') + f.p + ' punti', x + bw - 36, y + 254, 12, col, 'right');
    wrap(f.t, bw - 80, 15).slice(0, 2).forEach((l, i) => txt(l, x + 36, y + 274 + i * 17, 15, '#2a1d10', 'left')); }
  if (c.first) { ctx.save(); ctx.translate(x + bw - 72, y + 68); ctx.rotate(0.22); ctx.fillStyle = '#ffd24d'; rr(ctx, -62, -16, 124, 32, 8); ctx.fill(); ctx.strokeStyle = '#a56a10'; ctx.lineWidth = 2; ctx.stroke(); txt('NUOVO! +100', 0, 1, 15, '#5a2a08', 'center'); ctx.restore(); }
  if (G.pt > 0.6) txt(touchMode ? 'tocca per continuare' : 'premi per continuare', 0, y + bh - 14, 13, '#8a7a5a', 'center', 0.6 + 0.4 * Math.sin(G.t * 5));
  ctx.restore();
}
function drawOver() {
  const k = ease(cl(G.overT / 0.5, 0, 1));
  ctx.fillStyle = 'rgba(6,10,30,' + (0.78 * k).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2 - 36 + (1 - k) * 30); ctx.globalAlpha = k;
  const bw = 560, bh = 400, x = -bw / 2, y = -bh / 2;
  ctx.fillStyle = '#fbfbf6'; rr(ctx, x, y, bw, bh, 14); ctx.fill(); ctx.strokeStyle = '#2f7fbf'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#c4382f'; rr(ctx, x, y, bw, 50, 14); ctx.fill(); ctx.fillRect(x, y + 30, bw, 20);
  txt('CRISI IPOCONDRIACA!', 0, y + 26, 28, '#fff', 'center');
  txt('REFERTO MEDICO — Pronto Soccorso del Molo', 0, y + 72, 14, '#7a8a9a', 'center');
  const s = G.stats, ln = [
    ['Paziente', 'Leopoldo, 32 anni, milanese'],
    ['Diagnosi', 'Ipocondria acuta (di origine marittima)'],
    ['Pesci pescati', String(s.fish)],
    ['Oggetti assurdi', s.gag + '  (di cui nemici: ' + s.martino + ')'],
    ['Farmaci trovati', String(s.pills)],
    ['Combo migliore', 'x' + s.bestCombo],
    ['Durata della giornata', mmss(G.time)],
    ['Ginocchio', 'ancora dolorante'],
  ];
  ln.forEach((r, i) => { txt(r[0], x + 30, y + 104 + i * 25, 15, '#4a5a6a', 'left'); txt(r[1], x + bw - 30, y + 104 + i * 25, 15, '#1a2a3a', 'right'); });
  ctx.strokeStyle = '#d8e2ea'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 24, y + 312); ctx.lineTo(x + bw - 24, y + 312); ctx.stroke();
  txt('PUNTEGGIO  ' + G.score + (G.over && G.over.newBest ? '   ★ NUOVO RECORD ★' : ''), 0, y + 334, 22, '#2f7fbf', 'center');
  txt('Grado: ' + rankOf(G.score), 0, y + 362, 17, '#c4382f', 'center');
  txt('Prognosi: sano come un pesce. Ma non ci crede.', 0, y + 384, 13, '#7a8a9a', 'center');
  ctx.restore();
  if (G.overT > 0.9) { button(BTN.over[0], 'RIPROVA', true); button(BTN.over[1], 'PESCADEX'); }
}
function dexRect(i) { const col = i % 7, row = Math.floor(i / 7); return { x: 22 + col * 132, y: 70 + row * 82, w: 124, h: 74 }; }
function drawDex() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#13204a'); g.addColorStop(1, '#0a2a55'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  txt('PESCADEX', W / 2, 34, 34, '#ffd24d', 'center', 1, '#000');
  txt(dexCount() + ' / ' + ITEMS.length + ' scoperti' + (save.done ? '   ★ COMPLETO ★' : ''), W / 2, 60, 14, '#9fc0e8', 'center');
  ITEMS.forEach((it, i) => {
    const r = dexRect(i), got = !!save.dex[it.id], sel = G.sel === i;
    ctx.fillStyle = got ? '#fbf3de' : 'rgba(255,255,255,0.08)'; rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill();
    ctx.lineWidth = sel ? 4 : 2; ctx.strokeStyle = sel ? '#ffd24d' : got ? '#7a5a2c' : 'rgba(255,255,255,0.2)'; ctx.stroke();
    if (got) { ctx.save(); ctx.beginPath(); rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.clip(); drawIcon(ctx, it.id, r.x + r.w / 2, r.y + 30, 0.44); ctx.restore(); txt(it.n, r.x + r.w / 2, r.y + 63, it.n.length > 15 ? 9.5 : 11, '#3a2410', 'center'); txt('x' + save.dex[it.id], r.x + r.w - 8, r.y + 12, 11, '#8a5a1c', 'right'); }
    else txt('?', r.x + r.w / 2, r.y + 37, 38, 'rgba(255,255,255,0.25)', 'center');
  });
  const it = ITEMS[G.sel] || ITEMS[0], got = !!save.dex[it.id];
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, 34, 408, W - 68, 76, 12); ctx.fill();
  if (got) { txt(it.n, 52, 427, 18, '#ffd24d', 'left'); wrap(it.t, W - 120, 14).forEach((l, i) => txt(l, 52, 450 + i * 18, 14, '#fff', 'left')); }
  else txt('??? — pesca ancora per scoprirlo (' + ['vicino', 'medio', 'largo'][it.z.indexOf(Math.max.apply(null, it.z))] + ')', 52, 446, 15, '#9fc0e8', 'left');
  button(BTN.dex[0], 'INDIETRO');
}
function drawFinale() {
  ctx.fillStyle = 'rgba(8,10,30,0.88)'; ctx.fillRect(0, 0, W, H);
  const k = ease(cl(G.finT / 0.6, 0, 1));
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k); ctx.globalAlpha = k;
  ctx.fillStyle = '#fbf3de'; rr(ctx, -330, -190, 660, 380, 16); ctx.fill(); ctx.strokeStyle = '#c9a23c'; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = '#7a5a2c'; ctx.lineWidth = 2; rr(ctx, -318, -178, 636, 356, 12); ctx.stroke();
  ctx.save(); ctx.translate(246, -26); ctx.fillStyle = '#e6d9b4'; ctx.beginPath(); ctx.ellipse(0, 0, 52, 62, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#c9a23c'; ctx.lineWidth = 4; ctx.stroke(); ctx.clip(); drawLeoHead(ctx, 0, 6, 1.3, 0, false, G.t); ctx.restore();
  txt('CERTIFICATO', 0, -140, 22, '#7a5a2c', 'center'); txt('DI PESCATORE UFFICIALE', 0, -104, 36, '#c4382f', 'center');
  txt('si certifica che', 0, -64, 15, '#7a5a2c', 'center'); txt('LEOPOLDO', 0, -22, 52, '#2f6f9f', 'center');
  txt('ha scoperto tutte le ' + ITEMS.length + ' meraviglie del Pescadex,', 0, 24, 16, '#4a3a22', 'center');
  txt('compresi un ferro da stiro e il suo stesso ginocchio.', 0, 46, 16, '#4a3a22', 'center');
  txt('BUON NATALE!', 0, 96, 34, '#2f8a4a', 'center'); txt('Dai tuoi amici (e anche da Martino, che ha timbrato).', 0, 134, 14, '#7a5a2c', 'center');
  if (G.finT > 1.5) txt(touchMode ? 'tocca per continuare' : 'premi per continuare', 0, 166, 13, '#8a7a5a', 'center', 0.6 + 0.4 * Math.sin(G.t * 5));
  ctx.restore();
}
function drawPaused() { ctx.fillStyle = 'rgba(6,10,30,0.7)'; ctx.fillRect(0, 0, W, H); txt('PAUSA', W / 2, H / 2 - 10, 54, '#fff', 'center', 1, '#000'); txt(touchMode ? 'tocca per riprendere' : 'P o clic per riprendere', W / 2, H / 2 + 40, 16, '#ffd24d', 'center'); }

const isPortrait = () => window.innerHeight > window.innerWidth * 1.05;
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, offX * dpr, offY * dpr);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  const m = G.mode;
  if (m === 'dex') drawDex();
  else if (m === 'title') { drawTitle(); drawParts(); }
  else {
    if (G.shake > 0) ctx.translate(rnd(-1, 1) * G.shake * 0.5, rnd(-1, 1) * G.shake * 0.5);
    drawSky(); drawSea();
    if (G.ped) drawPedalo(G.ped);
    drawPier(); const rp = drawLeo(LX, LY); drawLineAndBobber(rp); drawParts();
    if (G.bubble) { const a = cl(G.bubble.life / 0.4, 0, 1); bubble(LX + 6, LY - 176, G.bubble.t, { hot: G.bubble.hot, alpha: a, w: 170, size: 14 }); }
    if (G.flash > 0) { ctx.fillStyle = 'rgba(255,60,60,' + (G.flash * 0.9).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
    if (m !== 'over' || G.overT < 0.3) drawHUD();
    if (G.ph === 'reveal' && m === 'play') drawCard();
    if (m === 'over') drawOver();
    if (m === 'finale') { drawFinale(); drawParts(); }
    if (m === 'paused') drawPaused();
  }
  ctx.restore();
  if (isPortrait()) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(6,10,30,0.95)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const f = Math.max(16, Math.floor(canvas.width / 14));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd24d'; ctx.font = 'bold ' + f + 'px ' + FONT; ctx.fillText('Ruota il telefono', canvas.width / 2, canvas.height / 2 - f * 0.6);
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.floor(f * 0.55) + 'px ' + FONT; ctx.fillText('Leopoldo pesca in orizzontale', canvas.width / 2, canvas.height / 2 + f * 0.7);
  }
}

// ───────────────────────── input ─────────────────────────
function down() { audio(); startAmb(); if (holding) return; holding = true; press(); }
function up() { if (!holding) return; holding = false; release(); }
function toggleMute() { muted = !muted; try { localStorage.setItem('leopoldo.mute', muted ? '1' : '0'); } catch (e) {} if (!muted) { startAmb(); tone(660, 0.1, 'triangle', 0.07); } setAmb(); }
function openDex(from) { G.prevMode = from; G.mode = 'dex'; holding = false; sfx.select(); }
function closeDex() { G.mode = G.prevMode === 'play' ? 'play' : G.prevMode === 'over' ? 'over' : 'title'; sfx.select(); }
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  audio(); startAmb();
  if (G.mode === 'dex') {
    if (e.code === 'Escape' || e.code === 'KeyC' || e.code === 'Enter') closeDex();
    else if (e.code === 'ArrowRight') G.sel = Math.min(ITEMS.length - 1, G.sel + 1);
    else if (e.code === 'ArrowLeft') G.sel = Math.max(0, G.sel - 1);
    else if (e.code === 'ArrowDown') G.sel = Math.min(ITEMS.length - 1, G.sel + 7);
    else if (e.code === 'ArrowUp') G.sel = Math.max(0, G.sel - 7);
    return;
  }
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'KeyW') down();
  else if (e.code === 'KeyP' || e.code === 'Escape') { if (G.mode === 'play') { G.mode = 'paused'; holding = false; } else if (G.mode === 'paused') G.mode = 'play'; }
  else if (e.code === 'KeyM') toggleMute();
  else if (e.code === 'KeyC' && (G.mode === 'title' || G.mode === 'over' || (G.mode === 'play' && G.ph === 'idle'))) openDex(G.mode);
});
window.addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'KeyW') up(); });
const toWorld = e => ({ x: (e.clientX - offX) / scale, y: (e.clientY - offY) / scale });
const inR = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  e.preventDefault(); audio(); startAmb();
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  if (e.pointerType === 'touch') touchMode = true;
  const p = toWorld(e), m = G.mode;
  if (m === 'title') { for (const b of BTN.title) if (inR(p, b)) { if (b.id === 'play') startRun(); else openDex('title'); return; } return; }
  if (m === 'over') { if (G.overT > 0.9) for (const b of BTN.over) if (inR(p, b)) { if (b.id === 'retry') startRun(); else openDex('over'); return; } return; }
  if (m === 'dex') { if (inR(p, BTN.dex[0])) { closeDex(); return; } ITEMS.forEach((it, i) => { if (inR(p, dexRect(i))) { G.sel = i; sfx.select(); } }); return; }
  down();
});
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
window.addEventListener('blur', () => { if (G.mode === 'play') G.mode = 'paused'; holding = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play') G.mode = 'paused'; });

// ───────────────────────── loop ─────────────────────────
let acc = 0, last = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000 || 0.016); last = now; acc += dt; let n = 0;
  if (isPortrait() && G.mode === 'play') { G.mode = 'paused'; holding = false; }
  while (acc >= DT && n < 5) { if (G.mode !== 'paused') update(DT); acc -= DT; n++; }
  if (n >= 5) acc = 0;
  musicTick(); render(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__pesca = { G, ITEMS, update, render, press, release, startRun, setHold(v) { holding = v; }, get holding() { return holding; }, save: () => save, openDex, rodPose, W, H };
})();
