/* LUCA e la Moka Rubata — a 2D platformer.
 * Plain canvas + WebAudio, no dependencies. Levels live in levels.js.
 */
(() => {
'use strict';
const LEVELS = window.LUCA_LEVELS;
const W = 960, H = 544, T = 32, ROWS = 17, TAU = Math.PI * 2, DT = 1 / 60;
const FONT = '"Trebuchet MS","Segoe UI",system-ui,sans-serif';
const THEME_ORDER = ['grass', 'cave', 'sky', 'ice', 'lava', 'castle'];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scale = 1, offX = 0, offY = 0, dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vw = window.innerWidth, vh = window.innerHeight;
  canvas.width = Math.floor(vw * dpr); canvas.height = Math.floor(vh * dpr);
  canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
  scale = Math.min(vw / W, vh / H);
  offX = (vw - W * scale) / 2; offY = (vh - H * scale) / 2;
}
window.addEventListener('resize', resize); resize();

const rnd = (a, b) => a + Math.random() * (b - a);
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const mmss = s => { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

// ───────────────────────── tiles ─────────────────────────
const GR = 1, ICE = 2, OW = 3, CR = 4, USED = 5, SPK = 6, LIQ = 7, SPR = 8, STN = 9;
const solid = t => t === 1 || t === 2 || t === 4 || t === 5 || t === 8 || t === 9;

// ───────────────────────── save ─────────────────────────
let save = { unlocked: 1, best: {} };
try { const s = JSON.parse(localStorage.getItem('luca.save')); if (s && typeof s.unlocked === 'number') save = s; } catch (e) {}
function persist() { try { localStorage.setItem('luca.save', JSON.stringify(save)); } catch (e) {} }

// ───────────────────────── state ─────────────────────────
let LV = LEVELS[0];
let S = {
  mode: 'title', sub: 'play', fx: true, t: 0, tick: 0, lvl: 0, tiles: null, p: null,
  en: [], items: [], plats: [], jets: [], cps: [], waves: [], boss: null, bumps: [], parts: [], floats: [],
  cam: { x: 0, shake: 0 }, lives: 5, score: 0, beans: 0, totalBeans: 0, runBeans: 0, time: 0, cp: null,
  arena: false, goalOn: true, winT: 0, banner: 0, sel: 0, combo: 0, info: null, noEn: false, flash: 0,
};

// ───────────────────────── audio ─────────────────────────
let ac = null, muted = false;
try { muted = localStorage.getItem('luca.mute') === '1'; } catch (e) {}
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(f, d, type, v, slide, delay) {
  if (muted) return; const a = audio(); if (!a) return;
  const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.07, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.03);
}
function noise(d, v) {
  if (muted) return; const a = audio(); if (!a) return;
  const n = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, n, a.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), g = a.createGain(); s.buffer = buf; g.gain.value = v || 0.1;
  s.connect(g); g.connect(a.destination); s.start();
}
const sfx = {
  jump() { tone(330, 0.16, 'square', 0.06, 700); },
  djump() { tone(520, 0.14, 'square', 0.05, 1100); },
  land() { tone(130, 0.06, 'triangle', 0.07, 70); },
  bean() { tone(988, 0.06, 'square', 0.05); tone(1319, 0.14, 'square', 0.05, 0, 0.05); },
  stomp() { tone(240, 0.12, 'square', 0.08, 90); noise(0.05, 0.07); },
  hurt() { tone(300, 0.3, 'sawtooth', 0.09, 80); noise(0.15, 0.1); },
  die() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.18, 'square', 0.07, f * 0.9, i * 0.13)); },
  power() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.1, 'square', 0.06, 0, i * 0.06)); },
  crate() { tone(200, 0.08, 'square', 0.07, 420); },
  spring() { tone(220, 0.25, 'sine', 0.1, 900); },
  cp() { tone(660, 0.1, 'triangle', 0.08); tone(880, 0.2, 'triangle', 0.08, 0, 0.1); },
  oneup() { [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => tone(f, 0.09, 'square', 0.06, 0, i * 0.07)); },
  win() { [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.06, 0, i * 0.12)); },
  boom() { noise(0.5, 0.2); tone(90, 0.5, 'sawtooth', 0.1, 30); },
  flame() { noise(0.25, 0.04); },
  select() { tone(700, 0.06, 'square', 0.05); },
};

// procedural chiptune: a seeded pentatonic melody + bass per world
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const MUS = {
  title: { bpm: 96, root: 57, sc: [0, 2, 4, 7, 9], bass: [0, 5, 7, 5], seed: 7 },
  grass: { bpm: 138, root: 60, sc: [0, 2, 4, 7, 9], bass: [0, 7, 5, 7], seed: 11 },
  cave: { bpm: 108, root: 52, sc: [0, 3, 5, 7, 10], bass: [0, 0, 3, 5], seed: 21 },
  sky: { bpm: 126, root: 62, sc: [0, 2, 4, 7, 9], bass: [0, 5, 7, 4], seed: 31 },
  ice: { bpm: 100, root: 64, sc: [0, 2, 4, 7, 9], bass: [0, 7, 9, 5], seed: 41 },
  lava: { bpm: 148, root: 50, sc: [0, 3, 5, 7, 10], bass: [0, 0, 5, 3], seed: 51 },
  castle: { bpm: 136, root: 48, sc: [0, 3, 5, 6, 7, 10], bass: [0, 0, 3, 5], seed: 61 },
  boss: { bpm: 168, root: 45, sc: [0, 3, 5, 6, 7, 10], bass: [0, 0, 0, 5], seed: 71 },
};
const mus = { name: null, step: 0, next: 0, lead: null };
function setMusic(name) {
  if (mus.name === name) return;
  const m = MUS[name]; if (!m) return;
  const r = rng(m.seed), lead = []; let idx = 2;
  for (let i = 0; i < 64; i++) {
    if (i % 16 === 0) idx = Math.floor(r() * m.sc.length);
    if (r() < 0.62) { idx = cl(idx + Math.floor(r() * 5) - 2, 0, m.sc.length * 2 - 1); lead.push(idx); } else lead.push(-1);
  }
  mus.name = name; mus.lead = lead; mus.step = 0; mus.next = 0;
}
const mf = n => 440 * Math.pow(2, (n - 69) / 12);
function musicTick() {
  if (!ac || muted || !mus.lead || S.mode === 'paused') return;
  const m = MUS[mus.name], sd = 60 / m.bpm / 4;
  if (mus.next < ac.currentTime - 0.2) mus.next = ac.currentTime + 0.05;
  while (mus.next < ac.currentTime + 0.12) {
    const s = mus.step, li = mus.lead[s % 64], t0 = mus.next - ac.currentTime;
    if (li >= 0) { const n = m.root + 12 + 12 * Math.floor(li / m.sc.length) + m.sc[li % m.sc.length]; tone(mf(n), sd * 1.6, 'square', 0.022, 0, t0); }
    if (s % 4 === 0) tone(mf(m.root - 12 + m.bass[Math.floor(s / 16) % 4]), sd * 3.4, 'triangle', 0.05, 0, t0);
    else if (s % 8 === 6) tone(mf(m.root - 12 + m.bass[Math.floor(s / 16) % 4] + 7), sd * 1.5, 'triangle', 0.03, 0, t0);
    mus.next += sd; mus.step++;
  }
}

// ───────────────────────── fx helpers ─────────────────────────
function puff(x, y, n, col, spd, life, size) {
  if (!S.fx) return;
  for (let i = 0; i < n && S.parts.length < 300; i++) {
    const a = rnd(0, TAU), s = rnd(0.3, 1) * spd;
    S.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * 0.2, life: life * rnd(0.6, 1), max: life, size: size * rnd(0.6, 1.2), col });
  }
}
function floater(x, y, text, col, size) { if (S.fx) S.floats.push({ x, y, text, col, size: size || 16, life: 1.1, max: 1.1 }); }
function shake(n) { S.cam.shake = Math.max(S.cam.shake, n); }
function fxUpdate() {
  if (!S.fx) return;
  for (let i = S.parts.length - 1; i >= 0; i--) {
    const p = S.parts[i]; p.life -= DT; p.x += p.vx * DT; p.y += p.vy * DT; p.vy += (p.g === undefined ? 380 : p.g) * DT; p.vx *= 1 - 1.5 * DT;
    if (p.life <= 0) S.parts.splice(i, 1);
  }
  for (let i = S.floats.length - 1; i >= 0; i--) { const f = S.floats[i]; f.life -= DT; f.y -= 34 * DT; if (f.life <= 0) S.floats.splice(i, 1); }
  for (let i = S.bumps.length - 1; i >= 0; i--) { S.bumps[i].t += DT; if (S.bumps[i].t > 0.2) S.bumps.splice(i, 1); }
  S.cam.shake = Math.max(0, S.cam.shake - 40 * DT);
  S.flash = Math.max(0, S.flash - DT);
}

// ───────────────────────── level loading ─────────────────────────
const EN = {
  slime: { w: 26, h: 22, vx: 46, stomp: true },
  beetle: { w: 28, h: 22, vx: 58, stomp: false },
  bat: { w: 26, h: 18, vx: 72, stomp: true },
};
function newPlayer(s) {
  return { x: s.x * T + 6, y: (s.y + 1) * T - 30, w: 20, h: 30, vx: 0, vy: 0, on: false, coy: 0, buf: 0, dir: 1, inv: 0, hearts: 3,
    turbo: 0, dj: false, ph: 0, sx: 1, sy: 1, drop: 0, rid: null, gt: 0, pb: 0, dust: 0 };
}
function mkEnemy(d) {
  const k = EN[d.t], dir = Math.random() < 0.5 ? -1 : 1;
  const e = { t: d.t, w: k.w, h: k.h, x: d.x + (T - k.w) / 2, y: d.y - k.h, vx: k.vx * dir, vy: 0, alive: true, dead: 0, ph: rnd(0, 6), ph0: rnd(0, 6), on: false, stomp: k.stomp };
  if (d.t === 'bat') { e.x0 = e.x; e.y0 = d.y - T / 2 - e.h / 2; e.y = e.y0; }
  return e;
}
function mkPlat(d) { return Object.assign({ ox: d.x, oy: d.y, px: d.x, py: d.y, dx: 0, dy: 0, h: 14, st: 'idle', t: 0, vy: 0 }, d); }

