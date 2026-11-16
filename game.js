/* ECHO DRIFT — a one-ship arcade game played in the dark.
 * You can barely see. PING to light up the world, but every ping
 * wakes the hunters and sends them charging at where you were.
 * Zero dependencies: plain canvas + WebAudio.
 */
(() => {
'use strict';

// ───────────────────────── setup ─────────────────────────
const W = 960, H = 600, TAU = Math.PI * 2;
const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let scale = 1, offX = 0, offY = 0, dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vw = window.innerWidth, vh = window.innerHeight;
  canvas.width = Math.floor(vw * dpr);
  canvas.height = Math.floor(vh * dpr);
  canvas.style.width = vw + 'px';
  canvas.style.height = vh + 'px';
  scale = Math.min(vw / W, vh / H);
  offX = (vw - W * scale) / 2;
  offY = (vh - H * scale) / 2;
}
window.addEventListener('resize', resize);
resize();

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// pre-rendered grid, revealed only by pings and the ship's own light
const gridCanvas = document.createElement('canvas');
gridCanvas.width = W; gridCanvas.height = H;
(() => {
  const g = gridCanvas.getContext('2d');
  g.strokeStyle = 'rgba(94,242,255,0.55)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x <= W; x += 40) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
  for (let y = 0; y <= H; y += 40) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
  g.stroke();
  g.fillStyle = 'rgba(94,242,255,0.9)';
  for (let x = 0; x <= W; x += 40) for (let y = 0; y <= H; y += 40) g.fillRect(x - 1, y - 1, 3, 3);
})();

// ───────────────────────── tuning ─────────────────────────
const MAX_SPEED = 340;
const LIGHT_R = 88;          // ship's own light radius
const PING_COST = 24;
const PING_COOLDOWN = 0.35;
const PING_MAX_R = 470;
const PING_SPEED = 560;
const HEAR_R = 640;          // hunters within this range of a ping wake up
const CHAIN_WINDOW = 4.2;
const BLIND_AFTER = 4.0;     // seconds without pinging to earn the BLIND x2 bonus
const MAX_LIVES = 5;

// ───────────────────────── state ─────────────────────────
function loadHi() { try { return +localStorage.getItem('echodrift.hi') || 0; } catch (e) { return 0; } }
function saveHi(v) { try { localStorage.setItem('echodrift.hi', String(v)); } catch (e) {} }

const G = {
  mode: 'title',        // title | play | paused | over
  t: 0, overT: 0,
  ship: { x: W / 2, y: H / 2, vx: 0, vy: 0, ang: -Math.PI / 2, inv: 0 },
  lives: 3, score: 0, level: 1, collected: 0, need: 8, energy: 100, energyFlash: 0,
  chain: 0, chainT: 0, lastPing: -99,
  banner: 0, bannerText: '',
  shards: [], mines: [], hunters: [], pings: [], parts: [], floats: [],
  shake: 0, flash: 0, hi: loadHi(), newRecord: false, titlePing: 0.6, hitStop: 0,
};

const input = { keys: {}, tx: W / 2, ty: H / 2, usePointer: false, touch: false, steerId: null, pingId: null };

// ───────────────────────── audio ─────────────────────────
let ac = null, muted = false;
try { muted = localStorage.getItem('echodrift.mute') === '1'; } catch (e) {}
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(f, d, type, v, slideTo, delay) {
  if (muted) return;
  const a = audio(); if (!a) return;
  const t = a.currentTime + (delay || 0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(f, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v || 0.1, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + d + 0.03);
}
function noise(d, v) {
  if (muted) return;
  const a = audio(); if (!a) return;
  const n = Math.floor(a.sampleRate * d);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), g = a.createGain();
  s.buffer = buf; g.gain.value = v || 0.2;
  s.connect(g); g.connect(a.destination); s.start();
}
const sfx = {
  ping() { tone(980, 0.5, 'sine', 0.11, 420); tone(1960, 0.25, 'sine', 0.03, 900); },
  deny() { tone(150, 0.12, 'square', 0.05, 110); },
  shard(chain) { const b = 520 * Math.pow(1.0595, Math.min(chain, 12) * 2); tone(b, 0.12, 'triangle', 0.1); tone(b * 1.5, 0.18, 'triangle', 0.08, 0, 0.06); },
  hit() { noise(0.4, 0.28); tone(140, 0.45, 'sawtooth', 0.14, 40); },
  alert() { tone(70, 0.5, 'sawtooth', 0.09, 55); tone(72, 0.5, 'square', 0.04, 50, 0.02); },
  level() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, 0, i * 0.09)); },
  over() { [440, 349, 262, 175].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.09, f * 0.8, i * 0.2)); },
  start() { [392, 523, 659].forEach((f, i) => tone(f, 0.16, 'triangle', 0.09, 0, i * 0.07)); },
};

