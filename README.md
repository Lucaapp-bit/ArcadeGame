# ECHO DRIFT

A one-ship arcade game played in the dark. You can barely see — **ping** to light up the world, but every ping wakes the hunters and sends them charging at the spot where you were.

Plain HTML5 canvas + WebAudio. No build step, no dependencies: Vercel serves `index.html` as-is.

## How to play

| | Desktop | Mobile |
|---|---|---|
| Steer | Mouse, or WASD / arrow keys | Drag a finger |
| Ping | Click / Space | PING button |
| Pause | P / Esc | switch away from the tab |
| Sound | M | — |

- Collect the golden **shards** to clear each wave. Shards glow faintly, mines and hunters are invisible until lit.
- **Pinging costs energy** (it refills slowly, and each shard gives a little back).
- **Chain** shards within ~4 seconds to build a multiplier up to x8.
- **BLIND bonus:** collect a shard without having pinged for 4 seconds and it's worth double.
- From wave 2 **hunters** roam: a ping within earshot sends them charging at its origin. Ping, then move.
- Clear a wave for a bonus; you gain a life every other wave (max 5).

High score is saved in `localStorage`.

## Run locally

```bash
npx serve .      # or just open index.html
```

## Files

- `index.html` — page shell
- `game.js` — the whole game