function loadLevel(i) {
  LV = LEVELS[i]; S.lvl = i; S.tiles = LV.tiles.slice(); S.p = newPlayer(LV.startPos);
  S.en = S.noEn ? [] : LV.enemies.map(mkEnemy);
  S.items = LV.beans.map(b => ({ k: 'bean', x: b.x, y: b.y, got: false, ph: rnd(0, 6) }));
  S.plats = LV.plats.map(mkPlat);
  S.jets = S.noEn ? [] : LV.jets.map(j => Object.assign({}, j, { on: false }));
  S.cps = LV.cps.map(c => Object.assign({}, c, { on: false }));
  S.waves = []; S.bumps = []; S.parts = []; S.floats = []; S.cp = null; S.beans = 0; S.time = 0; S.combo = 0; S.flash = 0;
  S.totalBeans = LV.beans.length + Object.values(LV.crates).filter(v => v === 'bean').length;
  S.arena = false; S.goalOn = !LV.boss; S.winT = 0; S.sub = 'play'; S.banner = 2.6; S.info = null;
  S.boss = null;
  if (LV.boss && !S.noEn) {
    const b = LV.bossAt;
    S.boss = { x: b.x * T, y: (b.y + 1) * T - 56, w: 56, h: 56, vx: 0, vy: 0, hp: 3, st: 'sleep', t: 0, dir: -1, inv: 0, ph: 0, on: false };
  }
  S.cam.x = 0; S.cam.shake = 0; updCam(true);
  setMusic(LV.theme);
}
function startLevel(i, fresh) {
  if (fresh) { S.lives = 5; S.score = 0; S.runBeans = 0; }
  S.mode = 'play'; loadLevel(i);
}

// ───────────────────────── collision ─────────────────────────
function tileAt(tx, ty) {
  if (tx < 0 || tx >= LV.cols) return STN;
  if (ty < 0 || ty >= ROWS) return 0;
  return S.tiles[ty * LV.cols + tx];
}
function moveEnt(e, dx, dy, oneWay) {
  let hitX = false, landed = false, bumped = null, gt = 0;
  if (dx !== 0) {
    e.x += dx;
    const y0 = Math.floor(e.y / T), y1 = Math.floor((e.y + e.h - 0.01) / T);
    if (dx > 0) { const tx = Math.floor((e.x + e.w - 0.01) / T); for (let y = y0; y <= y1; y++) if (solid(tileAt(tx, y))) { e.x = tx * T - e.w; hitX = true; break; } }
    else { const tx = Math.floor(e.x / T); for (let y = y0; y <= y1; y++) if (solid(tileAt(tx, y))) { e.x = (tx + 1) * T; hitX = true; break; } }
  }
  if (dy !== 0) {
    const pb = e.y + e.h; e.y += dy;
    const x0 = Math.floor(e.x / T), x1 = Math.floor((e.x + e.w - 0.01) / T);
    if (dy > 0) {
      const ty = Math.floor((e.y + e.h - 0.01) / T);
      for (let x = x0; x <= x1; x++) {
        const t = tileAt(x, ty);
        if (solid(t) || (t === OW && oneWay && !(e.drop > 0) && pb <= ty * T + 0.5)) { e.y = ty * T - e.h; landed = true; gt = t; break; }
      }
    } else {
      const ty = Math.floor(e.y / T), cx = e.x + e.w / 2; let best = -1, bd = 1e9;
      for (let x = x0; x <= x1; x++) if (solid(tileAt(x, ty))) { const d = Math.abs(x * T + 16 - cx); if (d < bd) { bd = d; best = x; } }
      if (best >= 0) { e.y = (ty + 1) * T; bumped = { x: best, ty }; }
    }
  }
  return { hitX, landed, bumped, gt };
}
const overlap = (a, b, m) => { m = m || 0; return a.x + a.w - m > b.x && a.x + m < b.x + b.w && a.y + a.h - m > b.y && a.y + m < b.y + b.h; };

// ───────────────────────── gameplay ─────────────────────────
function hurt(dx) {
  const p = S.p;
  if (p.inv > 0 || S.sub !== 'play') return;
  p.hearts--;
  if (p.hearts <= 0) { die(); return; }
  p.inv = 1.7; p.vx = dx * 230; p.vy = -380; p.on = false; p.rid = null; S.combo = 0;
  shake(8); S.flash = 0.18; sfx.hurt(); puff(p.x + p.w / 2, p.y + p.h / 2, 12, '#ff6b6b', 200, 0.5, 3);
}
function die() {
  if (S.sub !== 'play') return;
  const p = S.p; S.sub = 'dying'; p.dt = 0; p.vy = -560; p.vx = 0; p.hearts = 0; S.lives--; S.combo = 0;
  sfx.die(); shake(10);
}
function respawn() {
  if (S.lives <= 0) { S.mode = 'over'; return; }
  const p = S.p, c = S.cp;
  const np = newPlayer(LV.startPos);
  if (c) { np.x = c.x + 6; np.y = c.y + T - 30; }
  np.inv = 2; Object.assign(p, np); p.rid = null;
  S.sub = 'play'; S.cam.x = Math.max(0, p.x - W * 0.4); S.combo = 0;
  if (S.arena) S.cam.x = LV.arena * T;
  updCam(true);
}
function addBean(n) {
  S.beans += n; S.runBeans += n; S.score += 10 * n;
  if (Math.floor(S.runBeans / 100) > Math.floor((S.runBeans - n) / 100)) { S.lives++; sfx.oneup(); floater(S.p.x, S.p.y - 24, '+1 VITA!', '#ff8fa3', 20); }
}
function hitCrate(bx, ty) {
  const key = bx + ',' + ty;
  if (S.tiles[ty * LV.cols + bx] !== CR) return;
  S.tiles[ty * LV.cols + bx] = USED; S.bumps.push({ x: bx, y: ty, t: 0 });
  const item = LV.crates[key] || 'bean', cx = bx * T + 16, cy = ty * T + 16;
  sfx.crate();
  if (item === 'bean') { addBean(1); sfx.bean(); floater(cx, cy - 24, '+10', '#ffd24d', 14); puff(cx, cy - 20, 8, '#ffd24d', 160, 0.5, 2.5); }
  else S.items.push({ k: item, x: cx, y: cy, ty: cy - 36, got: false, ph: 0 });
}
function killEnemy(e, byTurbo) {
  e.alive = false; e.dead = 0.5; S.combo++;
  const pts = 100 * Math.min(8, S.combo); S.score += pts;
  floater(e.x + e.w / 2, e.y - 6, '+' + pts, '#fff', 15);
  puff(e.x + e.w / 2, e.y + e.h / 2, 12, byTurbo ? '#ffb347' : '#fff', 220, 0.5, 3);
  sfx.stomp();
}

function updPlats() {
  for (const pl of S.plats) {
    pl.px = pl.x; pl.py = pl.y;
    if (pl.k === 'mp') { const s = Math.sin(S.t * pl.sp + pl.ph); pl.x = pl.ox + s * pl.ax; pl.y = pl.oy + s * pl.ay; }
    else if (pl.st === 'shake') { pl.t -= DT; if (pl.t <= 0) { pl.st = 'fall'; pl.vy = 0; } }
    else if (pl.st === 'fall') { pl.vy = Math.min(700, pl.vy + 1500 * DT); pl.y += pl.vy * DT; if (pl.y > H + 80) { pl.st = 'gone'; pl.t = 3; } }
    else if (pl.st === 'gone') { pl.t -= DT; if (pl.t <= 0) { pl.st = 'idle'; pl.x = pl.ox; pl.y = pl.oy; pl.px = pl.x; pl.py = pl.y; } }
    pl.dx = pl.x - pl.px; pl.dy = pl.y - pl.py;
  }
}

function updPlayer(inp) {
  const p = S.p;
  if (p.rid && p.rid.st !== 'gone') { p.x += p.rid.dx; p.y += p.rid.dy; }
  p.pb = p.y + p.h;
  const turbo = p.turbo > 0;
  p.inv = Math.max(0, p.inv - DT); p.turbo = Math.max(0, p.turbo - DT); p.drop = Math.max(0, p.drop - DT);
  p.sx += (1 - p.sx) * Math.min(1, DT * 12); p.sy += (1 - p.sy) * Math.min(1, DT * 12);

  const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0), ice = p.on && p.gt === 2;
  const maxV = (inp.run ? 290 : 208) * (turbo ? 1.2 : 1);
  const acc = p.on ? (ice ? 560 : 2400) : 1700, fric = p.on ? (ice ? 230 : 2700) : 450;
  if (dir) {
    p.dir = dir;
    if (p.vx * dir < maxV) { p.vx += dir * acc * (p.vx * dir < 0 ? (ice ? 1.6 : 2.4) : 1) * DT; if (p.vx * dir > maxV) p.vx = dir * maxV; }
    else p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx) - maxV, fric * 0.35 * DT);
  } else { const f = fric * DT; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }

  if (p.on) { p.coy = 0.09; p.dj = false; } else p.coy -= DT;
  p.buf = inp.jp ? 0.11 : p.buf - DT;
  const cx = Math.floor((p.x + p.w / 2) / T);
  if (p.buf > 0 && p.on && inp.down && (tileAt(cx, Math.floor((p.y + p.h + 1) / T)) === OW || (p.rid && p.rid.k))) {
    p.drop = 0.22; p.y += 2; p.on = false; p.buf = 0; p.coy = 0; p.rid = null;
  } else if (p.buf > 0 && p.coy > 0) {
    p.vy = -650 - (Math.abs(p.vx) > 250 ? 30 : 0); p.buf = 0; p.coy = 0; p.on = false; p.rid = null; p.sy = 1.25; p.sx = 0.8;
    sfx.jump(); puff(p.x + p.w / 2, p.y + p.h, 5, '#e8dcc8', 90, 0.3, 2.5);
  } else if (inp.jp && !p.on && turbo && !p.dj) {
    p.vy = -600; p.dj = true; p.sy = 1.2; p.sx = 0.85; sfx.djump(); puff(p.x + p.w / 2, p.y + p.h, 10, '#ffb347', 140, 0.4, 3);
  }
  p.vy = Math.min(900, p.vy + (p.vy < 0 ? (inp.j ? 1750 : 4300) : 2050) * DT);

  const wasOn = p.on, pvy = p.vy;
  const r = moveEnt(p, p.vx * DT, p.vy * DT, true);
  if (r.hitX) p.vx = 0;
  let landed = r.landed;
  if (landed) { p.gt = r.gt; p.rid = null; }
  else if (p.vy >= 0 && p.drop <= 0) {
    for (const pl of S.plats) {
      if (pl.st === 'gone') continue;
      if (p.x + p.w > pl.x + 2 && p.x < pl.x + pl.w - 2 && p.pb <= pl.y + 6 && p.y + p.h >= pl.y) {
        p.y = pl.y - p.h; landed = true; p.rid = pl; p.gt = 0;
        if (pl.k === 'fp' && pl.st === 'idle') { pl.st = 'shake'; pl.t = 0.6; }
        break;
      }
    }
  }
  if (r.bumped) { p.vy = 40; hitCrate(r.bumped.x, r.bumped.ty); }
  if (landed) {
    p.vy = 0;
    if (r.gt === SPR) { p.vy = -1000; landed = false; p.dj = false; p.sy = 1.4; p.sx = 0.7; p.rid = null; sfx.spring(); puff(p.x + p.w / 2, p.y + p.h, 8, '#ffd24d', 140, 0.4, 3); }
    else if (!wasOn && pvy > 260) { p.sy = 0.78; p.sx = 1.22; sfx.land(); puff(p.x + p.w / 2, p.y + p.h, 6, '#e8dcc8', 100, 0.35, 2.5); }
    if (landed) S.combo = 0;
  }
  p.on = landed;
  if (p.on) { p.ph += Math.abs(p.vx) * DT * 0.06; p.dust -= DT; if (Math.abs(p.vx) > 170 && p.dust <= 0) { p.dust = 0.11; puff(p.x + p.w / 2 - p.dir * 6, p.y + p.h, 1, '#e8dcc8', 40, 0.3, 2.2); } }
  else p.ph += DT * 2;
  if (turbo && S.fx && Math.random() < 0.5) puff(p.x + p.w / 2, p.y + p.h / 2, 1, '#ffb347', 60, 0.4, 2.5);

  // hazards
  const x0 = Math.floor((p.x + 3) / T), x1 = Math.floor((p.x + p.w - 3) / T), y0 = Math.floor((p.y + 4) / T), y1 = Math.floor((p.y + p.h - 1) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = tileAt(tx, ty);
    if (t === LIQ) { if (S.sub === 'play') { puff(p.x + 10, p.y + p.h, 14, '#ffd27a', 260, 0.7, 3); die(); } return; }
    if (t === SPK && overlap({ x: p.x + 2, y: p.y + 2, w: p.w - 4, h: p.h - 2 }, { x: tx * T + 4, y: ty * T + 14, w: 24, h: 18 })) hurt(-p.dir);
  }
  if (p.y > H + 60 && S.sub === 'play') die();
}

