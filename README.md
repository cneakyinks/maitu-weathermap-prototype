# MaiTuMap — surfacing-report prototype

A clickable prototype of the core MaiTuMap idea: a commuter on a multi-leg journey
loses sight of the sky while underground, and gets blindsided by rain at the one
transfer where they're exposed. MaiTuMap reads the rain area over that specific
station and delivers a **surfacing report** a few minutes before they come up.

Open `index.html` in a browser. No build step, no dependencies.

Visual language follows iOS (HIG colors, SF system font, grouped cards, native-style
status bar). The home screen's app grid is decorative filler — generic icons, not real
apps or logos — except the MaiTuMap tile, which uses a small shield-and-pin mark
inspired by the real MaiTuMaps logo (kept as an icon only; the wordmark isn't repeated
throughout the app).

## What it demonstrates

The claim being tested is that **duration, not intensity, should drive the advice.**
The same prototype produces three genuinely different responses:

| Reading | Duration | Verdict | What the app does |
|---|---|---|---|
| Light drizzle | 6 min | `proceed` | Reassures and gets out of the way. No decision asked for. |
| Moderate rain | 26 min | `detour` | Offers sheltered options that *fit the wait*, then holds a countdown. |
| Heavy showers | 55 min | `push` | Says waiting buys nothing. Cross now — with a prep checklist if you insist on waiting. |

The detour list is filtered by whether the activity actually fits the remaining rain —
each option only appears if its round trip fits inside the wait, which is why the
25-minute library stop shows up for the slower end of the `detour` band but drops out
for the 26-minute one.

## The flow

The primary path starts from a plain iOS-style **home screen** — a generic app grid,
no MaiTuMap chrome — because the whole point of the idea is that it reaches you
*before* you'd think to open a weather app. After a beat, a push notification drops
in ("Rain ahead at Buona Vista — intermittent rain expected when you arrive"),
exactly like a real proactive alert would. Tapping it drops straight into the
surfacing report — nothing to configure first, because the trip's already saved.

0. **Home** — the generic app grid + dock. One tile is real: **MaiTuMap** (the
   shield-and-pin mark), which opens the manual path below instead of waiting for
   the notification.
1. *(manual path only)* **Trip planner** — "Where to?": the one saved route
   (COM3 → home), an **urgency** setting (`Relaxed`/`Normal`/`Urgent`) and a
   **departure time**. Both are functional, not decorative — see below. Reached from
   the saved-route screen's `Edit trip` link, not required to start a journey.
2. **Saved route** — six legs, two flagged `exposed`: the CC → EW open-air link at
   Buona Vista (the main transfer), and the short open walk home from Blk 505.
3. **In transit** — sonar-style "submerged, no surface view" while underground.
   Tapping the home-screen notification drops you here directly, one leg out from
   the transfer, with the report already opening.
4. **Surfacing report** — fires `LEAD_TIME_MIN` (4 min) before the exposed transfer,
   as a **dismissible sheet over the transit view**, not a full-screen takeover — the
   map underneath stays "live." The verdict leads, with the radar/readout/forecast
   strip underneath as the "why." **The clock is frozen while it's open**: it's a
   decision point, so the numbers and buttons don't shift under you. Closing with ✕
   doesn't skip the decision — it parks a reminder pill that reopens the same sheet.
5. **Detour / wait / push** — countdown ring for detour/wait, closes the loop with an
   all-clear notification. Push now also offers a ride-share option that skips the
   exposed transfer entirely, for when waiting is off the table.
6. **Quick check** — right before the final open stretch home, a lightweight go/hold
   card reusing whatever's left of the same rain event. No map, no detour catalog —
   just a call, because a 4-minute walk doesn't need the full ritual.
7. **Arrived** — door-to-door time vs. a dry day, and whether the laptop stayed dry.

## Urgency & departure time

Set on the trip-planner screen, both feed real logic in `js/data.js`/`js/app.js`:

- **Departure time** replaces the app's simulated clock start — every timestamp shown
  (leg ETAs, "you surface", "home by") shifts with it.
- **Urgency** shifts the duration thresholds that decide `proceed`/`detour`/`push`
  (`URGENCY_THRESHOLDS` in `js/data.js`). `Normal` keeps today's exact numbers
  (≤10 min proceed, ≤35 min detour, else push). `Urgent` pushes through sooner;
  `Relaxed` is willing to wait or detour longer before giving up on the rain clearing.
  This personalizes the verdict on top of the existing thesis — duration still drives
  it, now scaled by how much time *you* can spare.

## Demo rig

The left panel is scaffolding, not product. It forces any rain reading, changes clock
speed (one simulated minute per tick), and shows live state.

URL hooks for demos and screenshots — any of these also skips the home screen/
notification and drops straight into the saved-route flow:

```
?sc=heavy               # preselect a scenario
?sc=moderate&auto=1     # start the journey immediately
?...&pick=detour0       # auto-take a branch: proceed | push | carpool | wait | detour0..detour3
```

## What's mocked

- **Rain data.** `SCENARIOS` + `buildForecast()` in `js/data.js` stand in for an NEA
  rain-area feed. The radar in `js/radar.js` is a generated animation, not real tiles.
  A real build would read the radar tile for the station's 1 km cell and derive
  duration by tracking cell motion.
- **Route + position.** `JOURNEY` is a fixed six-leg route with hardcoded durations.
  Real timing would come from a journey-planning API plus live train arrivals.
- **The exposure flag.** `exposure: 'exposed'` is hand-labelled. This is the piece that
  needs real data — which transfers are actually open to the sky — and it's the whole
  premise, so it's worth validating before anything else.

## Files

```
index.html      view shells
css/styles.css  all styling
js/data.js      route, rain scenarios, forecast curve, verdict logic
js/radar.js     canvas rain-area animation
js/app.js       state machine
```
