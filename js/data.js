/* MaiTuMap — mock data layer.
   Stands in for: saved-route storage + NEA rain-area radar feed. */

const LEAD_TIME_MIN = 4;   // how early the surfacing report fires before an exposed transfer
const CARPOOL_MINS = 16;   // ride-share from the transfer straight to the door, skipping the rest of the route

const JOURNEY = {
  label: 'Home from campus',
  saved: 'Weekdays · 18:00–20:30',
  legs: [
    { id: 'w1', mode: 'walk',     title: 'COM3 → Kent Ridge MRT',      sub: 'Sheltered walkway',        mins: 7,  exposure: 'covered' },
    { id: 'm1', mode: 'mrt',      title: 'Kent Ridge → Buona Vista',   sub: 'Circle Line',              mins: 4,  exposure: 'underground', line: 'CC' },
    { id: 'tx', mode: 'transfer', title: 'Transfer at Buona Vista',    sub: 'CC → EW · open-air link',  mins: 5,  exposure: 'exposed', critical: true },
    { id: 'm2', mode: 'mrt',      title: 'Buona Vista → Jurong East',  sub: 'East–West Line',           mins: 11, exposure: 'elevated', line: 'EW' },
    { id: 'b1', mode: 'bus',      title: 'Jurong East Int → Blk 505',  sub: 'Service 160',              mins: 14, exposure: 'covered' },
    { id: 'w2', mode: 'walk',     title: 'Blk 505 → Home',             sub: 'Short open stretch',       mins: 4,  exposure: 'exposed' },
  ],
};

/* Three rain-area readings for the Buona Vista cell. */
const SCENARIOS = {
  light: {
    key: 'light',
    label: 'Light drizzle',
    peak: 2.1,
    durationMin: 6,
    cells: 14,
    blurb: 'Patchy drizzle drifting north-east, already thinning.',
  },
  moderate: {
    key: 'moderate',
    label: 'Moderate rain',
    peak: 12.4,
    durationMin: 26,
    cells: 42,
    blurb: 'A compact cell sitting over Buona Vista, moving slowly.',
  },
  heavy: {
    key: 'heavy',
    label: 'Heavy thundery showers',
    peak: 44.0,
    durationMin: 55,
    cells: 90,
    blurb: 'Wide band across the south-west. Not clearing any time soon.',
  },
};

/* Per-minute intensity curve (mm/hr), index = minutes since rain onset. */
function buildForecast(sc) {
  const out = [];
  for (let t = 0; t < 120; t++) {
    if (t >= sc.durationMin) { out.push(0); continue; }
    const p = t / sc.durationMin;
    let v;
    if (p < 0.12)      v = sc.peak * (0.4 + (p / 0.12) * 0.6);
    else if (p < 0.72) v = sc.peak * (0.86 + 0.14 * Math.sin(((p - 0.12) / 0.6) * Math.PI));
    else               v = sc.peak * 0.86 * (1 - (p - 0.72) / 0.28);
    out.push(Math.max(0.2, +v.toFixed(1)));
  }
  return out;
}

function bandOf(mmhr) {
  if (mmhr <= 0)    return { key: 'none',     label: 'Dry' };
  if (mmhr < 2.5)   return { key: 'light',    label: 'Light' };
  if (mmhr < 10)    return { key: 'moderate', label: 'Moderate' };
  if (mmhr < 50)    return { key: 'heavy',    label: 'Heavy' };
  return              { key: 'violent',  label: 'Violent' };
}

/* Verdict is driven by DURATION, not intensity — the core of the idea.
   Urgency shifts the thresholds: how much time YOU can spare, not the weather. */
const URGENCY_THRESHOLDS = {
  relaxed: { proceed: 14, detourMax: 45 },
  normal:  { proceed: 10, detourMax: 35 },
  urgent:  { proceed: 6,  detourMax: 20 },
};

function verdictFor(sc, urgency = 'normal') {
  const t = URGENCY_THRESHOLDS[urgency] || URGENCY_THRESHOLDS.normal;
  if (sc.durationMin <= t.proceed) return 'proceed';
  if (sc.durationMin <= t.detourMax) return 'detour';
  return 'push';
}

/* Sheltered options within reach of the Buona Vista transfer. */
const DETOURS = [
  { name: 'Koufu food court',   where: 'The Star Vista',  walk: 3, mins: 18, tag: 'Proper meal',   icon: '🍜' },
  { name: 'Toast Box',          where: 'Rochester Mall',  walk: 5, mins: 14, tag: 'Coffee + kaya', icon: '☕️' },
  { name: 'FairPrice Finest',   where: 'The Star Vista',  walk: 3, mins: 10, tag: 'Grab groceries',icon: '🛒' },
  { name: 'Library@Rochester',  where: 'Rochester Mall',  walk: 5, mins: 25, tag: 'Sit and work',  icon: '📚' },
];

const CHECKLIST = [
  'Laptop into the dry sleeve, zip facing down',
  'Raincoat — side pocket of your bag',
  'Phone to 80%+ before you lose signal again',
  'Grab a snack now, not at the platform',
];