function updEnemies() {
  const cx = S.cam.x, p = S.p;
  for (const e of S.en) {
    if (!e.alive) { if (e.dead > 0) e.dead -= DT; continue; }
    if (e.x + e.w < cx - 220 || e.x > cx + W + 220) continue;
    e.ph += DT * (e.t === 'bat' ? 7 : 9);
    if (e.t === 'bat') {
      e.x += e.vx * DT;
      const ahead = tileAt(Math.floor((e.x + (e.vx > 0 ? e.w : 0)) / T), Math.floor((e.y + e.h / 2) / T));
      if (Math.abs(e.x - e.x0) > T * 5 || solid(ahead)) e.vx *= -1;
      e.y = e.y0 + Math.sin(S.t * 2.2 + e.ph0) * 30;
    } else {
      e.vy = Math.min(700, e.vy + 1800 * DT);
      const r = moveEnt(e, e.vx * DT, e.vy * DT, true);
      if (r.landed) e.vy = 0; e.on = r.landed;
      if (r.hitX) e.vx *= -1;
      else if (e.on) {
        const t = tileAt(Math.floor((e.x + (e.vx > 0 ? e.w + 3 : -3)) / T), Math.floor((e.y + e.h + 3) / T));
        if (!(solid(t) || t === OW)) e.vx *= -1;
      }
    }
    if (S.sub === 'play' && overlap(p, e, 2)) {
      if (p.turbo > 0) killEnemy(e, true);
      else if (e.stomp && p.vy > 0 && p.pb <= e.y + 10) {
        killEnemy(e, false); p.vy = S.inputJ ? -560 : -380; p.on = false; p.sy = 1.15; p.sx = 0.9; p.rid = null;
      } else hurt(Math.sign(p.x + p.w / 2 - (e.x + e.w / 2)) || 1);
    }
  }
}

function updJets() {
  const p = S.p;
  for (const j of S.jets) {
    const u = (S.t + j.ph) % j.per, was = j.on;
    j.on = u < 0.9; j.warn = u > j.per - 0.8;
    if (j.on && !was && Math.abs(j.x - S.cam.x - W / 2) < W) sfx.flame();
    if (j.on && S.sub === 'play' && overlap(p, { x: j.x + 8, y: j.y - 92, w: 16, h: 92 }, 2)) hurt(-p.dir);
  }
}

function updWaves() {
  const p = S.p;
  for (let i = S.waves.length - 1; i >= 0; i--) {
    const w = S.waves[i]; w.life -= DT; const r = moveEnt(w, w.vx * DT, 0, false);
    if (r.hitX || w.life <= 0) { S.waves.splice(i, 1); continue; }
    if (S.sub === 'play' && overlap(p, w, 2)) hurt(Math.sign(p.x - w.x) || 1);
  }
}

function updBoss() {
  const b = S.boss; if (!b) return;
  const p = S.p;
  if (!S.arena) {
    if (p.x > LV.arena * T + 40) {
      S.arena = true; b.st = 'idle'; b.t = 1.4;
      for (let y = 3; y <= 11; y++) S.tiles[y * LV.cols + (LV.arena - 1)] = STN;
      shake(14); sfx.boom(); setMusic('boss'); S.banner = 2.4;
    } else return;
  }
  b.ph += DT * 6; b.inv = Math.max(0, b.inv - DT);
  const toP = Math.sign(p.x + p.w / 2 - (b.x + b.w / 2)) || 1, rage = 3 - b.hp;
  if (b.st === 'idle') { b.t -= DT; if (b.t <= 0) { b.st = 'walk'; b.t = rnd(1.1, 1.8); } }
  else if (b.st === 'walk') { b.dir = toP; b.vx = toP * (80 + 35 * rage); b.t -= DT; if (b.t <= 0) { b.st = 'air'; b.vy = -820; b.vx = toP * (190 + 30 * rage); } }
  else if (b.st === 'dizzy') { b.vx = 0; b.t -= DT; if (b.t <= 0) { b.st = 'walk'; b.t = rnd(1, 1.6); } }
  else if (b.st === 'hit') { b.vx = 0; b.t -= DT; if (b.t <= 0) { b.st = 'walk'; b.t = 1.2; } }
  else if (b.st === 'dead') {
    b.t -= DT; if (S.fx && Math.random() < 0.5) puff(b.x + rnd(0, b.w), b.y + rnd(0, b.h), 3, '#ffb347', 200, 0.6, 4);
    if (b.t <= 0 && !S.goalOn) { S.goalOn = true; sfx.power(); shake(10); puff(b.x + b.w / 2, b.y + b.h / 2, 30, '#fff', 300, 0.9, 4); b.st = 'gone'; }
    return;
  } else if (b.st === 'gone') return;
  b.vy = Math.min(900, b.vy + 2000 * DT);
  const r = moveEnt(b, b.vx * DT, b.vy * DT, false);
  if (r.hitX && b.st === 'walk') b.vx = 0;
  if (r.landed) {
    if (b.st === 'air') {
      b.st = 'dizzy'; b.t = 1.9 - 0.2 * rage; shake(12); sfx.boom();
      for (const d of [-1, 1]) S.waves.push({ x: b.x + b.w / 2 + d * 30 - 11, y: b.y + b.h - 20, w: 22, h: 20, vx: d * (230 + 30 * rage), life: 3 });
      puff(b.x + b.w / 2, b.y + b.h, 14, '#e8dcc8', 200, 0.5, 3);
    }
    b.vy = 0;
  }
  if (S.sub !== 'play' || !overlap(p, b, 4)) return;
  if (b.st === 'dizzy' && p.vy > 0 && p.pb <= b.y + 18) {
    b.hp--; p.vy = -620; p.on = false; p.rid = null; sfx.stomp(); shake(10); S.score += 500; floater(b.x + b.w / 2, b.y - 10, '+500', '#fff', 20);
    puff(b.x + b.w / 2, b.y, 16, '#fff', 260, 0.6, 3);
    if (b.hp <= 0) { b.st = 'dead'; b.t = 1.6; sfx.boom(); S.waves = []; } else { b.st = 'hit'; b.t = 0.9; b.inv = 0.9; }
  } else if (b.st !== 'hit' && b.st !== 'dead') hurt(Math.sign(p.x + p.w / 2 - (b.x + b.w / 2)) || 1);
}

function updItems() {
  const p = S.p, px = p.x + p.w / 2, py = p.y + p.h / 2;
  for (const it of S.items) {
    if (it.got) continue;
    if (it.ty !== undefined) it.y = Math.max(it.ty, it.y - 70 * DT);
    it.ph += DT * 4;
    const r = it.k === 'bean' ? 20 : 24;
    if (Math.abs(it.x - px) < r && Math.abs(it.y - py) < r + 4) {
      it.got = true;
      if (it.k === 'bean') { addBean(1); sfx.bean(); puff(it.x, it.y, 5, '#ffd24d', 120, 0.4, 2); }
      else if (it.k === 'coffee') { p.turbo = 10; sfx.power(); floater(p.x, p.y - 20, 'TURBO CAFFÈ!', '#ffb347', 20); puff(px, py, 18, '#ffb347', 260, 0.6, 3.5); }
      else if (it.k === 'heart') {
        if (p.hearts < 3) { p.hearts++; floater(p.x, p.y - 20, '+1 CUORE', '#ff8fa3', 18); } else { S.score += 500; floater(p.x, p.y - 20, '+500', '#ff8fa3', 18); }
        sfx.power(); puff(px, py, 12, '#ff8fa3', 200, 0.5, 3);
      }
    }
  }
  for (const c of S.cps) if (!c.on && p.x + p.w > c.x) { c.on = true; S.cp = { x: c.x, y: c.y }; sfx.cp(); floater(c.x + 16, c.y - 10, 'CHECKPOINT', '#8ff7ff', 16); puff(c.x + 16, c.y + 10, 10, '#8ff7ff', 160, 0.5, 3); }
  if (S.goalOn && S.sub === 'play') {
    const g = LV.goalPos;
    if (overlap(p, { x: g.x * T - 6, y: (g.y + 1) * T - 58, w: 44, h: 58 }, 0)) {
      S.sub = 'win'; S.winT = 0; sfx.win(); p.vx = 0;
      if (S.fx) for (let i = 0; i < 60; i++) S.parts.push({ x: g.x * T + 16, y: (g.y + 1) * T - 40, vx: rnd(-260, 260), vy: rnd(-520, -120), life: 1.6, max: 1.6, size: rnd(2, 4), col: ['#ffd24d', '#ff6b6b', '#8ff7ff', '#9bff8f', '#ff8fe6'][i % 5], g: 600 });
    }
  }
}