// ───────────────────────── world building ─────────────────────────
function randPos(minDist, margin) {
  margin = margin || 40;
  const s = G.ship;
  let x = 0, y = 0;
  for (let i = 0; i < 40; i++) {
    x = rand(margin, W - margin); y = rand(margin, H - margin);
    if (Math.hypot(x - s.x, y - s.y) >= minDist) break;
  }
  return { x, y };
}

function spawnShard() {
  const p = randPos(150, 44);
  G.shards.push({ x: p.x, y: p.y, rv: 0, ph: rand(0, TAU), born: 0 });
}
function spawnMine() {
  const p = randPos(240, 30), a = rand(0, TAU), sp = rand(38, 78) + G.level * 5;
  G.mines.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 13, rv: 0, rot: rand(0, TAU) });
}
function spawnHunter() {
  const p = randPos(340, 30), a = rand(0, TAU);
  G.hunters.push({ x: p.x, y: p.y, vx: Math.cos(a) * 26, vy: Math.sin(a) * 26, r: 15, rv: 0,
    state: 'sleep', tx: 0, ty: 0, timer: 0, spd: 175 + G.level * 9, ph: rand(0, TAU) });
}

function setupWave() {
  G.need = 6 + G.level * 2;
  G.collected = 0;
  G.shards.length = 0; G.mines.length = 0; G.hunters.length = 0; G.pings.length = 0;
  const mines = Math.min(3 + G.level * 2, 17);
  const hunters = G.level >= 2 ? Math.min(1 + Math.floor((G.level - 2) / 2), 4) : 0;
  for (let i = 0; i < mines; i++) spawnMine();
  for (let i = 0; i < hunters; i++) spawnHunter();
  const n = Math.min(5, G.need);
  for (let i = 0; i < n; i++) spawnShard();
  G.ship.inv = 1.5;
  G.banner = 2.2; G.bannerText = 'WAVE ' + G.level;
}

function startGame() {
  Object.assign(G.ship, { x: W / 2, y: H / 2, vx: 0, vy: 0, ang: -Math.PI / 2, inv: 0 });
  G.lives = 3; G.score = 0; G.level = 1; G.energy = 100; G.chain = 0; G.chainT = 0;
  G.lastPing = -99; G.parts.length = 0; G.floats.length = 0; G.newRecord = false;
  G.shake = 0; G.flash = 0; G.hitStop = 0; G.overT = 0;
  G.mode = 'play';
  input.tx = W / 2; input.ty = H / 2;
  setupWave();
  sfx.start();
}

// ───────────────────────── effects ─────────────────────────
function burst(x, y, n, color, spd, life, size) {
  for (let i = 0; i < n && G.parts.length < 500; i++) {
    const a = rand(0, TAU), s = rand(0.3, 1) * spd;
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rand(0.6, 1), max: life, size: size * rand(0.6, 1.2), color });
  }
}
function floater(x, y, text, color, size) {
  G.floats.push({ x, y, text, color, size: size || 16, life: 1.1, max: 1.1 });
}
function addPing(x, y) { G.pings.push({ x, y, r: 6 }); }

// ───────────────────────── gameplay ─────────────────────────
function doPing() {
  if (G.mode !== 'play') return;
  if (G.t - G.lastPing < PING_COOLDOWN) return;
  if (G.energy < PING_COST) { G.energyFlash = 0.45; sfx.deny(); return; }
  G.energy -= PING_COST;
  G.lastPing = G.t;
  const s = G.ship;
  addPing(s.x, s.y);
  for (const h of G.hunters) {
    if (Math.hypot(h.x - s.x, h.y - s.y) < HEAR_R) {
      if (h.state !== 'charge') sfx.alert();
      h.state = 'charge'; h.tx = s.x; h.ty = s.y; h.timer = 2.6;
    }
  }
  sfx.ping();
}

