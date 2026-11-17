/* LEOPOLDO — Gran Pesca di Natale: tutto quello che si può pescare (e le battute).
 * z = peso di comparsa [vicino, medio, largo]
 * k = fish (calma) | gag (agita) | pill (calma tanto)
 * a = variazione di ANSIA, d = difficoltà del recupero (0..1), pts = punti
 */
(() => {
'use strict';
const TAU = Math.PI * 2;

const ITEMS = [
  // ───── pesci veri ─────
  { id: 'sardina', n: 'Sardina', k: 'fish', z: [5, 2, 0], pts: 15, a: -6, d: 0.22, c1: '#8fb4cc', c2: '#e8f1f6',
    t: "Una sardina! Stasera al bar diventerà un tonno da 200 chili, preso a mani nude, con il mare forza 9." },
  { id: 'buonotaglio', n: 'Buono taglio', k: 'gag', z: [0, 2, 2], pts: 70, a: 8, d: 0.5,
    t: 'Un buono per tagliarsi i capelli da Christian, insieme a tutti gli zanza di Stendhal. Si prenota in gruppo.' },
  { id: 'spigola', n: 'Spigola', k: 'fish', z: [0, 4, 3], pts: 70, a: -12, d: 0.6, c1: '#9aa9b5', c2: '#e6ebef',
    t: "Una spigola di Sanremo. \"Ne ho pescate quaranta ieri\", dirai. Ieri hai pescato una scarpa." },
  { id: 'polpo', n: 'Polpo', k: 'fish', z: [0, 2, 4], pts: 110, a: -14, d: 0.7, c1: '#c4573c', c2: '#e98b6b',
    t: "Un polpo! Otto braccia e nessuna ti fa male. Che invidia: a te fa male il ginocchio." },
  { id: 'spada', n: 'Pesce spada', k: 'fish', z: [0, 0, 3], pts: 180, a: -18, d: 0.85, c1: '#4f7fb0', c2: '#cfdceb',
    t: "Un pesce spada! Domani sarà lungo 4 metri e ti avrà trascinato fino a Montecarlo." },
  { id: 'tonno', n: 'Tonno rosso', k: 'fish', z: [0, 0, 2], pts: 300, a: -25, d: 0.95, c1: '#2d4f8a', c2: '#d9e3f0',
    t: "Il tonno rosso! Nel racconto diventa una balena. Intanto ti è venuto il mal di schiena." },

  // ───── roba assurda ─────
  { id: 'scarpa', n: 'Scarpa', k: 'gag', z: [4, 2, 0], pts: 10, a: 5, d: 0.2,
    t: "Una scarpa da calcio, taglia 46. Ti senti Del Piero. I piedi, però, no." },
  { id: 'ferro', n: 'Ferro da stiro', k: 'gag', z: [3, 3, 0], pts: 25, a: 8, d: 0.35,
    t: "Un ferro da stiro: il tuo piede destro. Il sinistro è un altro ferro da stiro. Altro che Del Piero." },
  { id: 'pallone', n: 'Pallone sgonfio', k: 'gag', z: [3, 2, 0], pts: 20, a: 6, d: 0.3,
    t: "Un pallone sgonfio, come il tuo calcetto. Eppure in campo ti senti un campione." },
  { id: 'totebag', n: 'Tote bag', k: 'gag', z: [3, 2, 0], pts: 30, a: 4, d: 0.25,
    t: "Una tote bag \"Smantelliamo il capitale\", comprata nella boutique in centro, ovviamente." },
  { id: 'ginocchio', n: 'Il tuo ginocchio', k: 'gag', z: [0, 3, 1], pts: 40, a: 12, d: 0.5,
    t: "Il tuo ginocchio! Fa male anche da pescato: ormai è un dolore autonomo." },
  { id: 'termometro', n: 'Termometro', k: 'gag', z: [0, 3, 2], pts: 35, a: 14, d: 0.4,
    t: "Un termometro: 37,1. Per te è febbre da cavallo. Scrivi il testamento." },
  { id: 'cartellino', n: 'Cartellino di Martino', k: 'gag', z: [0, 3, 2], pts: 40, a: 10, d: 0.45,
    t: "Il cartellino di Martino: entrata 07:59, uscita 08:01. Pagato con le tue tasse." },
  { id: 'bottiglia', n: 'Messaggio in bottiglia', k: 'gag', z: [0, 3, 2], pts: 50, a: 8, d: 0.5,
    t: "Un messaggio in bottiglia: \"Nessuno pesca bene come me a Sanremo\". Scritto da te. A te stesso." },
  { id: 'rogito', n: 'Rogito in centro', k: 'gag', z: [0, 1, 3], pts: 60, a: 12, d: 0.6,
    t: "Il rogito della tua casa in centro. Sei di sinistra, ma la proprietà privata è sacra." },
  { id: 'cappello', n: 'Cappellino rosso', k: 'gag', z: [0, 0, 3], pts: 60, a: 25, d: 0.75,
    t: "Un cappellino rosso \"Make Martino Great Again\". Reazione: orticaria, tremori e ginocchio." },
  { id: 'martino', n: 'Martino', k: 'gag', z: [0, 0, 3], pts: 90, a: 18, d: 0.8,
    t: "Hai pescato Martino! Ha già timbrato, e il tuo ginocchio ha già ceduto." },
  { id: 'medusa', n: 'Medusa', k: 'gag', z: [0, 2, 2], pts: 30, a: 20, d: 0.5,
    t: "Una medusa. Finalmente un sintomo vero! Domani dirai che era uno squalo." },
  { id: 'lucone', n: 'Lucone', k: 'gag', z: [0, 0, 3], pts: 90, a: 18, d: 0.8,
    t: "Hai pescato Lucone! Timbra anche lui: Italia ferma e tu hai già mal di schiena." },
  { id: 'tommyv', n: 'Tommy V', k: 'gag', z: [0, 0, 3], pts: 100, a: 22, d: 0.85,
    t: "Hai pescato Tommy V. Per un progressista come te è peggio di una medusa: orticaria subito." },
  { id: 'donati', n: 'Donati', k: 'gag', z: [0, 0, 3], pts: 100, a: 20, d: 0.8,
    t: "Hai pescato Donati! Ti sfotte per la Juve. Risposta automatica: \"30 scudetti sul campo!\"" },
  { id: 'sciarpa', n: 'Sciarpa dell\'Inter', k: 'gag', z: [0, 2, 2], pts: 40, a: 12, d: 0.45,
    t: "Una sciarpa dell'Inter, regalo di Donati. Da juventino la odi. Ma fa freddo, e la indossi." },
  { id: 'ariston', n: 'Biglietto Ariston', k: 'gag', z: [0, 2, 2], pts: 70, a: 6, d: 0.55,
    t: "Un biglietto per l'Ariston. Per Sanremo accetti tutto, anche i cantanti. Ma la schiena in platea fa male." },
  { id: 'scorfano', n: 'Scorfano', k: 'fish', z: [0, 3, 3], pts: 95, a: -12, d: 0.65, c1: '#b8452f', c2: '#e8a58a',
    t: "Uno scorfano: brutto, spinoso e si lamenta di tutto. Ti somiglia moltissimo." },

  // ───── farmacia ─────
  { id: 'tachipirina', n: 'Tachipirina 1000', k: 'pill', z: [0, 2, 2], pts: 20, a: -30, d: 0.4,
    t: "Una Tachipirina 1000. La prendi in via preventiva, anche con 36 e mezzo." },
  { id: 'ffp2', n: 'Mascherina FFP2', k: 'pill', z: [1, 2, 1], pts: 20, a: -18, d: 0.3,
    t: "Una FFP2, sotto la barba. Filtra i virus, ma non le tue lamentele." },
  { id: 'juve', n: 'Maglia della Juve', k: 'pill', z: [0, 2, 2], pts: 50, a: -26, d: 0.45,
    t: "La maglia della Juve! Ansia giù e petto in fuori: \"30 scudetti sul campo!\"" },
  { id: 'fiori', n: 'Fiori di Sanremo', k: 'pill', z: [2, 2, 0], pts: 30, a: -16, d: 0.3,
    t: "Fiori di Sanremo: a Sanremo nemmeno il ginocchio fa male. Per cinque minuti." },
];

// ───────────────────────── icone ─────────────────────────
function fishShape(c, col, belly, sc, spots) {
  c.save(); c.scale(sc, sc);
  c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 34, 16, 0, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(26, 0); c.lineTo(48, -15); c.lineTo(48, 15); c.closePath(); c.fill();
  c.fillStyle = belly; c.beginPath(); c.ellipse(-2, 6, 27, 9, 0, 0, Math.PI); c.fill();
  c.fillStyle = col; c.beginPath(); c.moveTo(-8, -14); c.lineTo(4, -27); c.lineTo(15, -13); c.closePath(); c.fill();
  if (spots) { c.fillStyle = 'rgba(0,0,0,0.22)'; for (let i = 0; i < 4; i++) c.fillRect(-4 + i * 8, -10, 3, 12); }
  c.fillStyle = '#fff'; c.beginPath(); c.arc(-21, -4, 4.6, 0, TAU); c.fill();
  c.fillStyle = '#111'; c.beginPath(); c.arc(-22, -4, 2.2, 0, TAU); c.fill();
  c.restore();
}

function rr2(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill(); }

function drawIcon(c, id, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const it = ITEMS.find(i => i.id === id);
  switch (id) {
    case 'sardina': fishShape(c, it.c1, it.c2, 0.85, true); break;
    case 'buonotaglio':
      c.rotate(-0.08); c.fillStyle = '#fff6d6'; rr2(c, -46, -30, 92, 60, 6); c.strokeStyle = '#c4382f'; c.lineWidth = 2.5; c.setLineDash([5, 4]); c.strokeRect(-41, -25, 82, 50); c.setLineDash([]);
      c.fillStyle = '#c4382f'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('BUONO TAGLIO', 8, -10);
      c.fillStyle = '#333'; c.font = 'bold 8.5px sans-serif'; c.fillText('da CHRISTIAN', 8, 3); c.fillText('+ zanza Stendhal', 8, 15);
      c.strokeStyle = '#555'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-36, -2); c.lineTo(-26, -16); c.moveTo(-36, -16); c.lineTo(-26, -2); c.stroke();
      c.strokeStyle = '#c4382f'; c.beginPath(); c.arc(-37, 0, 2.6, 0, TAU); c.moveTo(-34.4, -18); c.arc(-37, -18, 2.6, 0, TAU); c.stroke(); break;
    case 'spigola': fishShape(c, it.c1, it.c2, 1.05, true); break;
    case 'spada':
      c.fillStyle = '#9fb3c8'; c.beginPath(); c.moveTo(-34, -2); c.lineTo(-98, 0); c.lineTo(-34, 3); c.closePath(); c.fill();
      fishShape(c, it.c1, it.c2, 1.05, false); break;
    case 'tonno':
      fishShape(c, it.c1, it.c2, 1.18, true);
      c.fillStyle = '#f2d24a'; for (let i = 0; i < 4; i++) c.fillRect(14 + i * 6, -3 + i * 0.5, 4, 3); break;
    case 'polpo':
      c.fillStyle = it.c1;
      c.beginPath(); c.ellipse(0, -14, 26, 24, 0, 0, TAU); c.fill();
      for (let i = 0; i < 8; i++) {
        const bx = -24 + i * 6.9, sw = Math.sin(i * 1.7) * 8;
        c.strokeStyle = it.c1; c.lineWidth = 6; c.lineCap = 'round';
        c.beginPath(); c.moveTo(bx, 4); c.quadraticCurveTo(bx + sw, 24, bx - sw * 0.5, 42); c.stroke();
      }
      c.fillStyle = it.c2; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-14 + i * 7, -6, 2.5, 0, TAU); c.fill(); }
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-9, -16, 6, 0, TAU); c.arc(9, -16, 6, 0, TAU); c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(-8, -15, 2.6, 0, TAU); c.arc(10, -15, 2.6, 0, TAU); c.fill(); break;
    case 'scarpa':
      c.fillStyle = '#c9ced6'; c.fillRect(-42, 14, 84, 12);
      c.fillStyle = '#e9edf2'; c.beginPath(); c.moveTo(-42, 14); c.lineTo(-42, -6); c.quadraticCurveTo(-18, -4, -6, -20); c.lineTo(10, -30); c.lineTo(22, -30); c.lineTo(24, 2); c.quadraticCurveTo(46, 6, 42, 14); c.closePath(); c.fill();
      c.strokeStyle = '#8f98a5'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(0 + i * 8, -22 + i * 6); c.lineTo(10 + i * 8, -14 + i * 6); c.stroke(); }
      c.fillStyle = '#7fb069'; c.fillRect(10, -42, 14, 14); c.fillStyle = '#6c9a58'; c.fillRect(10, -38, 14, 3);
      c.fillStyle = '#3c8a3c'; c.fillRect(-30, 6, 4, 4); c.fillRect(-14, 4, 5, 5); break;
    case 'ferro':
      c.fillStyle = '#b8bfca'; c.beginPath(); c.moveTo(-44, 22); c.lineTo(-44, 10); c.quadraticCurveTo(-30, -14, 8, -14); c.lineTo(34, 10); c.lineTo(46, 22); c.closePath(); c.fill();
      c.fillStyle = '#6f7b8c'; c.fillRect(-44, 22, 90, 5);
      c.strokeStyle = '#3d4654'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(-18, -8); c.quadraticCurveTo(-4, -34, 20, -8); c.stroke();
      c.fillStyle = '#7ec8e8'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-26 + i * 10, 17, 2, 0, TAU); c.fill(); } break;
    case 'pallone':
      c.fillStyle = '#f3f3f3'; c.beginPath(); c.ellipse(0, 8, 42, 30, 0, 0, TAU); c.fill();
      c.strokeStyle = '#333'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#2b2b2b';
      for (const [px, py] of [[0, 6], [-22, 0], [22, 0], [-12, 22], [12, 22]]) { c.beginPath(); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2; c.lineTo(px + Math.cos(a) * 8, py + Math.sin(a) * 8); } c.closePath(); c.fill(); }
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.ellipse(0, 28, 36, 5, 0, 0, TAU); c.fill(); break;
    case 'totebag':
      c.strokeStyle = '#7a5a34'; c.lineWidth = 4; c.beginPath(); c.moveTo(-18, -14); c.quadraticCurveTo(-18, -44, 0, -44); c.quadraticCurveTo(18, -44, 18, -14); c.stroke();
      c.fillStyle = '#efe3c6'; c.fillRect(-34, -16, 68, 62); c.strokeStyle = '#cdbf9f'; c.lineWidth = 2; c.strokeRect(-34, -16, 68, 62);
      c.fillStyle = '#c4382f'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('SMANTELLIAMO', 0, 8); c.fillText('IL CAPITALE', 0, 20);
      c.fillStyle = '#2f7a4a'; c.beginPath(); c.arc(0, 34, 6, 0, TAU); c.fill(); break;
    case 'ginocchio':
      c.fillStyle = '#e8b894'; c.fillRect(-12, -46, 24, 34); c.fillRect(-12, 12, 24, 34);
      c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fill();
      c.fillStyle = '#e24b4b'; c.fillRect(-18, -8, 36, 16); c.fillStyle = '#fff'; c.fillRect(-3, -6, 6, 12); c.fillRect(-9, -3, 18, 6);
      c.strokeStyle = '#ffd24d'; c.lineWidth = 3; c.lineCap = 'round';
      for (const a of [-0.9, -0.3, 0.3]) { c.beginPath(); c.moveTo(Math.cos(a - 1.6) * 30, Math.sin(a - 1.6) * 30); c.lineTo(Math.cos(a - 1.6) * 42, Math.sin(a - 1.6) * 42); c.stroke(); }
      c.fillStyle = '#e24b4b'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('AHI!', 38, -22); break;
    case 'termometro':
      c.rotate(-0.6);
      c.fillStyle = '#eef3f7'; c.beginPath(); c.moveTo(-40, -7); c.lineTo(30, -7); c.arc(30, 0, 7, -Math.PI / 2, Math.PI / 2); c.lineTo(-40, 7); c.closePath(); c.fill();
      c.strokeStyle = '#9aa7b3'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#e24b4b'; c.fillRect(-36, -2, 62, 4); c.beginPath(); c.arc(34, 0, 9, 0, TAU); c.fill();
      c.strokeStyle = '#6b7885'; c.lineWidth = 1; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(-34 + i * 7, -7); c.lineTo(-34 + i * 7, i % 2 ? -3 : -1); c.stroke(); } break;
    case 'cartellino':
      c.strokeStyle = '#2d6cdf'; c.lineWidth = 5; c.beginPath(); c.moveTo(-14, -52); c.lineTo(-4, -22); c.moveTo(14, -52); c.lineTo(4, -22); c.stroke();
      c.fillStyle = '#fff'; c.fillRect(-32, -24, 64, 78); c.strokeStyle = '#8895a5'; c.lineWidth = 2; c.strokeRect(-32, -24, 64, 78);
      c.fillStyle = '#2d6cdf'; c.fillRect(-32, -24, 64, 12);
      c.fillStyle = '#c9d4e2'; c.fillRect(-22, -6, 24, 28); c.fillStyle = '#e8b894'; c.beginPath(); c.arc(-10, 4, 6, 0, TAU); c.fill(); c.fillStyle = '#4c7aa8'; c.fillRect(-20, 12, 20, 10);
      c.fillStyle = '#333'; c.font = 'bold 10px sans-serif'; c.textAlign = 'left'; c.fillText('IN 07:59', 6, 4); c.fillText('OUT 08:01', 6, 18);
      c.fillStyle = '#c4382f'; c.fillText('STATALE', -26, 42); break;
    case 'bottiglia':
      c.rotate(-0.5);
      c.fillStyle = 'rgba(80,170,110,0.9)'; c.beginPath(); c.moveTo(-40, -14); c.lineTo(10, -14); c.quadraticCurveTo(24, -14, 30, -5); c.lineTo(44, -5); c.lineTo(44, 5); c.lineTo(30, 5); c.quadraticCurveTo(24, 14, 10, 14); c.lineTo(-40, 14); c.closePath(); c.fill();
      c.fillStyle = '#f3e9c8'; c.fillRect(-28, -7, 34, 14); c.fillStyle = '#c4a45c'; c.fillRect(-26, -4, 28, 1.6); c.fillRect(-26, 0, 22, 1.6); c.fillRect(-26, 4, 26, 1.6);
      c.fillStyle = '#8a5a2c'; c.fillRect(44, -7, 8, 14); break;
    case 'rogito':
      c.fillStyle = '#f6efd8'; c.fillRect(-34, -44, 68, 88); c.strokeStyle = '#b9a56b'; c.lineWidth = 2; c.strokeRect(-34, -44, 68, 88);
      c.fillStyle = '#7a6a3c'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('ROGITO', 0, -28);
      c.fillStyle = '#c9bd94'; for (let i = 0; i < 6; i++) c.fillRect(-24, -18 + i * 9, i % 3 === 2 ? 34 : 48, 3);
      c.fillStyle = '#c4382f'; c.beginPath(); c.arc(16, 32, 10, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif'; c.fillText('€', 16, 36); break;
    case 'cappello':
      c.fillStyle = '#d02d2d'; c.beginPath(); c.moveTo(-36, 10); c.quadraticCurveTo(-36, -34, 0, -34); c.quadraticCurveTo(36, -34, 36, 10); c.closePath(); c.fill();
      c.fillStyle = '#a91f1f'; c.beginPath(); c.ellipse(34, 12, 34, 7, 0.08, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('MAKE MARTINO', 0, -10); c.fillText('GREAT AGAIN', 0, 2); break;
    case 'martino':
      c.fillStyle = '#a9c7ee'; c.fillRect(-22, -4, 44, 40); c.fillStyle = '#e8b894'; c.beginPath(); c.arc(0, -20, 18, 0, TAU); c.fill();
      c.fillStyle = '#8a5a34'; c.beginPath(); c.moveTo(-20, -18); c.quadraticCurveTo(-24, -46, 2, -44); c.quadraticCurveTo(24, -44, 20, -18); c.quadraticCurveTo(14, -32, 2, -31); c.quadraticCurveTo(-12, -30, -20, -18); c.fill(); c.fillStyle = 'rgba(80,55,38,0.6)'; c.beginPath(); c.ellipse(0, -7, 9, 5.5, 0, 0, TAU); c.fill();
      c.fillStyle = '#111'; c.fillRect(-9, -22, 4, 4); c.fillRect(5, -22, 4, 4); c.fillRect(-6, -10, 12, 2);
      c.strokeStyle = '#2d6cdf'; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, -3); c.lineTo(-2, 16); c.moveTo(8, -3); c.lineTo(2, 16); c.stroke();
      c.fillStyle = '#fff'; c.fillRect(-8, 14, 16, 12); c.fillStyle = '#c4382f'; c.fillRect(-8, 14, 16, 3);
      c.fillStyle = '#333'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('08:01 ✓', 0, 52); break;
    case 'medusa':
      c.fillStyle = 'rgba(214,150,230,0.9)'; c.beginPath(); c.moveTo(-34, 6); c.quadraticCurveTo(-34, -42, 0, -42); c.quadraticCurveTo(34, -42, 34, 6); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(214,150,230,0.85)'; c.lineWidth = 4; c.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const bx = -28 + i * 11; c.beginPath(); c.moveTo(bx, 6); c.quadraticCurveTo(bx + (i % 2 ? 8 : -8), 26, bx, 46); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(-12, -22, 9, 5, -0.5, 0, TAU); c.fill();
      c.fillStyle = '#6b2f7a'; c.beginPath(); c.arc(-9, -8, 3, 0, TAU); c.arc(9, -8, 3, 0, TAU); c.fill(); break;
    case 'tachipirina':
      c.fillStyle = '#fff'; c.fillRect(-40, -26, 80, 52); c.strokeStyle = '#9aa7b3'; c.lineWidth = 2; c.strokeRect(-40, -26, 80, 52);
      c.fillStyle = '#2ba3a3'; c.fillRect(-40, -26, 80, 16);
      c.fillStyle = '#fff'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('TACHIPIRINA', 0, -14);
      c.fillStyle = '#2b2b2b'; c.font = 'bold 22px sans-serif'; c.fillText('1000', 0, 14);
      c.fillStyle = '#f2f2f2'; c.beginPath(); c.arc(22, -42, 7, Math.PI / 2, Math.PI * 1.5); c.fill(); c.fillStyle = '#e86b6b'; c.beginPath(); c.arc(28, -42, 7, -Math.PI / 2, Math.PI / 2); c.fill();
      c.fillRect(22, -49, 6, 14); c.fillStyle = '#f2f2f2'; c.fillRect(22, -49, 6, 14); break;
    case 'ffp2':
      c.strokeStyle = '#cfd8e0'; c.lineWidth = 3; c.beginPath(); c.moveTo(-34, -6); c.quadraticCurveTo(-52, -4, -50, 16); c.moveTo(34, -6); c.quadraticCurveTo(52, -4, 50, 16); c.stroke();
      c.fillStyle = '#f4f7fa'; c.beginPath(); c.moveTo(-36, -12); c.quadraticCurveTo(0, -30, 36, -12); c.quadraticCurveTo(40, 22, 0, 34); c.quadraticCurveTo(-40, 22, -36, -12); c.closePath(); c.fill();
      c.strokeStyle = '#aab6c2'; c.lineWidth = 2; c.stroke();
      c.strokeStyle = '#d3dbe3'; c.beginPath(); c.moveTo(-26, 0); c.lineTo(26, 0); c.moveTo(-22, 10); c.lineTo(22, 10); c.stroke();
      c.fillStyle = '#2d6cdf'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('FFP2', 0, 24); break;
    case 'lucone':
      c.fillStyle = '#3f8a5a'; rr2(c, -26, -4, 52, 42, 8);
      c.fillStyle = '#d9a98a'; c.beginPath(); c.arc(0, -22, 20, 0, TAU); c.fill();
      c.fillStyle = '#2a1a12'; c.beginPath(); c.arc(0, -30, 20, Math.PI, TAU); c.fill(); c.fillRect(-20, -32, 40, 6);
      c.fillStyle = '#111'; c.fillRect(-10, -24, 5, 4); c.fillRect(6, -24, 5, 4); c.fillRect(-7, -10, 14, 2.4);
      c.strokeStyle = '#2d6cdf'; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, -3); c.lineTo(-3, 18); c.moveTo(8, -3); c.lineTo(3, 18); c.stroke();
      c.fillStyle = '#fff'; c.fillRect(-9, 16, 18, 13); c.fillStyle = '#c4382f'; c.fillRect(-9, 16, 18, 3);
      c.fillStyle = '#333'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('08:01 ✓', 0, 54); break;
    case 'tommyv':
      c.fillStyle = '#17171c'; rr2(c, -28, -4, 56, 44, 8);
      c.fillStyle = '#e0b08e'; c.beginPath(); c.arc(0, -22, 19, 0, TAU); c.fill();
      c.fillStyle = '#1a1a1f'; c.beginPath(); c.arc(0, -30, 19, Math.PI, TAU); c.fill(); c.fillRect(-19, -32, 38, 5);
      c.fillStyle = '#000'; c.fillRect(-16, -25, 14, 8); c.fillRect(2, -25, 14, 8); c.fillRect(-3, -23, 6, 2);
      c.fillStyle = '#7a1f1f'; c.fillRect(-8, -9, 16, 2.4);
      c.strokeStyle = '#f2c230'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 2, 11, 0.15, Math.PI - 0.15); c.stroke();
      c.fillStyle = '#f2c230'; c.beginPath(); c.arc(0, 14, 3.5, 0, TAU); c.fill();
      c.fillStyle = '#e8d6a8'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('MILANO', 0, 34); c.fillStyle = '#333'; c.fillText('AI MIEI TEMPI', 0, 54); break;
    case 'donati':
      c.fillStyle = '#0a1a3c'; rr2(c, -26, -4, 52, 42, 8); c.fillStyle = '#2a7fd1'; for (let i = 0; i < 4; i++) c.fillRect(-20 + i * 13, -4, 6, 42);
      c.fillStyle = '#e8b894'; c.beginPath(); c.arc(0, -22, 19, 0, TAU); c.fill();
      c.fillStyle = '#3a2418'; c.beginPath(); c.arc(0, -29, 19, Math.PI, TAU); c.fill(); c.fillRect(-19, -31, 38, 5);
      c.fillStyle = '#111'; c.fillRect(-10, -24, 5, 4); c.fillRect(6, -24, 5, 4);
      c.strokeStyle = '#7a1f1f'; c.lineWidth = 2.2; c.beginPath(); c.arc(0, -13, 8, 0.15, Math.PI - 0.15); c.stroke();
      c.fillStyle = '#333'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('FORZA INTER', 0, 54); break;
    case 'sciarpa':
      c.rotate(-0.15);
      for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#0a1a3c' : '#2a7fd1'; c.fillRect(-45 + i * 10, -14, 10, 28); }
      c.fillStyle = '#0a1a3c'; c.fillRect(-45, 14, 90, 3);
      for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#0a1a3c' : '#2a7fd1'; c.fillRect(-45 + i * 10, 17, 10, 14); }
      c.fillStyle = '#fff'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('INTER', 0, 4); break;
    case 'ariston':
      c.fillStyle = '#c4382f'; c.beginPath(); c.moveTo(-44, -30); c.lineTo(44, -30); c.lineTo(44, -8); c.arc(44, 3, 0, 0, 0); c.lineTo(44, 36); c.lineTo(-44, 36); c.closePath(); c.fill();
      c.fillStyle = '#f2c230'; c.fillRect(-44, -30, 88, 5); c.fillRect(-44, 31, 88, 5);
      c.fillStyle = '#fff'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillText('ARISTON', 0, -6);
      c.font = 'bold 10px sans-serif'; c.fillText('SANREMO', 0, 8); c.fillText('SERATA 5/5', 0, 24);
      c.fillStyle = '#0b0b0b'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(-36, -22 + i * 11, 2, 0, TAU); c.arc(36, -22 + i * 11, 2, 0, TAU); c.fill(); } break;
    case 'scorfano':
      fishShape(c, it.c1, it.c2, 1.05, false);
      c.strokeStyle = '#7a2616'; c.lineWidth = 2.5; c.lineCap = 'round';
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-12 + i * 5, -16); c.lineTo(-14 + i * 6, -31); c.stroke(); }
      c.fillStyle = 'rgba(80,20,10,0.35)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-8 + i * 9, -2 + (i % 2) * 6, 3, 0, TAU); c.fill(); } break;
    case 'juve':
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-18, -34); c.lineTo(-44, -20); c.lineTo(-34, 0); c.lineTo(-24, -6); c.lineTo(-24, 36); c.lineTo(24, 36); c.lineTo(24, -6); c.lineTo(34, 0); c.lineTo(44, -20); c.lineTo(18, -34); c.quadraticCurveTo(0, -24, -18, -34); c.closePath(); c.fill();
      c.save(); c.clip(); c.fillStyle = '#111'; for (let i = -3; i < 4; i += 2) c.fillRect(i * 9 - 4.5, -40, 9, 80); c.restore();
      c.strokeStyle = '#999'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-18, -34); c.lineTo(-44, -20); c.lineTo(-34, 0); c.lineTo(-24, -6); c.lineTo(-24, 36); c.lineTo(24, 36); c.lineTo(24, -6); c.lineTo(34, 0); c.lineTo(44, -20); c.lineTo(18, -34); c.stroke();
      c.fillStyle = '#f2c230'; c.beginPath(); c.arc(0, 4, 6, 0, TAU); c.fill(); break;
    case 'fiori':
      c.strokeStyle = '#2f8a4a'; c.lineWidth = 3; c.lineCap = 'round';
      for (const [dx, h] of [[-18, 26], [0, 34], [18, 24], [-8, 18], [10, 16]]) { c.beginPath(); c.moveTo(0, 40); c.lineTo(dx, 40 - h - 14); c.stroke(); }
      const cl = ['#ff5a8a', '#ffd24d', '#ff8fe6', '#ff7a4a', '#fff'];
      [[-18, 26], [0, 34], [18, 24], [-8, 18], [10, 16]].forEach(([dx, h], i) => { const fy = 40 - h - 14; c.fillStyle = cl[i]; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; c.beginPath(); c.arc(dx + Math.cos(a) * 6, fy + Math.sin(a) * 6, 5, 0, TAU); c.fill(); } c.fillStyle = '#f2c230'; c.beginPath(); c.arc(dx, fy, 3.5, 0, TAU); c.fill(); });
      c.fillStyle = '#f6efd8'; c.beginPath(); c.moveTo(-14, 26); c.lineTo(14, 26); c.lineTo(8, 46); c.lineTo(-8, 46); c.closePath(); c.fill(); break;
    default:
      c.fillStyle = '#888'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.fillText('?', 0, 14);
  }
  c.restore();
}

window.PESCA_ITEMS = ITEMS;
window.pescaDrawIcon = drawIcon;
window.pescaFishShape = fishShape;
})();