function updCam(snap) {
  const p = S.p, c = S.cam;
  let tx = p.x + p.w / 2 - W * 0.42 + p.vx * 0.25, mn = 0, mx = LV.cols * T - W;
  if (S.arena) mn = mx = LV.arena * T;
  tx = cl(tx, mn, mx);
  c.x = snap ? tx : c.x + (tx - c.x) * Math.min(1, DT * 7);
}

function finishLevel() {
  const p = S.p, par = LV.cols * 0.55;
  const heartB = p.hearts * 300, timeB = Math.max(0, Math.round((par - S.time) * 15));
  S.score += heartB + timeB;
  const b = save.best[S.lvl] || { b: 0, t: 9999, s: 0 };
  b.b = Math.max(b.b, S.beans); b.t = Math.min(b.t, S.time); b.s = Math.max(b.s, S.score); b.tot = S.totalBeans;
  save.best[S.lvl] = b; save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, S.lvl + 2)); persist();
  S.info = { heartB, timeB, last: S.lvl === LEVELS.length - 1 };
  S.mode = 'clear';
}

function step(inp) {
  const p = S.p; S.tick++; S.t += DT;
  S.inputJ = inp.j;
  if (S.banner > 0) S.banner -= DT;
  if (S.sub === 'dying') {
    p.vy = Math.min(900, p.vy + 1500 * DT); p.y += p.vy * DT; p.dt += DT; fxUpdate();
    if (p.dt > 1.3) respawn();
    return;
  }
  if (S.sub === 'win') { S.winT += DT; p.vx *= 0.9; fxUpdate(); if (S.winT > 2.2) finishLevel(); return; }
  S.time += DT;
  updPlats(); updPlayer(inp);
  if (S.sub === 'play') { updEnemies(); updBoss(); updJets(); updWaves(); updItems(); }
  updCam(false); fxUpdate();
}

// ───────────────────────── themes ─────────────────────────
const TH = {
  grass: { sky: ['#5fb8ff', '#e2f6ff'], top: '#5cc34c', top2: '#3f9d3a', body: '#8a5a2c', body2: '#6d4422', stone: '#a8aeb7', stone2: '#868d98', plank: '#b9824a', liq: '#2f9bff', liq2: '#8fd0ff' },
  cave: { sky: ['#120d26', '#2b1f4d'], top: '#7e6bd0', top2: '#5a49a8', body: '#3d3470', body2: '#2c2552', stone: '#5b5290', stone2: '#443d73', plank: '#8f7bd6', liq: '#35e08a', liq2: '#a8ffd0' },
  sky: { sky: ['#ff9a8b', '#ffe6b8'], top: '#7ed86a', top2: '#55b04a', body: '#c9a06a', body2: '#a67f4b', stone: '#e8dcc8', stone2: '#cbbd9f', plank: '#d9b07a', liq: '#fff', liq2: '#fff' },
  ice: { sky: ['#0d1b3d', '#315a8f'], top: '#f4fbff', top2: '#cfe9fb', body: '#a9d6f2', body2: '#8fc3e6', stone: '#d6efff', stone2: '#b3d9f2', plank: '#9fd4f5', liq: '#1b6fb8', liq2: '#6cc2ff' },
  lava: { sky: ['#1a0707', '#6a1b0c'], top: '#6b5f58', top2: '#4d4440', body: '#3d3532', body2: '#2c2623', stone: '#7a6e68', stone2: '#5c524e', plank: '#8a5a3a', liq: '#ff5a1f', liq2: '#ffd04d' },
  castle: { sky: ['#140a24', '#3b1f55'], top: '#6d6890', top2: '#524e75', body: '#403c63', body2: '#2f2c4c', stone: '#6d6890', stone2: '#4d4970', plank: '#8b6a4a', liq: '#9a3dff', liq2: '#e0b0ff' },
};

// ───────────────────────── drawing: text & shapes ─────────────────────────
function txt(s, x, y, size, col, align, alpha, outline) {
  ctx.font = 'bold ' + size + 'px ' + FONT; ctx.textBaseline = 'middle'; ctx.textAlign = align || 'left';
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  if (outline) { ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = outline; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.globalAlpha = 1;
}
function heart(c, x, y, s, col) {
  c.fillStyle = col; c.beginPath(); c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.3, y + s * 0.1, x - s * 0.7, y - s * 0.9, x, y - s * 0.25);
  c.bezierCurveTo(x + s * 0.7, y - s * 0.9, x + s * 1.3, y + s * 0.1, x, y + s * 0.9); c.fill();
}
function bean(c, x, y, s, a) {
  c.save(); c.translate(x, y); c.rotate(a || 0); c.fillStyle = '#6b3f1d'; c.beginPath(); c.ellipse(0, 0, s, s * 1.3, 0, 0, TAU); c.fill();
  c.strokeStyle = '#c99b63'; c.lineWidth = Math.max(1, s * 0.22); c.beginPath(); c.moveTo(0, -s * 1.1); c.quadraticCurveTo(s * 0.6, 0, 0, s * 1.1); c.stroke(); c.restore();
}
function glow(c, x, y, r, col, a) {
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = a; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.globalAlpha = 1;
}

// Luca: orange hoodie, jeans, white sneakers, teal backpack
function drawLuca(c, x, y, o) {
  c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(o.dir * (o.sx || 1), o.sy || 1);
  const run = o.state === 'run', air = o.state === 'air';
  const sw = run ? Math.sin(o.ph * 2.4) : 0, la = air ? 3 : sw * 5, aa = air ? 0 : -sw * 4, bob = run ? Math.abs(Math.cos(o.ph * 2.4)) * -1.5 : 0;
  if (o.turbo) { glow(c, 0, -16, 34, '#ffb347', 0.5); }
  c.translate(0, bob);
  // back arm, backpack
  c.fillStyle = '#d96a1c'; c.fillRect(-3 + (air ? -2 : aa), air ? -26 : -19, 4, air ? 9 : 8);
  c.fillStyle = '#2a9d8f'; c.fillRect(-10, -19, 5, 10); c.fillStyle = '#1f7a6f'; c.fillRect(-10, -12, 5, 2);
  // legs
  c.fillStyle = '#26417a'; c.fillRect(-5 + la, -9, 4, 9); c.fillStyle = '#2f4f95'; c.fillRect(1 - la, -9, 4, 9);
  c.fillStyle = '#fff'; c.fillRect(-5 + la, -3, 6, 3); c.fillRect(1 - la, -3, 6, 3);
  c.fillStyle = '#c9ced6'; c.fillRect(-5 + la, -1, 6, 1); c.fillRect(1 - la, -1, 6, 1);
  // torso
  c.fillStyle = '#ff8a2a'; c.fillRect(-6, -20, 12, 11); c.fillStyle = '#e06f12'; c.fillRect(-6, -21, 12, 3); c.fillRect(-3, -13, 6, 3);
  // front arm
  c.fillStyle = '#ff8a2a'; c.fillRect(0 + (air ? 3 : -aa), air ? -27 : -19, 4, air ? 9 : 8);
  c.fillStyle = '#f2b98a'; c.fillRect(0 + (air ? 3 : -aa), air ? -29 : -11, 4, 3);
  // head
  c.fillStyle = '#f2b98a'; c.fillRect(-5, -32, 11, 12);
  c.fillStyle = '#3b2314'; c.fillRect(-6, -35, 13, 5); c.fillRect(-6, -31, 3, 8); c.fillRect(0, -37, 4, 3);
  c.fillStyle = '#1a1a1a'; c.fillRect(2, -28, 2, 3); c.fillRect(-0.5, -29.5, 4, 1);
  c.fillStyle = '#b5683a'; c.fillRect(2, -24, 4, 1);
  c.restore();
}