function hurt() {
  const s = G.ship;
  G.lives--; s.inv = 1.7; G.chain = 0; G.chainT = 0;
  G.shake = 16; G.flash = 0.35; G.hitStop = 0.07;
  burst(s.x, s.y, 36, '#ff4d5e', 340, 0.9, 3);
  burst(s.x, s.y, 14, '#ffffff', 220, 0.5, 2);
  sfx.hit();
  if (G.lives <= 0) {
    G.mode = 'over'; G.overT = 0;
    G.shake = 24;
    burst(s.x, s.y, 80, '#5ef2ff', 460, 1.4, 3);
    if (G.score > G.hi) { G.hi = G.score; G.newRecord = true; saveHi(G.hi); }
    sfx.over();
  }
}

function collect(sh, i) {
  G.shards.splice(i, 1);
  G.chain++; G.chainT = CHAIN_WINDOW;
  const mult = Math.min(8, G.chain);
  const blind = (G.t - G.lastPing) > BLIND_AFTER;
  const pts = 100 * mult * (blind ? 2 : 1);
  G.score += pts;
  G.energy = Math.min(100, G.energy + 13);
  G.collected++;
  burst(sh.x, sh.y, 18, '#ffd24d', 220, 0.6, 2.4);
  floater(sh.x, sh.y - 12, '+' + pts + (blind ? ' BLIND' : ''), blind ? '#ff4fd8' : '#ffd24d', blind ? 18 : 15);
  sfx.shard(G.chain);
  if (G.collected >= G.need) {
    const bonus = 300 * G.level;
    G.score += bonus;
    floater(G.ship.x, G.ship.y - 34, 'WAVE CLEAR +' + bonus, '#5ef2ff', 20);
    G.level++;
    if (G.level % 2 === 1 && G.lives < MAX_LIVES) { G.lives++; floater(G.ship.x, G.ship.y - 58, '+1 LIFE', '#ff7a8a', 18); }
    G.energy = 100;
    sfx.level();
    setupWave();
    return true;
  } else if (G.shards.length < Math.min(5, G.need - G.collected)) {
    spawnShard();
  }
  return false;
}

function steer(dt) {
  const s = G.ship, k = input.keys;
  let dx = 0, dy = 0;
  if (k.ArrowLeft || k.KeyA) dx -= 1;
  if (k.ArrowRight || k.KeyD) dx += 1;
  if (k.ArrowUp || k.KeyW) dy -= 1;
  if (k.ArrowDown || k.KeyS) dy += 1;
  let dvx = 0, dvy = 0;
  if (dx || dy) {
    const m = Math.hypot(dx, dy);
    dvx = dx / m * MAX_SPEED; dvy = dy / m * MAX_SPEED;
    input.usePointer = false;
  } else if (input.usePointer) {
    const ex = input.tx - s.x, ey = input.ty - s.y, d = Math.hypot(ex, ey);
    if (d > 3) { const sp = Math.min(MAX_SPEED, d * 7); dvx = ex / d * sp; dvy = ey / d * sp; }
  }
  const f = 1 - Math.exp(-dt * 9);
  s.vx += (dvx - s.vx) * f; s.vy += (dvy - s.vy) * f;
  s.x = clamp(s.x + s.vx * dt, 12, W - 12);
  s.y = clamp(s.y + s.vy * dt, 12, H - 12);
  if (Math.hypot(s.vx, s.vy) > 25) s.ang = Math.atan2(s.vy, s.vx);
  // engine trail
  if (Math.hypot(s.vx, s.vy) > 60 && G.parts.length < 500 && Math.random() < 0.7) {
    G.parts.push({ x: s.x - Math.cos(s.ang) * 8, y: s.y - Math.sin(s.ang) * 8, vx: -s.vx * 0.1 + rand(-12, 12), vy: -s.vy * 0.1 + rand(-12, 12),
      life: 0.45, max: 0.45, size: 2, color: '#5ef2ff' });
  }
}

