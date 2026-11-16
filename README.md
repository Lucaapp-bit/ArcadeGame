# LUCA e la Moka Rubata

Un platformer in 6 mondi. Qualcuno ha rubato la moka di Luca: attraversa colline, caverne di cristallo, rovine nel cielo, ghiacci e lava fino alla Fortezza dell'Ombra per riprendertela.

HTML5 canvas + WebAudio, nessuna dipendenza e nessun build: Vercel serve i file così come sono.

## Comandi

| | Tastiera | Touch |
|---|---|---|
| Muovi | ← → / A D | ◀ ▶ |
| Salta (più tieni premuto, più sali) | Spazio / ↑ / W / Z | SALTA |
| Corri | Shift / X | CORRI |
| Scendi da una piattaforma sottile | ↓ + Salto | — |
| Pausa / Audio / Riavvia livello | P / M / R | — |

## Cosa c'è dentro

- **6 mondi** con grafica, nemici, musica e pericoli diversi: Colline Verdi, Caverna di Cristallo, Rovine nel Cielo, Valle Ghiacciata (si scivola), Fucina di Lava, Fortezza dell'Ombra.
- **Salto curato**: altezza variabile, coyote time, salto bufferizzato, schiacciata ed elasticità.
- **Nemici**: slime e pipistrelli si schiacciano saltandoci sopra; i coleotteri **no** (hanno le spine sopra: schivali o usa il Turbo Caffè). Poi getti di fuoco e spuntoni.
- **Potenziamenti**: *Turbo Caffè* (10 s di velocità, doppio salto e invincibilità offensiva), cuori, 3 punti ferita, vite extra ogni 100 chicchi.
- **Elementi di livello**: casse con sorprese, molle, piattaforme mobili e che crollano, checkpoint (moka da bar).
- **Boss finale**: l'Ombra. Salta sulla sua testa quando è stordita, e ogni colpo lo fa infuriare.
- **Progressi salvati** nel browser: livelli sbloccati, record di chicchi, tempo e punteggio.

## Sviluppo

```bash
npx serve .      # oppure apri index.html
```

- `index.html` — pagina
- `levels.js` — i 6 livelli (piccola DSL a tile da 32px)
- `game.js` — fisica, nemici, boss, rendering, musica procedurale
