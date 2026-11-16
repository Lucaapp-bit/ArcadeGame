/* LUCA — level data.
 * Levels are built with a tiny DSL (tile coordinates, 32px tiles, 17 rows).
 * Ground top is usually row 14, so an entity "standing on the ground" sits in row 13.
 */
(() => {
'use strict';
const T = 32, ROWS = 17;

// tile codes: 0 empty, 1 ground, 2 ice, 3 one-way plank, 4 crate, 5 used crate,
//             6 spikes, 7 liquid (deadly), 8 spring, 9 stone
function mk(name, theme, cols, o) {
  o = o || {};
  const L = { name, theme, cols, tiles: new Uint8Array(cols * ROWS), crates: {}, enemies: [], beans: [], plats: [],
    jets: [], cps: [], signs: [], startPos: { x: 2, y: 13 }, goalPos: { x: cols - 6, y: 13 },
    gt: o.gt || 1, boss: !!o.boss, arena: o.arena || 0 };
  const set = (x, y, t) => { if (x >= 0 && x < cols && y >= 0 && y < ROWS) L.tiles[y * cols + x] = t; };
  const fill = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
  Object.assign(L, {
    set(x, y, t) { set(x, y, t); return L; },
    fill(x0, y0, x1, y1, t) { fill(x0, y0, x1, y1, t); return L; },
    ground(x0, x1, top, t) { fill(x0, top === undefined ? 14 : top, x1, ROWS - 1, t || L.gt); return L; },
    isle(x0, x1, top, h, t) { fill(x0, top, x1, top + (h || 2) - 1, t || L.gt); return L; },
    plat(x, y, len, t) { fill(x, y, x + len - 1, y, t || 3); return L; },
    stone(x, y, w, h) { fill(x, y, x + (w || 1) - 1, y + (h || 1) - 1, 9); return L; },
    crate(x, y, item) { set(x, y, 4); L.crates[x + ',' + y] = item || 'bean'; return L; },
    spikes(x, y, n) { fill(x, y, x + (n || 1) - 1, y, 6); return L; },
    liq(x0, x1, top) { fill(x0, top === undefined ? 15 : top, x1, ROWS - 1, 7); return L; },
    spring(x, y) { set(x, y, 8); return L; },
    bean(x, y) { L.beans.push({ x: x * T + 16, y: y * T + 16 }); return L; },
    line(x, y, n, dx, dy) { for (let i = 0; i < n; i++) L.bean(x + i * (dx === undefined ? 1 : dx), y + i * (dy || 0)); return L; },
    arc(x, y, n, h, span) { for (let i = 0; i < n; i++) { const u = n > 1 ? i / (n - 1) : 0; L.beans.push({ x: (x + span * u) * T + 16, y: (y - h * 4 * u * (1 - u)) * T + 16 }); } return L; },
    en(type, x, y, extra) { L.enemies.push(Object.assign({ t: type, x: x * T, y: (y + 1) * T }, extra || {})); return L; },
    mp(x, y, len, ax, ay, sp, ph) { L.plats.push({ k: 'mp', x: x * T, y: y * T, w: len * T, ax: ax * T, ay: ay * T, sp, ph: ph || 0 }); return L; },
    fp(x, y, len) { L.plats.push({ k: 'fp', x: x * T, y: y * T, w: len * T }); return L; },
    jet(x, y, ph, per) { L.jets.push({ x: x * T, y: y * T, ph: ph || 0, per: per || 3 }); return L; },
    cp(x, y) { L.cps.push({ x: x * T, y: y * T }); return L; },
    sign(x, y, text) { L.signs.push({ x: x * T, y: y * T, text }); return L; },
    start(x, y) { L.startPos = { x, y }; return L; },
    goal(x, y) { L.goalPos = { x, y }; return L; },
  });
  return L;
}

const LEVELS = [];

// ───────── 1 · Colline Verdi ─────────
LEVELS.push(
  mk('Colline Verdi', 'grass', 130)
    .ground(0, 26).start(3, 13)
    .sign(4, 13, '← → per muoverti').sign(10, 13, 'SPAZIO per saltare')
    .line(8, 11, 5).crate(13, 10, 'bean').crate(14, 10, 'coffee').crate(15, 10, 'bean')
    .sign(19, 13, 'SHIFT per correre').en('slime', 22, 13)
    .arc(25, 12, 6, 3, 6)
    .ground(30, 48).plat(34, 10, 5).line(34, 9, 5)
    .en('slime', 38, 13).en('slime', 43, 13)
    .ground(49, 58, 12).en('slime', 54, 11)
    .ground(59, 80).spikes(66, 13, 3).arc(64, 11, 7, 3, 6).cp(62, 13)
    .en('slime', 72, 13).en('slime', 76, 13)
    .arc(80, 12, 5, 3, 5)
    .ground(85, 108).spring(90, 14).plat(88, 8, 7).line(88, 7, 7).crate(94, 5, 'heart')
    .sign(86, 13, 'Molla!')
    .en('slime', 97, 13).en('slime', 101, 13).en('bat', 99, 9)
    .arc(108, 12, 5, 3, 5)
    .ground(113, 116, 13).ground(117, 120, 12).ground(121, 129, 11)
    .en('slime', 118, 11).line(113, 11, 4).line(117, 10, 4)
    .goal(126, 10)
);

// ───────── 2 · Caverna di Cristallo ─────────
LEVELS.push(
  mk('Caverna di Cristallo', 'cave', 150)
    .fill(0, 0, 149, 2, 9)
    .ground(0, 19).start(3, 13)
    .line(8, 12, 4).en('beetle', 14, 13).crate(17, 10, 'bean')
    .liq(20, 25).plat(22, 12, 2).line(22, 10, 2)
    .ground(26, 44).spikes(31, 13, 2).line(29, 10, 5).en('slime', 36, 13).crate(38, 10, 'coffee').cp(40, 13)
    .liq(45, 58).fp(46, 13, 3).fp(51, 12, 3).fp(56, 13, 3).line(47, 10, 2).line(52, 9, 2).line(57, 10, 2)
    .ground(59, 76, 12).arc(60, 10, 7, 2, 12).en('beetle', 64, 11).en('beetle', 70, 11).en('bat', 66, 8).en('bat', 73, 7)
    .ground(77, 100).spikes(80, 13, 3).spikes(88, 13, 3).spikes(95, 13, 2)
    .arc(79, 11, 6, 3, 5).arc(87, 11, 6, 3, 5).en('slime', 85, 13).en('bat', 91, 9).crate(92, 10, 'heart').cp(84, 13)
    .liq(101, 118).mp(103, 12, 4, 3, 0, 1.0).mp(111, 11, 4, 3, 0, 1.4, 1.5)
    .ground(119, 149).spikes(125, 13, 2).crate(128, 10, 'bean').en('beetle', 131, 13).en('bat', 136, 8).en('slime', 140, 13)
    .line(122, 11, 4).line(133, 11, 4)
    .goal(144, 13)
);

// ───────── 3 · Rovine nel Cielo ─────────
LEVELS.push(
  mk('Rovine nel Cielo', 'sky', 170)
    .isle(0, 12, 13, 4).start(3, 12).sign(4, 12, 'Non guardare giù!').line(6, 10, 4)
    .mp(14, 12, 4, 2, 0, 1.3)
    .isle(20, 30, 12, 5).crate(23, 8, 'bean').en('slime', 27, 11).line(26, 9, 3)
    .isle(34, 36, 11, 3).isle(40, 42, 10, 3).isle(46, 48, 9, 3)
    .line(34, 9, 3).line(40, 8, 3).line(46, 7, 3)
    .isle(52, 72, 9, 8).cp(53, 8).en('slime', 57, 8).en('bat', 62, 4).en('slime', 66, 8).crate(60, 5, 'coffee').spikes(69, 8, 2)
    .mp(75, 9, 3, 0, 3, 1.1)
    .isle(80, 86, 6, 3).en('bat', 83, 3).line(81, 4, 5)
    .isle(90, 92, 7, 3).isle(96, 98, 9, 3).isle(102, 104, 11, 3)
    .line(90, 5, 3).line(96, 7, 3).line(102, 9, 3)
    .fp(107, 12, 4).fp(113, 12, 4).line(107, 10, 4).line(113, 10, 4)
    .isle(119, 136, 12, 5).cp(120, 11).en('slime', 124, 11).en('beetle', 128, 11).en('bat', 131, 7).crate(126, 8, 'heart').spikes(132, 11, 2)
    .mp(139, 11, 3, 3, 0, 1.2).mp(146, 10, 3, 3, 0, 1.5, 1)
    .isle(152, 169, 11, 6).en('slime', 156, 10).line(154, 9, 5)
    .goal(164, 10)
);

// ───────── 4 · Valle Ghiacciata ─────────
LEVELS.push(
  mk('Valle Ghiacciata', 'ice', 160, { gt: 2 })
    .ground(0, 30).start(3, 13).line(7, 12, 5).crate(12, 10, 'bean').en('slime', 18, 13)
    .spikes(24, 13, 2).line(23, 10, 4)
    .liq(31, 36).plat(33, 12, 2).line(33, 10, 2)
    .ground(37, 60).cp(40, 13).en('beetle', 43, 13).crate(46, 10, 'coffee').en('slime', 49, 13).spikes(53, 13, 3).arc(52, 11, 5, 3, 5)
    .ground(61, 64, 12).ground(65, 68, 10).line(61, 10, 4).line(65, 8, 4)
    .ground(69, 85, 10).en('beetle', 73, 9).en('bat', 76, 5).en('beetle', 80, 9).en('bat', 83, 4).crate(78, 6, 'heart')
    .ground(86, 110).spikes(92, 13, 2).spikes(100, 13, 2).en('slime', 96, 13).en('slime', 105, 13).cp(88, 13)
    .arc(91, 11, 5, 3, 4).arc(99, 11, 5, 3, 4)
    .liq(111, 124).mp(113, 12, 3, 3, 0, 1.2).mp(120, 11, 3, 3, 0, 1.5, 2)
    .ground(125, 159).spikes(130, 13, 2).en('beetle', 134, 13).en('slime', 140, 13).crate(144, 10, 'coffee').spikes(147, 13, 3)
    .arc(129, 11, 5, 3, 4).arc(146, 11, 5, 3, 5)
    .goal(154, 13)
);

// ───────── 5 · Fucina di Lava ─────────
LEVELS.push(
  mk('Fucina di Lava', 'lava', 170)
    .ground(0, 16).start(3, 13).line(6, 12, 4).jet(12, 14, 0)
    .liq(17, 22).plat(19, 12, 3).line(19, 10, 3)
    .ground(23, 45).en('beetle', 27, 13).jet(30, 14, 0).jet(34, 14, 1.5).en('bat', 38, 8).crate(40, 10, 'coffee').cp(36, 13)
    .line(28, 11, 3).line(35, 11, 3)
    .liq(46, 62).mp(47, 12, 3, 3, 0, 1.2).mp(54, 11, 3, 3, 0, 1.5, 1).mp(59, 12, 2, 1, 0, 1.0, 2)
    .ground(63, 84, 12).cp(64, 11).en('beetle', 68, 11).jet(72, 12, 0.5).jet(76, 12, 2).en('slime', 80, 11).crate(70, 8, 'heart')
    .liq(85, 98).fp(86, 12, 3).fp(91, 11, 3).fp(96, 12, 2).line(86, 10, 3).line(91, 9, 3)
    .ground(99, 125).en('slime', 103, 13).en('beetle', 108, 13).jet(112, 14, 0).jet(115, 14, 1).jet(118, 14, 2)
    .en('bat', 120, 8).crate(110, 10, 'bean').spikes(122, 13, 2).cp(100, 13)
    .liq(126, 145).mp(128, 12, 4, 3, 0, 1.3).mp(136, 11, 4, 4, 0, 1.1, 2)
    .ground(147, 169).en('slime', 152, 13).en('beetle', 157, 13).line(150, 11, 5).crate(160, 10, 'coffee')
    .goal(164, 13)
);

// ───────── 6 · La Fortezza dell'Ombra (boss) ─────────
LEVELS.push(
  mk("La Fortezza dell'Ombra", 'castle', 131, { boss: true, arena: 100 })
    .ground(0, 18).start(3, 13).en('beetle', 12, 13).spikes(15, 13, 2).line(6, 12, 4)
    .liq(19, 24).plat(21, 12, 2)
    .ground(25, 45).cp(27, 13).en('slime', 29, 13).crate(31, 10, 'coffee').en('bat', 33, 8).spikes(36, 13, 3).en('beetle', 41, 13).arc(35, 11, 5, 3, 5)
    .ground(46, 49, 12).ground(50, 53, 10).line(46, 10, 4).line(50, 8, 4)
    .ground(54, 66, 10).jet(58, 10, 0).jet(62, 10, 1.5).en('beetle', 64, 9).en('bat', 60, 5).crate(56, 6, 'heart')
    .liq(67, 72).fp(68, 11, 3).line(68, 9, 3)
    .ground(73, 99, 12).cp(74, 11).spikes(78, 11, 3).en('slime', 84, 11).en('beetle', 88, 11).en('bat', 91, 6).arc(77, 9, 5, 3, 5)
    .jet(94, 12, 0.5).cp(96, 11)
    .ground(100, 130, 14).plat(108, 10, 4).plat(122, 10, 4)
    .fill(130, 0, 130, 13, 9)
    .goal(126, 13)
);
LEVELS[5].bossAt = { x: 118, y: 13 };

window.LUCA_LEVELS = LEVELS;
})();