function reveal(e, dx, dy) {
  // light around the ship
  const d = Math.hypot(dx, dy);
  if (d < LIGHT_R) e.rv = Math.max(e.rv, clamp(1.15 - d / LIGHT_R, 0, 1));
  // pings
  for (const p of G.pings) {
    const pd = Math.hypot(e.x - p.x, e.y - p.y);
    if (Math.abs(pd - p.r) < 30) e.rv = 1;
  }
}

function updateWorld(dt) {
  const s = G.ship;
  // timers
  if (G.chainT > 0) { G.chainT -= dt; if (G.chainT <= 0) G.chain = 0; }
  if (s.inv > 0) s.inv -= dt;
  G.energy = Math.min(100, G.energy + 6 * dt);
  if (G.energyFlash > 0) G.energyFlash -= dt;
  if (G.banner > 0) G.banner -= dt;

  steer(dt);

  // shards (with a gentle magnet)
  for (let i = G.shards.length - 1; i >= 0; i--) {
    const sh = G.shards[i];
    sh.ph += dt * 3; sh.born += dt;
    const dx = s.x - sh.x, dy = s.y - sh.y, d = Math.hypot(dx, dy);
    if (d < 52 && d > 1) { const pull = (1 - d / 52) * 160; sh.x += dx / d * pull * dt; sh.y += dy / d * pull * dt; }
    sh.rv = Math.max(0, sh.rv - dt * 0.7);
    reveal(sh, sh.x - s.x, sh.y - s.y);
    if (d < 17 && collect(sh, i)) break; // wave rebuilt: stop iterating the old list
  }

  // mines
  for (const m of G.mines) {
    m.x += m.vx * dt; m.y += m.vy * dt; m.rot += dt * 1.4;
    if (m.x < m.r) { m.x = m.r; m.vx = Math.abs(m.vx); }
    if (m.x > W - m.r) { m.x = W - m.r; m.vx = -Math.abs(m.vx); }
    if (m.y < m.r) { m.y = m.r; m.vy = Math.abs(m.vy); }
    if (m.y > H - m.r) { m.y = H - m.r; m.vy = -Math.abs(m.vy); }
    m.rv = Math.max(0, m.rv - dt * 0.7);
    reveal(m, m.x - s.x, m.y - s.y);
    if (G.mode === 'play' && s.inv <= 0 && Math.hypot(m.x - s.x, m.y - s.y) < m.r + 8) hurt();
  }

  // hunters
  for (const h of G.hunters) {
    h.ph += dt * 6;
    if (h.state === 'charge') {
      const ex = h.tx - h.x, ey = h.ty - h.y, d = Math.hypot(ex, ey);
      h.timer -= dt;
      if (d < 18 || h.timer <= 0) { h.state = 'search'; h.timer = 1.3; h.vx = h.vy = 0; }
      else { h.x += ex / d * h.spd * dt; h.y += ey / d * h.spd * dt; h.rv = Math.max(h.rv, 0.55); }
    } else if (h.state === 'search') {
      h.timer -= dt;
      if (h.timer <= 0) { h.state = 'sleep'; const a = rand(0, TAU); h.vx = Math.cos(a) * 26; h.vy = Math.sin(a) * 26; }
    } else {
      h.x += h.vx * dt; h.y += h.vy * dt;
      if (h.x < h.r || h.x > W - h.r) h.vx *= -1;
      if (h.y < h.r || h.y > H - h.r) h.vy *= -1;
      h.x = clamp(h.x, h.r, W - h.r); h.y = clamp(h.y, h.r, H - h.r);
    }
    h.rv = Math.max(0, h.rv - dt * 0.7);
    reveal(h, h.x - s.x, h.y - s.y);
    if (G.mode === 'play' && s.inv <= 0 && Math.hypot(h.x - s.x, h.y - s.y) < h.r + 8) hurt();
  }
}

function updateCommon(dt) {
  G.t += dt;
  for (let i = G.pings.length - 1; i >= 0; i--) {
    const p = G.pings[i]; p.r += PING_SPEED * dt;
    if (p.r > PING_MAX_R) G.pings.splice(i, 1);
  }
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i];
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 2.2 * dt; p.vy *= 1 - 2.2 * dt;
    if (p.life <= 0) G.parts.splice(i, 1);
  }
  for (let i = G.floats.length - 1; i >= 0; i--) {
    const f = G.floats[i]; f.life -= dt; f.y -= 28 * dt;
    if (f.life <= 0) G.floats.splice(i, 1);
  }
  G.shake = Math.max(0, G.shake - dt * 40);
  G.flash = Math.max(0, G.flash - dt);
}