// ───────────────────────── drawing: backgrounds ─────────────────────────
function ridge(c, cx, par, base, amp, f, col, seed) {
  c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W; x += 12) {
    const wx = x + cx * par;
    c.lineTo(x, base - amp * (0.55 * Math.sin(wx * f + seed) + 0.3 * Math.sin(wx * f * 2.3 + seed * 1.7) + 0.15 * Math.sin(wx * f * 5.1)));
  }
  c.lineTo(W, H); c.closePath(); c.fill();
}
function cloud(c, x, y, s, col) {
  c.fillStyle = col; c.beginPath(); c.arc(x, y, 16 * s, 0, TAU); c.arc(x + 18 * s, y - 8 * s, 20 * s, 0, TAU);
  c.arc(x + 40 * s, y, 16 * s, 0, TAU); c.arc(x + 20 * s, y + 6 * s, 18 * s, 0, TAU); c.fill();
}
function clouds(c, cx, par, n, y0, col) {
  for (let i = 0; i < n; i++) {
    const m = W + 360, x = (((i * 310 + 40 - cx * par + S.t * 6 * (1 + i % 3 * 0.3)) % m) + m) % m - 180;
    cloud(c, x, y0 + (i * 53 % 90), 0.9 + (i % 3) * 0.35, col);
  }
}
function stars(c, n, tw) {
  for (let i = 0; i < n; i++) { c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(S.t * tw + i)); c.fillStyle = '#fff'; c.fillRect(hash(i, 1) * W, hash(i, 2) * H * 0.7, 2, 2); }
  c.globalAlpha = 1;
}
function drawBG(c, theme, cx) {
  const th = TH[theme], g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (theme === 'grass') {
    glow(c, 780, 110, 140, '#fff6c0', 0.9); c.fillStyle = '#fff3a8'; c.beginPath(); c.arc(780, 110, 42, 0, TAU); c.fill();
    clouds(c, cx, 0.1, 5, 40, 'rgba(255,255,255,0.9)');
    ridge(c, cx, 0.15, 380, 70, 0.006, '#a5dcae', 1); ridge(c, cx, 0.3, 430, 60, 0.009, '#7cc88c', 2); ridge(c, cx, 0.5, 490, 40, 0.012, '#5aae6c', 3);
  } else if (theme === 'cave') {
    ridge(c, cx, 0.2, 400, 80, 0.007, '#1a1436', 4);
    for (let i = 0; i < 16; i++) {
      const x = (((i * 83 - cx * 0.45) % (W + 90)) + W + 90) % (W + 90) - 45, h = 50 + hash(i, 9) * 90;
      c.fillStyle = '#1d1738'; c.beginPath(); c.moveTo(x - 24, 0); c.lineTo(x + 24, 0); c.lineTo(x, h); c.fill();
    }
    for (let i = 0; i < 36; i++) {
      const x = (((hash(i, 3) * W * 2 - cx * 0.3) % W) + W) % W, y = 120 + hash(i, 4) * 330, a = 0.3 + 0.7 * Math.abs(Math.sin(S.t * 1.5 + i));
      glow(c, x, y, 16, i % 2 ? '#7fe9ff' : '#ff7be8', a * 0.6); c.globalAlpha = a; c.fillStyle = '#fff'; c.fillRect(x - 1, y - 1, 3, 3); c.globalAlpha = 1;
    }
  } else if (theme === 'sky') {
    glow(c, 300, 430, 280, '#fff1c8', 0.8); c.fillStyle = '#fff6dd'; c.beginPath(); c.arc(300, 430, 70, 0, TAU); c.fill();
    clouds(c, cx, 0.08, 5, 60, 'rgba(255,255,255,0.55)');
    for (let i = 0; i < 4; i++) {
      const m = W + 400, x = (((i * 330 - cx * 0.18) % m) + m) % m - 200, y = 250 + hash(i, 5) * 100;
      c.fillStyle = '#c98a78'; c.beginPath(); c.ellipse(x, y, 90, 18, 0, 0, Math.PI); c.fill();
      c.fillStyle = '#8ccf7a'; c.fillRect(x - 90, y - 5, 180, 6);
    }
    clouds(c, cx, 0.3, 6, 300, 'rgba(255,255,255,0.8)');
  } else if (theme === 'ice') {
    stars(c, 70, 1.2);
    for (let b = 0; b < 3; b++) {
      c.globalAlpha = 0.16; c.fillStyle = ['#6dffb2', '#6db8ff', '#c06dff'][b]; c.beginPath(); c.moveTo(0, 90 + b * 40);
      for (let x = 0; x <= W; x += 20) c.lineTo(x, 90 + b * 40 + Math.sin(x * 0.01 + S.t * 0.5 + b + cx * 0.001) * 30);
      c.lineTo(W, 200 + b * 40); c.lineTo(0, 200 + b * 40); c.fill();
    }
    c.globalAlpha = 1; ridge(c, cx, 0.15, 400, 110, 0.006, '#4a6fa0', 6); ridge(c, cx, 0.3, 450, 70, 0.009, '#335480', 7); ridge(c, cx, 0.5, 500, 40, 0.012, '#243e63', 8);
    c.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) {
      const x = (((hash(i, 6) * W + S.t * 18 * (0.4 + hash(i, 7)) - cx * 0.35) % W) + W) % W, y = (hash(i, 8) * H + S.t * (30 + hash(i, 9) * 50)) % H;
      c.globalAlpha = 0.7; c.fillRect(x, y, 2, 2);
    }
    c.globalAlpha = 1;
  } else if (theme === 'lava') {
    ridge(c, cx, 0.15, 400, 130, 0.005, '#3a1010', 9); ridge(c, cx, 0.3, 450, 80, 0.008, '#2a0b0b', 10); ridge(c, cx, 0.5, 500, 40, 0.012, '#1d0707', 11);
    glow(c, W / 2, H + 40, 560, '#ff5a1f', 0.45);
    for (let i = 0; i < 40; i++) {
      const x = (((hash(i, 10) * W * 1.5 - cx * 0.3) % W) + W) % W, y = H - ((hash(i, 11) * H + S.t * (30 + hash(i, 12) * 60)) % H);
      c.globalAlpha = 0.5 + 0.5 * Math.sin(S.t * 3 + i); c.fillStyle = i % 3 ? '#ff9a3d' : '#ffd04d'; c.fillRect(x, y, 3, 3);
    }
    c.globalAlpha = 1;
  } else {
    stars(c, 60, 1.6); glow(c, 720, 120, 150, '#d8d0ff', 0.5); c.fillStyle = '#efeaff'; c.beginPath(); c.arc(720, 120, 42, 0, TAU); c.fill();
    clouds(c, cx, 0.12, 4, 70, 'rgba(60,30,90,0.7)');
    for (let i = 0; i < 7; i++) {
      const m = W + 300, x = (((i * 190 - cx * 0.25) % m) + m) % m - 150, h = 120 + hash(i, 13) * 140;
      c.fillStyle = '#1a0f2e'; c.fillRect(x - 28, H - 80 - h, 56, h + 80); c.fillRect(x - 36, H - 90 - h, 72, 12);
      for (let k = 0; k < 3; k++) c.fillRect(x - 36 + k * 26, H - 104 - h, 12, 14);
      c.fillStyle = '#ffcf6b'; c.globalAlpha = 0.7; c.fillRect(x - 4, H - 60 - h * 0.6, 8, 14); c.globalAlpha = 1;
    }
    ridge(c, cx, 0.5, 510, 30, 0.012, '#120a22', 14);
    if ((S.t * 0.7) % 7 < 0.12) { c.globalAlpha = 0.18; c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
  }
}

