# Watchman on the Wall

A playable 2D isometric game about **community care, intercession, and spiritual watchfulness**.

You are the watchman for a small neighborhood congregation. Named members walk the village with
their own hidden burdens. Some are drifting toward the edges of town. Some are carrying weight
nobody else can see. Your job is not to fix people — it is to *see* them in time, and to respond
with the kind of care that actually reaches them.

Built with plain HTML, CSS, and vanilla JavaScript on an HTML5 Canvas. No build step, no
dependencies, no network calls.

## The biblical foundation

| Passage | How it plays |
| --- | --- |
| **Ezekiel 33:7** — *I have made you a watchman* | Alertness on the wall reveals threats approaching the village and surfaces members silently struggling before they fall away. |
| **Galatians 6:1–2** — *restore gently, carry burdens* | Gentle Restoration & Truth rescues from deception — but a hard heart must be softened by intercession first, or the truth wounds. |
| **Hebrews 10:24–25** — *do not neglect meeting together* | Isolation is a burden type; a home visit and a meal is what breaks it. |
| **James 5:16** — *pray for one another* | Secret Intercession costs prayer oil and softens hearts from a distance. |

## Running it

The game uses ES modules, so it must be served over HTTP (opening the file directly will not work).

```bash
# any static server works
python3 -m http.server 12000
# then open http://localhost:12000/
```

## How to play

**The rhythm.** Members wander the village. Click any of them to open their profile. Hearts drift
quietly, so burdens are hidden until you look — or until your alertness is high enough to see the
silent strugglers flickering at the edge of town.

**Keep Watch** spends prayer oil to raise alertness. Alertness decays every week, so the wall has to
be kept. Higher alertness reveals approaching threats sooner, which is the difference between
sounding a warning in time and watching a wolf walk through the gate.

**Burdens grow.** Every burden has a weight and grows week by week. If it reaches full weight, that
member falls away. Bring it back to zero and they are restored — and a restored member paired with a
mentor will carry others later.

### The four care actions

| Action | Cost | Best for |
| --- | --- | --- |
| **Secret Intercession** | Prayer oil | Shame, pride, fear. Softens a hard heart so truth can land. |
| **Home Visit & Meal** | Food, time | Grief, financial strain, family tension, isolation. The only thing that reaches someone who has fallen away. |
| **Gentle Restoration & Truth** | Counsel, time | Deception and offense — **but only after the heart is softened.** On a hard heart it wounds instead of healing. |
| **Pair with a Mature Mentor** | Time, counsel | Hunger for the Word, weariness, new believers. Slows future drift permanently. |

Matching the action to the real burden is worth nearly double. The profile marks the fitting action
with a **fits** tag, and warns with **hard heart** when restoration is unsafe.

### Threats on the horizon

False teachers, whispers of division, cultural drift, discouragement, love of money, and the
hardening of hearts approach from the dark. When you see one, press **Warn** to sound a
scripture-grounded warning. A threat warned in time turns back and strengthens the flock. One that
arrives un-warned seeds burdens in two members.

### Controls

| Key | Action |
| --- | --- |
| `Space` | Pause / resume |
| `1` / `2` | Normal / double speed |
| `J` | Intercession Journal |
| `S` / `L` | Save / load |
| `H` | How to play |
| `M` | Toggle sound |
| `Esc` | Close panel / deselect |
| Drag, scroll | Pan, zoom |

## Seasons

Each season is 12 in-game weeks. Difficulty rises across Spring → Summer → Autumn → Winter. At the
end of each season the game pauses for a **debrief** with three discussion questions written for
elders, cell leaders, and intercessors, plus the season's scripture.

Progress saves to `localStorage`.

## Project structure

```
index.html          markup and HUD shell
css/style.css       all styling
js/config.js        tunable data: seasons, burdens, actions, threats, roster
js/utils.js         math and colour helpers
js/audio.js         procedural sound (synthesised, no asset files)
js/world.js         isometric map, buildings, props, camera
js/members.js       member simulation: vitals, burdens, drift, journal
js/threats.js       threat spawning, approach, and warning
js/renderer.js      canvas rendering
js/ui.js            DOM binding: HUD, profile, journal, modals
js/game.js          orchestration, care actions, weekly ticks, save/load
js/main.js          entry point
```

## Accessibility

Keyboard-operable panels, `aria-live` toasts, labelled controls, and a
`prefers-reduced-motion` path that disables animation.

## Scripture quotations

Quoted from the New International Version (NIV), used here as short quotations for reflection.