function update(dt) {
  if (G.hitStop > 0) { G.hitStop -= dt; return; }
  updateCommon(dt);
  if (G.mode === 'play') {
    updateWorld(dt);
  } else if (G.mode === 'title') {
    G.titlePing -= dt;
    if (G.titlePing <= 0) { G.titlePing = rand(1.6, 2.6); addPing(rand(120, W - 120), rand(100, H - 100)); }
  } else if (G.mode === 'over') {
    G.overT += dt;
  }
}

// ───────────────────────── rendering ─────────────────────────
function txt(s, x, y, size, color, align, sp, alpha) {
  ctx.font = 'bold ' + size + 'px ' + FONT;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  if (!sp) {
    ctx.textAlign = align || 'left';
    ctx.fillText(s, x, y);
  } else {
    const chars = Array.from(s);
    const ws = chars.map(c => ctx.measureText(c).width + sp);
    const total = ws.reduce((a, b) => a + b, 0) - sp;
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.textAlign = 'left';
    chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += ws[i]; });
  }
  ctx.globalAlpha = 1;
}

function glow(x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawGridReveals() {
  // faint ambient grid
  ctx.globalAlpha = 0.035; ctx.drawImage(gridCanvas, 0, 0); ctx.globalAlpha = 1;
  // ship light
  if (G.mode === 'play' || G.mode === 'paused' || G.mode === 'over') {
    const s = G.ship;
    ctx.save(); ctx.beginPath(); ctx.arc(s.x, s.y, LIGHT_R + 40, 0, TAU); ctx.clip();
    ctx.globalAlpha = 0.28; ctx.drawImage(gridCanvas, 0, 0); ctx.restore(); ctx.globalAlpha = 1;
  }
  // ping bands
  for (const p of G.pings) {
    const outer = p.r + 12, inner = Math.max(0, p.r - 110), a = (1 - p.r / PING_MAX_R);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, outer, 0, TAU);
    ctx.moveTo(p.x + inner, p.y); ctx.arc(p.x, p.y, inner, 0, TAU);
    ctx.clip('evenodd');
    ctx.globalAlpha = a * 0.75; ctx.drawImage(gridCanvas, 0, 0);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const p of G.pings) {
    const a = 1 - p.r / PING_MAX_R;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(94,242,255,' + (a * 0.9).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(180,250,255,' + (a * 0.5).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.r - 9), 0, TAU); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawShard(sh) {
  const base = 0.22 + 0.12 * Math.sin(sh.ph);
  const a = Math.max(base, sh.rv);
  const pop = Math.min(1, sh.born * 4);
  ctx.save(); ctx.translate(sh.x, sh.y); ctx.rotate(sh.ph * 0.4);
  ctx.globalCompositeOperation = 'lighter';
  glow(0, 0, 22 + sh.rv * 10, '#ffd24d', a * 0.45);
  ctx.globalAlpha = a; ctx.fillStyle = '#ffe58a';
  const r = 7 * pop;
  ctx.beginPath(); ctx.moveTo(0, -r * 1.3); ctx.lineTo(r, 0); ctx.lineTo(0, r * 1.3); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawMine(m) {
  if (m.rv <= 0.01) return;
  ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot);
  ctx.globalAlpha = m.rv;
  ctx.globalCompositeOperation = 'lighter';
  glow(0, 0, 30, '#ff4d5e', 0.35);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#ff6577'; ctx.fillStyle = '#2a0a10'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU, r = i % 2 ? m.r - 3 : m.r + 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff4d5e'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;
}

function drawHunter(h) {
  const eyeA = h.state === 'charge' ? 1 : h.state === 'search' ? 0.5 + 0.3 * Math.sin(h.ph) : 0;
  const a = Math.max(h.rv, eyeA * 0.9);
  if (a <= 0.01) return;
  const ang = h.state === 'charge' ? Math.atan2(h.ty - h.y, h.tx - h.x) : Math.atan2(h.vy || 0.001, h.vx || 0.001);
  ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(ang);
  // body
  ctx.globalAlpha = h.rv;
  if (h.rv > 0.01) {
    ctx.fillStyle = '#1b0f2c'; ctx.strokeStyle = '#b06bff'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(h.r + 4, 0); ctx.lineTo(-h.r * 0.6, h.r); ctx.lineTo(-h.r * 0.2, 0); ctx.lineTo(-h.r * 0.6, -h.r); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  // eyes
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
  for (const sgn of [-1, 1]) {
    glow(h.r * 0.35, sgn * 5, 14, '#ff2a3d', Math.max(eyeA, h.rv * 0.6));
    ctx.fillStyle = '#ff5a6a'; ctx.globalAlpha = Math.max(eyeA, h.rv * 0.8);
    ctx.beginPath(); ctx.arc(h.r * 0.35, sgn * 5, 2.4, 0, TAU); ctx.fill();
  }
  ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawShip() {
  const s = G.ship;
  if (G.mode === 'over') return;
  const blink = s.inv > 0 && Math.floor(G.t * 18) % 2 === 0;
  ctx.globalCompositeOperation = 'lighter';
  glow(s.x, s.y, LIGHT_R, '#5ef2ff', 0.2);
  ctx.globalCompositeOperation = 'source-over';
  if (blink) return;
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.ang);
  ctx.fillStyle = '#0b1b24'; ctx.strokeStyle = '#8ff7ff'; ctx.lineWidth = 2;
  ctx.shadowColor = '#5ef2ff'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, 8); ctx.lineTo(-4, 0); ctx.lineTo(-8, -8); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  ctx.globalCompositeOperation = 'lighter';
  for (const p of G.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a; ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawFloaters() {
  for (const f of G.floats) txt(f.text, f.x, f.y, f.size, f.color, 'center', 0, clamp(f.life / f.max * 1.6, 0, 1));
}

function drawHUD() {
  const mult = Math.min(8, G.chain);
  txt('SCORE', 20, 22, 11, '#5f8794', 'left', 3);
  txt(String(G.score).padStart(7, '0'), 20, 44, 26, '#e6fbff', 'left');
  txt('BEST ' + String(Math.max(G.hi, G.score)).padStart(7, '0'), 20, 66, 11, '#5f8794', 'left', 1);

  txt('WAVE ' + G.level, W / 2, 22, 13, '#5ef2ff', 'center', 4);
  // shard progress pips
  const n = G.need, pw = 14, gap = 5, total = n * (pw + gap) - gap;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i < G.collected ? '#ffd24d' : 'rgba(255,210,77,0.18)';
    ctx.fillRect(W / 2 - total / 2 + i * (pw + gap), 36, pw, 6);
  }

  // lives
  for (let i = 0; i < MAX_LIVES; i++) {
    const x = W - 28 - i * 26, y = 26;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2);
    ctx.globalAlpha = i < G.lives ? 1 : 0.14;
    ctx.fillStyle = i < G.lives ? '#5ef2ff' : '#5f8794';
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, 6); ctx.lineTo(-3, 0); ctx.lineTo(-6, -6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // energy
  const ex = 20, ey = H - 30, ew = 190, eh = 8;
  const flash = G.energyFlash > 0 && Math.floor(G.t * 20) % 2 === 0;
  txt('PING ENERGY', ex, ey - 12, 10, flash ? '#ff4d5e' : '#5f8794', 'left', 2);
  ctx.fillStyle = 'rgba(94,242,255,0.12)'; ctx.fillRect(ex, ey, ew, eh);
  ctx.fillStyle = G.energy < PING_COST ? '#ff4d5e' : '#5ef2ff'; ctx.fillRect(ex, ey, ew * G.energy / 100, eh);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(ex + ew * PING_COST / 100 - 1, ey - 2, 2, eh + 4);

  // chain / blind
  if (G.chain >= 2) {
    txt('x' + mult + ' CHAIN', W - 20, H - 44, 20, '#ffd24d', 'right');
    ctx.fillStyle = 'rgba(255,210,77,0.15)'; ctx.fillRect(W - 20 - 120, H - 28, 120, 5);
    ctx.fillStyle = '#ffd24d'; ctx.fillRect(W - 20 - 120, H - 28, 120 * clamp(G.chainT / CHAIN_WINDOW, 0, 1), 5);
  }
  const quiet = G.t - G.lastPing;
  if (quiet > BLIND_AFTER && G.mode === 'play') {
    txt('BLIND BONUS x2', W / 2, H - 22, 12, '#ff4fd8', 'center', 3, 0.55 + 0.4 * Math.sin(G.t * 5));
  }

  // wave banner
  if (G.banner > 0 && G.mode === 'play') {
    const a = clamp(G.banner / 0.6, 0, 1) * clamp((2.2 - G.banner) / 0.25, 0, 1);
    txt(G.bannerText, W / 2, H / 2 - 90, 44, '#e6fbff', 'center', 10, a);
    if (G.level === 1) txt('COLLECT THE SHARDS. AVOID THE MINES.', W / 2, H / 2 - 52, 13, '#8ff7ff', 'center', 3, a);
    if (G.level === 2) txt('SOMETHING IS LISTENING...', W / 2, H / 2 - 52, 13, '#ff6577', 'center', 3, a);
  }

  // touch ping button
  if (input.touch) {
    const bx = W - 90, by = H - 96, r = 54, ready = G.energy >= PING_COST;
    ctx.globalAlpha = ready ? 0.9 : 0.35;
    ctx.strokeStyle = '#5ef2ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(bx, by, r - 9, -Math.PI / 2, -Math.PI / 2 + TAU * G.energy / 100); ctx.stroke();
    ctx.globalAlpha = 1;
    txt('PING', bx, by, 16, '#e6fbff', 'center', 2);
  }
}

function drawTitle() {
  const bob = Math.sin(G.t * 1.6) * 4;
  ctx.globalCompositeOperation = 'lighter';
  glow(W / 2, H / 2 - 70, 260, '#5ef2ff', 0.13);
  ctx.globalCompositeOperation = 'source-over';
  txt('ECHO DRIFT', W / 2, H / 2 - 82 + bob, 66, '#e6fbff', 'center', 14);
  txt('PLAY IN THE DARK. PING TO SEE. DON\'T WAKE THE HUNTERS.', W / 2, H / 2 - 28 + bob, 13, '#5ef2ff', 'center', 3);
  const lines = input.touch
    ? ['DRAG  steer', 'PING BUTTON  light up the world']
    : ['MOUSE / WASD / ARROWS  steer', 'CLICK / SPACE  ping', 'P  pause     M  sound'];
  lines.forEach((l, i) => txt(l, W / 2, H / 2 + 26 + i * 22, 13, '#8aa9b3', 'center', 2));
  const pulse = 0.5 + 0.5 * Math.sin(G.t * 4);
  txt(input.touch ? 'TAP TO START' : 'CLICK OR PRESS SPACE TO START', W / 2, H / 2 + 128, 18, '#ffd24d', 'center', 4, 0.55 + 0.45 * pulse);
  if (G.hi > 0) txt('BEST ' + String(G.hi).padStart(7, '0'), W / 2, H - 34, 14, '#5f8794', 'center', 3);
}

function drawOver() {
  ctx.fillStyle = 'rgba(2,4,10,0.55)'; ctx.fillRect(0, 0, W, H);
  txt('SIGNAL LOST', W / 2, H / 2 - 100, 50, '#ff6577', 'center', 10);
  txt('SCORE', W / 2, H / 2 - 40, 12, '#5f8794', 'center', 4);
  txt(String(G.score).padStart(7, '0'), W / 2, H / 2 - 8, 40, '#e6fbff', 'center');
  txt('REACHED WAVE ' + G.level, W / 2, H / 2 + 30, 13, '#8aa9b3', 'center', 3);
  if (G.newRecord) txt('NEW RECORD!', W / 2, H / 2 + 60, 20, '#ffd24d', 'center', 5, 0.6 + 0.4 * Math.sin(G.t * 8));
  else txt('BEST ' + String(G.hi).padStart(7, '0'), W / 2, H / 2 + 60, 13, '#5f8794', 'center', 3);
  if (G.overT > 0.9) txt(input.touch ? 'TAP TO RETRY' : 'CLICK OR SPACE TO RETRY', W / 2, H / 2 + 112, 17, '#ffd24d', 'center', 4, 0.55 + 0.45 * Math.sin(G.t * 4));
}

function drawPaused() {
  ctx.fillStyle = 'rgba(2,4,10,0.7)'; ctx.fillRect(0, 0, W, H);
  txt('PAUSED', W / 2, H / 2 - 12, 44, '#e6fbff', 'center', 10);
  txt(input.touch ? 'TAP TO RESUME' : 'PRESS P OR CLICK TO RESUME', W / 2, H / 2 + 34, 14, '#ffd24d', 'center', 4);
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, offX * dpr, offY * dpr);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  if (G.shake > 0) ctx.translate(rand(-1, 1) * G.shake * 0.5, rand(-1, 1) * G.shake * 0.5);

  // background
  const bg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7);
  bg.addColorStop(0, '#0a1220'); bg.addColorStop(1, '#03050a');
  ctx.fillStyle = bg; ctx.fillRect(-30, -30, W + 60, H + 60);

  drawGridReveals();
  for (const sh of G.shards) drawShard(sh);
  for (const m of G.mines) drawMine(m);
  for (const h of G.hunters) drawHunter(h);
  drawParticles();
  drawShip();
  drawFloaters();

  if (G.flash > 0) { ctx.fillStyle = 'rgba(255,60,80,' + (G.flash * 0.9).toFixed(3) + ')'; ctx.fillRect(-30, -30, W + 60, H + 60); }

  if (G.mode === 'title') drawTitle();
  else { drawHUD(); if (G.mode === 'over') drawOver(); if (G.mode === 'paused') drawPaused(); }
  ctx.restore();
}