// ───────────────────────── drawing: world ─────────────────────────
function drawTile(c, t, tx, ty, th) {
  const x = tx * T, y = ty * T;
  if (t === GR || t === ICE) {
    const open = !solid(tileAt(tx, ty - 1));
    c.fillStyle = th.body; c.fillRect(x, y, T, T);
    c.fillStyle = th.body2;
    for (let i = 0; i < 3; i++) c.fillRect(x + hash(tx, ty + i) * 24, y + 8 + hash(ty, tx + i) * 20, 5, 4);
    if (open) {
      c.fillStyle = th.top; c.fillRect(x, y, T, 9); c.fillStyle = th.top2; c.fillRect(x, y + 9, T, 3);
      if (t === GR && LV.theme === 'grass') { c.fillStyle = th.top; for (let i = 0; i < 3; i++) { const bx = x + 4 + i * 10 + hash(tx, i) * 4; c.fillRect(bx, y - 3, 2, 3); } }
      if (t === ICE) { c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(x + 4, y + 2, 10, 2); }
      if (LV.theme === 'cave' && hash(tx, 7) > 0.8) { c.fillStyle = '#7fe9ff'; c.fillRect(x + 12, y - 8, 4, 8); c.fillRect(x + 8, y - 4, 3, 4); }
    }
  } else if (t === STN) {
    c.fillStyle = th.stone; c.fillRect(x, y, T, T); c.fillStyle = th.stone2; c.fillRect(x, y + 15, T, 2); c.fillRect(x + (ty % 2 ? 8 : 20), y, 2, 15); c.fillRect(x + (ty % 2 ? 22 : 8), y + 17, 2, 15);
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x, y, T, 2);
  } else if (t === CR || t === USED) {
    let off = 0; for (const b of S.bumps) if (b.x === tx && b.y === ty) off = -Math.sin(b.t / 0.2 * Math.PI) * 8;
    const yy = y + off, used = t === USED;
    c.fillStyle = used ? '#7a6a5a' : '#e2a63a'; c.fillRect(x + 1, yy + 1, T - 2, T - 2);
    c.fillStyle = used ? '#5d5043' : '#b97d1c'; c.fillRect(x + 1, yy + 1, T - 2, 3); c.fillRect(x + 1, yy + T - 4, T - 2, 3); c.fillRect(x + 1, yy + 1, 3, T - 2); c.fillRect(x + T - 4, yy + 1, 3, T - 2);
    if (!used) bean(c, x + 16, yy + 16, 5.5, 0.5); else { c.fillStyle = '#5d5043'; c.fillRect(x + 11, yy + 14, 10, 4); }
  } else if (t === OW) {
    c.fillStyle = th.plank; c.fillRect(x, y, T, 10); c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(x, y + 8, T, 2); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x, y, T, 2);
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x + 15, y, 2, 10);
  } else if (t === SPK) {
    c.fillStyle = '#c9ced6'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + i * 10 + 1, y + T); c.lineTo(x + i * 10 + 6, y + 12); c.lineTo(x + i * 10 + 11, y + T); c.fill(); }
    c.fillStyle = '#8b93a0'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + i * 10 + 6, y + T); c.lineTo(x + i * 10 + 6, y + 12); c.lineTo(x + i * 10 + 11, y + T); c.fill(); }
  } else if (t === LIQ) {
    const open = tileAt(tx, ty - 1) !== LIQ;
    c.fillStyle = th.liq; c.fillRect(x, y, T, T);
    if (open) { c.fillStyle = th.liq2; c.fillRect(x, y + 3 + Math.sin(S.t * 3 + tx * 0.9) * 2, T, 6); c.globalAlpha = 0.3; c.fillStyle = th.liq2; c.fillRect(x, y - 4, T, 4); c.globalAlpha = 1; }
  } else if (t === SPR) {
    c.fillStyle = th.stone; c.fillRect(x, y + 20, T, 12);
    c.fillStyle = '#e0e4ea'; for (let i = 0; i < 3; i++) c.fillRect(x + 8, y + 12 + i * 3, 16, 2);
    c.fillStyle = '#ff5a5a'; c.fillRect(x + 3, y + 7, 26, 6); c.fillStyle = '#ff9a9a'; c.fillRect(x + 3, y + 7, 26, 2);
  }
}
function drawGoal(c) {
  const g = LV.goalPos, x = g.x * T + 16, y = (g.y + 1) * T, t = S.t;
  glow(c, x, y - 30, 56, '#fff3a8', 0.5 + 0.2 * Math.sin(t * 3));
  c.fillStyle = '#c4cbd4'; c.beginPath(); c.moveTo(x - 12, y); c.lineTo(x + 12, y); c.lineTo(x + 16, y - 26); c.lineTo(x - 16, y - 26); c.fill();
  c.fillStyle = '#e6ebf0'; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 2, y); c.lineTo(x + 4, y - 26); c.lineTo(x - 8, y - 26); c.fill();
  c.fillStyle = '#9aa3ae'; c.beginPath(); c.moveTo(x - 16, y - 26); c.lineTo(x + 16, y - 26); c.lineTo(x + 11, y - 40); c.lineTo(x - 11, y - 40); c.fill();
  c.fillStyle = '#2a2a2a'; c.fillRect(x - 3, y - 48, 6, 8); c.fillRect(x + 14, y - 38, 8, 5); c.fillRect(x + 20, y - 38, 3, 20);
  c.fillStyle = '#2a2a2a'; c.fillRect(x - 12, y - 26, 24, 3);
  c.globalAlpha = 0.5; c.fillStyle = '#fff';
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x - 2 + Math.sin(t * 2 + i) * 4, y - 54 - i * 12 - ((t * 20) % 12), 4 + i, 0, TAU); c.fill(); }
  c.globalAlpha = 1;
  for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; c.fillStyle = '#fff'; c.fillRect(x + Math.cos(a) * 26, y - 28 + Math.sin(a) * 26, 3, 3); }
}
function drawCheckpoint(c, cp) {
  const x = cp.x + 16, y = cp.y + T;
  c.fillStyle = '#e8e4dc'; c.fillRect(x - 8, y - 14, 16, 14); c.fillRect(x - 10, y - 2, 20, 2);
  c.fillStyle = cp.on ? '#6b3f1d' : '#4a4a4a'; c.fillRect(x - 6, y - 12 + (cp.on ? 0 : 6), 12, cp.on ? 10 : 4);
  c.fillStyle = '#e8e4dc'; c.fillRect(x + 8, y - 11, 4, 8); c.fillRect(x + 10, y - 11, 2, 2);
  if (cp.on) { c.globalAlpha = 0.5; c.fillStyle = '#fff'; c.beginPath(); c.arc(x + Math.sin(S.t * 2) * 3, y - 22 - ((S.t * 14) % 8), 3, 0, TAU); c.fill(); c.globalAlpha = 1; }
}
function drawEnemy(c, e) {
  const th = LV.theme;
  if (!e.alive) {
    if (e.dead <= 0) return;
    c.globalAlpha = e.dead / 0.5; c.fillStyle = '#555'; c.fillRect(e.x, e.y + e.h - 5, e.w, 5); c.globalAlpha = 1; return;
  }
  const cx = e.x + e.w / 2, by = e.y + e.h, dir = Math.sign(e.vx) || 1;
  if (e.t === 'slime') {
    const col = th === 'ice' ? '#7fd0ff' : th === 'lava' ? '#ff7a3d' : th === 'cave' ? '#c07bff' : th === 'castle' ? '#a06bd8' : '#5fd45f';
    const sq = 1 + Math.sin(e.ph) * 0.1;
    c.fillStyle = col; c.beginPath(); c.ellipse(cx, by, e.w / 2 * (2 - sq), e.h * sq, 0, Math.PI, TAU); c.fill(); c.fillRect(cx - e.w / 2 * (2 - sq), by - 3, e.w * (2 - sq), 3);
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.ellipse(cx - 5, by - e.h * 0.7, 4, 2.5, -0.5, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx - 4 + dir * 2, by - 11, 4, 0, TAU); c.arc(cx + 5 + dir * 2, by - 11, 4, 0, TAU); c.fill();
    c.fillStyle = '#222'; c.fillRect(cx - 4 + dir * 4, by - 12, 2, 3); c.fillRect(cx + 5 + dir * 4, by - 12, 2, 3);
  } else if (e.t === 'beetle') {
    const w = Math.sin(e.ph) * 2;
    c.fillStyle = '#222'; c.fillRect(cx - 12, by - 4, 3, 4 + w * 0.3); c.fillRect(cx - 3, by - 4, 3, 4 - w * 0.3); c.fillRect(cx + 8, by - 4, 3, 4 + w * 0.3);
    c.fillStyle = '#4b3a78'; c.beginPath(); c.ellipse(cx, by - 4, 14, 14, 0, Math.PI, TAU); c.fill(); c.fillRect(cx - 14, by - 6, 28, 5);
    c.fillStyle = '#d9d2f0'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(cx + i * 8 - 4, by - 14 + Math.abs(i) * 3); c.lineTo(cx + i * 8, by - 24 + Math.abs(i) * 4); c.lineTo(cx + i * 8 + 4, by - 14 + Math.abs(i) * 3); c.fill(); }
    c.fillStyle = '#ff6b6b'; c.fillRect(cx + dir * 8 - 2, by - 12, 4, 3);
  } else {
    const fl = Math.sin(e.ph * 1.6) * 8, cy = e.y + e.h / 2;
    c.fillStyle = '#2a2140'; c.beginPath(); c.moveTo(cx - 3, cy); c.lineTo(cx - 20, cy - 8 + fl); c.lineTo(cx - 14, cy + 3); c.lineTo(cx - 8, cy + 6 - fl * 0.3); c.fill();
    c.beginPath(); c.moveTo(cx + 3, cy); c.lineTo(cx + 20, cy - 8 + fl); c.lineTo(cx + 14, cy + 3); c.lineTo(cx + 8, cy + 6 - fl * 0.3); c.fill();
    c.fillStyle = '#3d3060'; c.beginPath(); c.ellipse(cx, cy, 9, 9, 0, 0, TAU); c.fill();
    c.fillStyle = '#ff5a5a'; c.fillRect(cx - 5, cy - 3, 3, 3); c.fillRect(cx + 2, cy - 3, 3, 3);
    c.fillStyle = '#fff'; c.fillRect(cx - 3, cy + 3, 2, 3); c.fillRect(cx + 1, cy + 3, 2, 3);
  }
}
function drawBoss(c, b) {
  if (b.st === 'gone') return;
  if (b.st === 'sleep') { c.globalAlpha = 0.55; }
  const cx = b.x + b.w / 2, by = b.y + b.h, blink = (b.st === 'hit' || b.inv > 0) && Math.floor(S.t * 20) % 2 === 0;
  if (blink) return;
  const sq = b.st === 'dizzy' ? 1 + Math.sin(S.t * 14) * 0.04 : 1 + Math.sin(b.ph) * 0.05;
  glow(c, cx, by - 28, 80, '#9a3dff', 0.35);
  c.fillStyle = b.st === 'dizzy' ? '#6f5a99' : '#35204f';
  c.beginPath(); c.ellipse(cx, by, 34 * (2 - sq), 56 * sq, 0, Math.PI, TAU); c.fill(); c.fillRect(cx - 34 * (2 - sq), by - 6, 68 * (2 - sq), 6);
  c.fillStyle = '#5a3a86'; c.beginPath(); c.moveTo(cx - 28, by - 44); c.lineTo(cx - 36, by - 66); c.lineTo(cx - 16, by - 50); c.fill(); c.beginPath(); c.moveTo(cx + 28, by - 44); c.lineTo(cx + 36, by - 66); c.lineTo(cx + 16, by - 50); c.fill();
  const eye = b.st === 'dizzy' ? '#ffe36b' : '#ff3b5c';
  c.fillStyle = eye; c.beginPath(); c.ellipse(cx - 12, by - 32, 7, 8, 0, 0, TAU); c.ellipse(cx + 12, by - 32, 7, 8, 0, 0, TAU); c.fill();
  c.fillStyle = '#140a22'; c.fillRect(cx - 13, by - 33, 4, 6); c.fillRect(cx + 9, by - 33, 4, 6);
  c.strokeStyle = '#140a22'; c.lineWidth = 4; c.beginPath(); c.moveTo(cx - 22, by - 46); c.lineTo(cx - 4, by - 38); c.moveTo(cx + 22, by - 46); c.lineTo(cx + 4, by - 38); c.stroke();
  c.fillStyle = '#140a22'; c.fillRect(cx - 14, by - 14, 28, 5); c.fillStyle = '#fff'; for (let i = 0; i < 5; i++) c.fillRect(cx - 12 + i * 5.5, by - 14, 3, 4);
  if (b.st === 'dizzy') { for (let i = 0; i < 3; i++) { const a = S.t * 5 + i * 2.1; c.fillStyle = '#ffe36b'; c.fillRect(cx + Math.cos(a) * 28 - 3, by - 78 + Math.sin(a) * 6, 6, 6); } }
  c.globalAlpha = 1;
}
function drawWorld(c) {
  const th = TH[LV.theme], cx = Math.round(S.cam.x), p = S.p;
  const sh = S.cam.shake, sx = sh ? rnd(-1, 1) * sh * 0.4 : 0, sy = sh ? rnd(-1, 1) * sh * 0.4 : 0;
  c.save(); c.translate(-cx + sx, sy);
  const x0 = Math.max(0, Math.floor(cx / T)), x1 = Math.min(LV.cols - 1, x0 + 31);
  for (let ty = 0; ty < ROWS; ty++) for (let tx = x0; tx <= x1; tx++) { const t = S.tiles[ty * LV.cols + tx]; if (t) drawTile(c, t, tx, ty, th); }
  for (const s of LV.signs) if (s.x > cx - 200 && s.x < cx + W + 100) {
    c.fillStyle = '#7a5230'; c.fillRect(s.x + 14, s.y + 10, 4, 22);
    c.font = 'bold 13px ' + FONT; const w = c.measureText(s.text).width + 16;
    c.fillStyle = '#c99a5b'; c.fillRect(s.x + 16 - w / 2, s.y - 14, w, 26); c.strokeStyle = '#7a5230'; c.lineWidth = 2; c.strokeRect(s.x + 16 - w / 2, s.y - 14, w, 26);
    txt(s.text, s.x + 16, s.y - 1, 13, '#3b2410', 'center');
  }
  for (const k of S.cps) drawCheckpoint(c, k);
  if (S.goalOn) drawGoal(c);
  for (const j of S.jets) {
    c.fillStyle = '#3a3430'; c.fillRect(j.x + 6, j.y - 5, 20, 5);
    if (j.warn) { c.globalAlpha = 0.5 + 0.5 * Math.sin(S.t * 40); c.fillStyle = '#ffd04d'; c.fillRect(j.x + 12, j.y - 14, 8, 8); c.globalAlpha = 1; }
    if (j.on) {
      const h = 92; const g = c.createLinearGradient(0, j.y, 0, j.y - h); g.addColorStop(0, '#fff3a8'); g.addColorStop(0.35, '#ffb02e'); g.addColorStop(1, 'rgba(255,60,20,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(j.x + 8, j.y - 5); c.quadraticCurveTo(j.x + 16 + Math.sin(S.t * 30) * 4, j.y - h, j.x + 24, j.y - 5); c.fill(); glow(c, j.x + 16, j.y - 40, 50, '#ff8a2a', 0.4);
    }
  }
  for (const pl of S.plats) {
    if (pl.st === 'gone') continue;
    const sk = pl.st === 'shake' ? Math.sin(S.t * 60) * 2 : 0, n = pl.w / T;
    for (let i = 0; i < n; i++) {
      c.fillStyle = pl.k === 'mp' ? '#d6a15b' : '#b9b3a6'; c.fillRect(pl.x + i * T + sk, pl.y, T - 1, 14);
      c.fillStyle = pl.k === 'mp' ? '#a77a3c' : '#8c867a'; c.fillRect(pl.x + i * T + sk, pl.y + 10, T - 1, 4); c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(pl.x + i * T + sk, pl.y, T - 1, 2);
    }
    if (pl.k === 'mp') { c.fillStyle = '#5a4126'; c.fillRect(pl.x + 4, pl.y + 14, 4, 4); c.fillRect(pl.x + pl.w - 8, pl.y + 14, 4, 4); }
  }
  for (const it of S.items) {
    if (it.got) continue; const bob = Math.sin(it.ph) * 3;
    if (it.k === 'bean') { glow(c, it.x, it.y + bob, 14, '#ffd24d', 0.25); bean(c, it.x, it.y + bob, 6, Math.sin(it.ph * 0.5) * 0.4); }
    else if (it.k === 'coffee') {
      glow(c, it.x, it.y + bob, 28, '#ffb347', 0.5); c.fillStyle = '#fff'; c.fillRect(it.x - 10, it.y - 8 + bob, 20, 16); c.fillStyle = '#6b3f1d'; c.fillRect(it.x - 8, it.y - 7 + bob, 16, 5);
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(it.x + 12, it.y + bob, 5, -1.3, 1.3); c.stroke(); c.fillStyle = '#ddd'; c.fillRect(it.x - 13, it.y + 8 + bob, 26, 3);
    } else { glow(c, it.x, it.y + bob, 26, '#ff8fa3', 0.5); heart(c, it.x, it.y + bob, 12, '#ff5a7a'); }
  }
  for (const e of S.en) drawEnemy(c, e);
  if (S.boss) drawBoss(c, S.boss);
  for (const w of S.waves) { c.fillStyle = '#e0b0ff'; c.beginPath(); c.moveTo(w.x, w.y + w.h); c.lineTo(w.x + w.w / 2, w.y); c.lineTo(w.x + w.w, w.y + w.h); c.fill(); glow(c, w.x + w.w / 2, w.y + w.h / 2, 24, '#9a3dff', 0.5); }
  // player
  const blink = p.inv > 0 && S.sub === 'play' && Math.floor(S.t * 18) % 2 === 0;
  if (!blink) {
    const st = !p.on ? 'air' : Math.abs(p.vx) > 25 ? 'run' : 'idle';
    c.save();
    if (S.sub === 'dying') { c.translate(p.x + p.w / 2, p.y + p.h / 2); c.rotate(p.dt * 8); c.translate(-(p.x + p.w / 2), -(p.y + p.h / 2)); }
    drawLuca(c, p.x + p.w / 2, p.y + p.h + 1, { dir: p.dir, state: S.sub === 'win' ? 'air' : st, ph: p.ph, sx: p.sx, sy: p.sy, turbo: p.turbo > 0 });
    c.restore();
  }
  c.globalCompositeOperation = 'lighter';
  for (const q of S.parts) { c.globalAlpha = cl(q.life / q.max, 0, 1); c.fillStyle = q.col; c.beginPath(); c.arc(q.x, q.y, q.size, 0, TAU); c.fill(); }
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  for (const f of S.floats) txt(f.text, f.x, f.y, f.size, f.col, 'center', cl(f.life / f.max * 1.6, 0, 1), 'rgba(0,0,0,0.6)');
  c.restore();
  if (LV.theme === 'cave') {
    const g = c.createRadialGradient(p.x - cx + 10, p.y + 10, 120, p.x - cx + 10, p.y + 10, 420);
    g.addColorStop(0, 'rgba(8,4,20,0)'); g.addColorStop(1, 'rgba(8,4,20,0.6)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  }
  if (S.flash > 0) { c.fillStyle = 'rgba(255,80,80,' + (S.flash * 1.4).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
}

// ───────────────────────── drawing: HUD & screens ─────────────────────────
function drawHUD(c) {
  const p = S.p;
  for (let i = 0; i < 3; i++) heart(c, 30 + i * 30, 28, 11, i < p.hearts ? '#ff5a7a' : 'rgba(0,0,0,0.35)');
  bean(c, 24, 62, 6, 0.4); txt(String(S.beans) + ' / ' + S.totalBeans, 38, 62, 17, '#fff', 'left', 1, 'rgba(0,0,0,0.55)');
  drawLuca(c, 28, 104, { dir: 1, state: 'idle', ph: 0, sx: 0.6, sy: 0.6 }); txt('× ' + S.lives, 46, 92, 17, '#fff', 'left', 1, 'rgba(0,0,0,0.55)');
  if (p.turbo > 0) {
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(20, 112, 100, 8); c.fillStyle = '#ffb347'; c.fillRect(20, 112, 100 * p.turbo / 10, 8);
    txt('TURBO', 126, 116, 11, '#ffb347', 'left', 1, 'rgba(0,0,0,0.5)');
  }
  txt('MONDO ' + (S.lvl + 1) + ' · ' + LV.name.toUpperCase(), W / 2, 20, 14, '#fff', 'center', 0.9, 'rgba(0,0,0,0.55)');
  txt(String(S.score).padStart(7, '0'), W - 20, 22, 22, '#fff', 'right', 1, 'rgba(0,0,0,0.55)');
  txt(mmss(S.time), W - 20, 46, 15, '#e8f6ff', 'right', 0.9, 'rgba(0,0,0,0.5)');
  if (S.boss && S.arena && S.boss.st !== 'gone') {
    const b = S.boss; c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(W / 2 - 110, 40, 220, 14);
    for (let i = 0; i < 3; i++) { c.fillStyle = i < b.hp ? '#ff3b5c' : 'rgba(255,255,255,0.12)'; c.fillRect(W / 2 - 106 + i * 72, 43, 68, 8); }
    txt("L'OMBRA", W / 2, 66, 12, '#e0b0ff', 'center', 1, 'rgba(0,0,0,0.6)');
  }
  if (S.banner > 0 && S.sub === 'play') {
    const a = cl(S.banner / 0.6, 0, 1) * cl((2.6 - S.banner) / 0.3, 0, 1);
    if (S.arena) txt("L'OMBRA!", W / 2, H / 2 - 70, 54, '#ff3b5c', 'center', a, '#140a22');
    else { txt('MONDO ' + (S.lvl + 1), W / 2, H / 2 - 90, 24, '#fff', 'center', a, 'rgba(0,0,0,0.6)'); txt(LV.name, W / 2, H / 2 - 52, 46, '#fff', 'center', a, 'rgba(0,0,0,0.6)'); }
  }
  if (touch.on) drawTouch(c);
}
function panel(c, w, h) {
  c.fillStyle = 'rgba(10,8,24,0.78)'; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect((W - w) / 2, (H - h) / 2, w, h); c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2; c.strokeRect((W - w) / 2, (H - h) / 2, w, h);
}
const prompt = (c, s, y) => txt(s, W / 2, y, 19, '#ffd24d', 'center', 0.6 + 0.4 * Math.sin(S.t * 4), 'rgba(0,0,0,0.5)');
function drawTitle(c) {
  drawBG(c, 'grass', S.t * 40);
  c.fillStyle = '#5cc34c'; c.fillRect(0, 440, W, 10); c.fillStyle = '#3f9d3a'; c.fillRect(0, 450, W, 4); c.fillStyle = '#8a5a2c'; c.fillRect(0, 454, W, H);
  const x = ((S.t * 150) % (W + 120)) - 60;
  drawLuca(c, x, 440, { dir: 1, state: 'run', ph: S.t * 9, sx: 1.7, sy: 1.7 });
  const bob = Math.sin(S.t * 2) * 4;
  txt('LUCA', W / 2, 130 + bob, 112, '#ff8a2a', 'center', 1, '#3b1c05');
  txt('e la Moka Rubata', W / 2, 212 + bob, 34, '#fff', 'center', 1, '#3b1c05');
  prompt(c, touch.on ? 'TOCCA PER INIZIARE' : 'PREMI INVIO O CLICCA PER INIZIARE', 300);
  txt(touch.on ? 'Sei fuori con la moka! Attraversa 6 mondi per riprenderla.' : 'Qualcuno ha rubato la tua moka. Attraversa 6 mondi per riprenderla!', W / 2, 346, 16, '#fff', 'center', 0.9, 'rgba(0,0,0,0.55)');
  txt(save.unlocked > 1 ? 'Livelli sbloccati: ' + save.unlocked + ' / ' + LEVELS.length : 'M = audio', W / 2, 500, 14, '#fff', 'center', 0.8, 'rgba(0,0,0,0.5)');
}
function cardRect(i) { return { x: 60 + (i % 3) * 290, y: 150 + Math.floor(i / 3) * 190, w: 260, h: 165 }; }
function drawSelect(c) {
  drawBG(c, 'grass', S.t * 20); c.fillStyle = 'rgba(10,8,24,0.55)'; c.fillRect(0, 0, W, H);
  txt('SCEGLI IL MONDO', W / 2, 70, 40, '#fff', 'center', 1, '#3b1c05');
  txt(touch.on ? 'Tocca un mondo per giocare' : '← → ↑ ↓ per scegliere · INVIO per giocare', W / 2, 108, 15, '#cfe8ff', 'center', 1);
  LEVELS.forEach((L, i) => {
    const r = cardRect(i), th = TH[L.theme], open = i < save.unlocked, sel = i === S.sel;
    const g = c.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    c.globalAlpha = open ? 1 : 0.4; c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
    c.fillStyle = th.top; c.fillRect(r.x, r.y + r.h - 40, r.w, 40); c.fillStyle = th.body; c.fillRect(r.x, r.y + r.h - 30, r.w, 30); c.globalAlpha = 1;
    c.lineWidth = sel ? 5 : 2; c.strokeStyle = sel ? '#ffd24d' : 'rgba(255,255,255,0.5)'; c.strokeRect(r.x, r.y, r.w, r.h);
    txt(String(i + 1), r.x + 18, r.y + 26, 28, '#fff', 'left', 1, 'rgba(0,0,0,0.6)');
    txt(L.name, r.x + r.w / 2, r.y + 74, 21, '#fff', 'center', 1, 'rgba(0,0,0,0.65)');
    if (open) {
      const b = save.best[i];
      if (b) { bean(c, r.x + 30, r.y + r.h - 18, 5, 0.4); txt(b.b + '/' + (b.tot || '?'), r.x + 42, r.y + r.h - 18, 15, '#fff', 'left', 1, 'rgba(0,0,0,0.6)'); txt(mmss(b.t), r.x + r.w - 16, r.y + r.h - 18, 15, '#fff', 'right', 1, 'rgba(0,0,0,0.6)'); }
      else txt('NUOVO', r.x + r.w / 2, r.y + r.h - 18, 15, '#fff', 'center', 1, 'rgba(0,0,0,0.6)');
      if (sel) drawLuca(c, r.x + r.w / 2, r.y + 130 + Math.abs(Math.sin(S.t * 6)) * -8, { dir: 1, state: 'idle', ph: 0, sx: 1.2, sy: 1.2 });
    } else { c.fillStyle = '#fff'; c.fillRect(r.x + r.w / 2 - 12, r.y + 104, 24, 20); c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.arc(r.x + r.w / 2, r.y + 104, 9, Math.PI, TAU); c.stroke(); }
  });
}
function drawClear(c) {
  panel(c, 520, 330);
  txt('LIVELLO COMPLETATO!', W / 2, H / 2 - 120, 34, '#ffd24d', 'center', 1, '#3b1c05');
  txt(LV.name, W / 2, H / 2 - 84, 18, '#cfe8ff', 'center');
  const rows = [['Chicchi', S.beans + ' / ' + S.totalBeans], ['Tempo', mmss(S.time)], ['Bonus cuori', '+' + S.info.heartB], ['Bonus tempo', '+' + S.info.timeB]];
  rows.forEach((r, i) => { txt(r[0], W / 2 - 190, H / 2 - 40 + i * 30, 20, '#fff', 'left'); txt(r[1], W / 2 + 190, H / 2 - 40 + i * 30, 20, '#fff', 'right'); });
  txt('PUNTEGGIO', W / 2 - 190, H / 2 + 92, 24, '#ffd24d', 'left'); txt(String(S.score), W / 2 + 190, H / 2 + 92, 28, '#ffd24d', 'right');
  prompt(c, touch.on ? 'TOCCA PER CONTINUARE' : 'INVIO PER CONTINUARE', H / 2 + 138);
}
function drawOver(c) {
  panel(c, 460, 240);
  txt('GAME OVER', W / 2, H / 2 - 56, 56, '#ff6b6b', 'center', 1, '#2a0808');
  txt('Punteggio ' + S.score, W / 2, H / 2 + 8, 24, '#fff', 'center');
  prompt(c, touch.on ? 'TOCCA PER RIPROVARE' : 'INVIO PER RIPROVARE IL LIVELLO', H / 2 + 66);
}
function drawEnd(c) {
  drawBG(c, 'castle', S.t * 30); c.fillStyle = 'rgba(10,8,24,0.45)'; c.fillRect(0, 0, W, H);
  c.save(); c.translate(W / 2 - LV.goalPos.x * T - 16, 300 - (LV.goalPos.y + 1) * T); drawGoal(c); c.restore();
  txt('HAI RIPRESO LA MOKA!', W / 2, 110, 52, '#ffd24d', 'center', 1, '#3b1c05');
  txt('Luca può finalmente farsi il caffè.', W / 2, 170, 22, '#fff', 'center', 1, 'rgba(0,0,0,0.6)');
  txt('Punteggio finale ' + S.score, W / 2, 230, 28, '#fff', 'center', 1, 'rgba(0,0,0,0.6)');
  drawLuca(c, W / 2, 440, { dir: 1, state: 'idle', ph: 0, sx: 2.2, sy: 2.2 + Math.abs(Math.sin(S.t * 5)) * 0.1 });
  prompt(c, touch.on ? 'TOCCA PER TORNARE AL MENU' : 'INVIO PER TORNARE AL MENU', 500);
}
function drawPaused(c) { panel(c, 360, 170); txt('PAUSA', W / 2, H / 2 - 24, 48, '#fff', 'center', 1, '#3b1c05'); prompt(c, touch.on ? 'TOCCA PER RIPRENDERE' : 'P O INVIO PER RIPRENDERE', H / 2 + 40); }

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, offX * dpr, offY * dpr);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  const m = S.mode;
  if (m === 'title') drawTitle(ctx);
  else if (m === 'select') drawSelect(ctx);
  else if (m === 'end') drawEnd(ctx);
  else {
    drawBG(ctx, LV.theme, S.cam.x); drawWorld(ctx); drawHUD(ctx);
    if (m === 'clear') drawClear(ctx); else if (m === 'over') drawOver(ctx); else if (m === 'paused') drawPaused(ctx);
  }
  ctx.restore();
}

// ───────────────────────── input ─────────────────────────
const keys = {}, touch = { on: false, l: false, r: false, j: false, run: false, ids: {} };
let jpFlag = false;
const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyK'];
function getInput() {
  const k = keys, jp = jpFlag; jpFlag = false;
  return {
    l: !!(k.ArrowLeft || k.KeyA || touch.l), r: !!(k.ArrowRight || k.KeyD || touch.r),
    j: !!(JUMP_KEYS.some(x => k[x]) || touch.j), jp, run: !!(k.ShiftLeft || k.ShiftRight || k.KeyX || k.KeyJ || touch.run), down: !!(k.ArrowDown || k.KeyS),
  };
}
function confirm() {
  audio();
  const m = S.mode;
  if (m === 'title') { S.mode = 'select'; S.sel = Math.min(save.unlocked - 1, LEVELS.length - 1); setMusic('title'); sfx.select(); }
  else if (m === 'select') { if (S.sel < save.unlocked) startLevel(S.sel, true); }
  else if (m === 'paused') S.mode = 'play';
  else if (m === 'clear') { if (S.info.last) { S.mode = 'end'; setMusic('title'); } else { startLevel(S.lvl + 1, false); } }
  else if (m === 'over') startLevel(S.lvl, true);
  else if (m === 'end') { S.mode = 'title'; }
}
function pause() { if (S.mode === 'play') S.mode = 'paused'; else if (S.mode === 'paused') S.mode = 'play'; }
function toggleMute() { muted = !muted; try { localStorage.setItem('luca.mute', muted ? '1' : '0'); } catch (e) {} if (!muted) tone(660, 0.1, 'triangle', 0.07); }
function menuMove(dx, dy) {
  if (S.mode !== 'select') return;
  let s = S.sel + dx + dy * 3; if (s >= 0 && s < LEVELS.length) { S.sel = s; sfx.select(); }
}

window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true; audio();
  if (JUMP_KEYS.includes(e.code) && S.mode === 'play') jpFlag = true;
  if (e.code === 'Enter' || (e.code === 'Space' && S.mode !== 'play')) confirm();
  else if (e.code === 'KeyP' || e.code === 'Escape') { if (S.mode === 'select') S.mode = 'title'; else pause(); }
  else if (e.code === 'KeyM') toggleMute();
  else if (e.code === 'KeyR' && S.mode === 'play') { S.lives = Math.max(S.lives, 1); startLevel(S.lvl, false); }
  else if (S.mode === 'select') { if (e.code === 'ArrowLeft') menuMove(-1, 0); else if (e.code === 'ArrowRight') menuMove(1, 0); else if (e.code === 'ArrowUp') menuMove(0, -1); else if (e.code === 'ArrowDown') menuMove(0, 1); }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

const TB = { left: { x: 90, y: H - 80, r: 56 }, right: { x: 225, y: H - 80, r: 56 }, run: { x: W - 215, y: H - 70, r: 46 }, jump: { x: W - 90, y: H - 95, r: 64 } };
function touchHit(p) { for (const k in TB) if (Math.hypot(p.x - TB[k].x, p.y - TB[k].y) < TB[k].r + 14) return k; return null; }
function setTouch(id, name) { const old = touch.ids[id]; if (old) touch[old === 'left' ? 'l' : old === 'right' ? 'r' : old] = false; if (name) { touch.ids[id] = name; touch[name === 'left' ? 'l' : name === 'right' ? 'r' : name] = true; } else delete touch.ids[id]; }
function drawTouch(c) {
  const labels = { left: '◀', right: '▶', run: 'CORRI', jump: 'SALTA' };
  for (const k in TB) {
    const b = TB[k], on = touch[k === 'left' ? 'l' : k === 'right' ? 'r' : k];
    c.globalAlpha = on ? 0.55 : 0.28; c.fillStyle = '#fff'; c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill(); c.globalAlpha = 0.9;
    txt(labels[k], b.x, b.y, k === 'left' || k === 'right' ? 30 : 16, '#1a1030', 'center'); c.globalAlpha = 1;
  }
}
function toWorld(e) { return { x: (e.clientX - offX) / scale, y: (e.clientY - offY) / scale }; }
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  e.preventDefault(); audio();
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  const p = toWorld(e);
  if (e.pointerType === 'touch') touch.on = true;
  if (S.mode === 'play') {
    if (e.pointerType === 'touch') { const n = touchHit(p); if (n) { setTouch(e.pointerId, n); if (n === 'jump') jpFlag = true; } }
    return;
  }
  if (S.mode === 'select') {
    for (let i = 0; i < LEVELS.length; i++) { const r = cardRect(i); if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) { S.sel = i; if (i < save.unlocked) { startLevel(i, true); } return; } }
    return;
  }
  confirm();
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch' && S.mode === 'play' && e.pointerId in touch.ids) { const n = touchHit(toWorld(e)); if (n !== touch.ids[e.pointerId]) { setTouch(e.pointerId, n); if (n === 'jump') jpFlag = true; } }
  else if (e.pointerType === 'mouse' && S.mode === 'select') { const p = toWorld(e); for (let i = 0; i < LEVELS.length; i++) { const r = cardRect(i); if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) S.sel = i; } }
});
const endPtr = e => { if (e.pointerId in touch.ids) setTouch(e.pointerId, null); };
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
window.addEventListener('blur', () => { if (S.mode === 'play') S.mode = 'paused'; for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'play') S.mode = 'paused'; });

// ───────────────────────── main loop ─────────────────────────
let acc = 0, last = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000 || 0.016); last = now;
  if (S.mode === 'play') {
    acc += dt; let n = 0;
    while (acc >= DT && n < 5) { step(getInput()); acc -= DT; n++; if (S.mode !== 'play') break; }
    if (n >= 5) acc = 0;
  } else { acc = 0; S.t += dt; fxUpdate(); }
  musicTick(); render(); requestAnimationFrame(frame);
}
loadLevel(0); S.mode = 'title'; setMusic('title');
requestAnimationFrame(frame);

window.__luca = {
  get S() { return S; }, set S(v) { S = v; }, get LV() { return LV; }, LEVELS, step, loadLevel, startLevel, render, confirm, T, W, H,
  setLV(i) { LV = LEVELS[i]; }, save: () => save,
};
})();
