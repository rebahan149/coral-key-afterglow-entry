[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rebahan149/coral-key-afterglow-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rebahan149/coral-key-afterglow-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# CORAL KEY: AFTERGLOW

An original open-world driving-and-mayhem game set in **Coral Key**, a tropical
island city caught forever at golden hour — warm sunset light, long shadows,
sparkling water, and neon waking up along the shore.

You arrive by ferry as an outsider driver-for-hire with empty pockets and a
borrowed name. Take jobs, earn money and **respect**, and climb the island's
underworld from dock errands to a gold convertible and one last run at sunset.

## The city

- **Warehouse Docks** — cranes, containers and sealed crates on the west quay.
- **Ocean Drive** — a pastel art-deco strip with neon signs along the south waterfront.
- **The Marina** — boardwalk, moored yachts and the lighthouse point.
- **Downtown** — palm-lined boulevards and lit towers in the centre.
- **Hill Villas** — quiet money above the bay, in the north.

## Features

- Free-roam on foot or in any car (traffic AI, carjacking, arcade drift handling).
- **8 story jobs** with dialogue, objective markers, timers and respect gating.
- **Coral Key PD**: a 0–5 star wanted system with pursuit cars, roadblocks from
  3 stars, a searchlight helicopter from 4 stars, bust and wasted states.
- **Weapon wheel** — fists, pistol, SMG — with hitscan tracers and real consequences.
- **Garage**: paint, engine and armour upgrades bought with job money, saved between visits.
- **3 synth radio stations** (tropical, synthwave, steel drum), engine and SFX audio.
- Minimap with mission and police blips, pause and help screens, localStorage saves.
- **Photo mode**: open the game with `#shot=cover`, `#shot=chase`, `#shot=marina`
  or `#shot=garage` in the URL to jump straight into a staged scene for pictures.

## Controls

| Action | Key |
| --- | --- |
| Move / drive | W A S D |
| Sprint | Shift |
| Jump | Space |
| Enter / exit car | F |
| Handbrake / drift | Space (in car) |
| Camera | Mouse (click the game to lock) |
| Weapons | 1 / 2 / 3, wheel with Q, fire with mouse click |
| Advance dialogue / interact | E |
| Radio station | R (in car) |
| Garage | G (in car) |
| Pause | P or Esc |
| Help | H |

## Layout

- `main.ts` — the hand-in program; copies `game/` + `screenshots/` to the output
  directory and writes `dossier.json` via `vendor/makefun-game.ts`.
- `game/index.html` — the page; loads `vendor/three.min.js` (three.js r160) and
  then the classic scripts in `game/js/` in order: `util`, `audio`, `world`,
  `vehicles`, `player`, `police`, `combat`, `missions`, `hud`, `main`.
- `screenshots/` — four captures of the running game; the first is the cover.

MIT licensed — see `LICENSE`.