// ───────────────────────── input ─────────────────────────
function toWorld(cx, cy) { return { x: (cx - offX) / scale, y: (cy - offY) / scale }; }
function inPingButton(p) { return Math.hypot(p.x - (W - 90), p.y - (H - 96)) < 74; }

function primaryAction() {
  audio();
  if (G.mode === 'title') startGame();
  else if (G.mode === 'over') { if (G.overT > 0.9) startGame(); }
  else if (G.mode === 'paused') G.mode = 'play';
  else if (G.mode === 'play') doPing();
}
function togglePause() {
  if (G.mode === 'play') G.mode = 'paused';
  else if (G.mode === 'paused') G.mode = 'play';
}
function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('echodrift.mute', muted ? '1' : '0'); } catch (e) {}
  if (!muted) tone(660, 0.1, 'triangle', 0.08);
}

window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) { input.keys[e.code] = true; return; }
  input.keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'Enter') primaryAction();
  else if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  else if (e.code === 'KeyM') toggleMute();
  else audio();
});
window.addEventListener('keyup', e => { input.keys[e.code] = false; });

canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  const p = toWorld(e.clientX, e.clientY);
  if (e.pointerType === 'touch') {
    input.touch = true;
    if (G.mode === 'play' && inPingButton(p)) { input.pingId = e.pointerId; doPing(); return; }
    if (G.mode === 'play' && input.steerId === null) { input.steerId = e.pointerId; input.usePointer = true; input.tx = p.x; input.ty = p.y - 60; }
    primaryAction_nonPlay();
  } else {
    input.usePointer = true; input.tx = p.x; input.ty = p.y;
    primaryAction();
  }
});
function primaryAction_nonPlay() { if (G.mode !== 'play') primaryAction(); }
canvas.addEventListener('pointermove', e => {
  const p = toWorld(e.clientX, e.clientY);
  if (e.pointerType === 'touch') {
    if (e.pointerId === input.steerId) { input.tx = p.x; input.ty = p.y - 60; }
  } else { input.usePointer = true; input.tx = p.x; input.ty = p.y; }
});
function endPointer(e) {
  if (e.pointerId === input.steerId) input.steerId = null;
  if (e.pointerId === input.pingId) input.pingId = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

window.addEventListener('blur', () => { if (G.mode === 'play') G.mode = 'paused'; input.keys = {}; });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play') G.mode = 'paused'; });

// ───────────────────────── main loop ─────────────────────────
let last = 0;
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// test hook (used by the headless smoke test, harmless in the browser)
window.__echodrift = { G, update, render, startGame, doPing, input };
})();
