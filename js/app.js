/* MaiTuMap prototype — journey state machine. */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const CIRC = 2 * Math.PI * 52;

const legs = JOURNEY.legs;
const cumStart = legs.reduce((a, l, i) => (a.push(i ? a[i - 1] + legs[i - 1].mins : 0), a), []);
const criticalIdx = legs.findIndex(l => l.critical);
const transferStart = cumStart[criticalIdx];
const totalMins = cumStart.at(-1) + legs.at(-1).mins;

const radar = Radar($('#radarCanvas'));

/* Set on the trip-planner screen; persists across reset() so the demo rig's
   scenario/speed buttons (which call reset() on every click) don't lose it. */
let tripConfig = { urgency: 'normal', departMin: 18 * 60 + 42 };

let S, timer;

function reset() {
  clearInterval(timer);
  radar.stop();
  S = {
    sc: SCENARIOS[($('#scenarioSeg .is-on') || {}).dataset?.sc || 'moderate'],
    speed: +($('#speedSeg .is-on').dataset.ms),
    urgency: tripConfig.urgency,
    departMin: tripConfig.departMin,
    mode: 'idle',            // idle | transit | wait | done
    simMin: 0,
    legIdx: 0,
    legElapsed: 0,
    reportFired: false,
    quickFired: false,
    rainStart: null,
    path: null,              // proceed | detour | push | carpool | wait
    detour: null,
    wetCrossing: false,
  };
  S.forecast = buildForecast(S.sc);
  hideReportUI();
  show('journey');
  renderJourney();
  paintRig();
}

function hideReportUI() {
  $('#quickCheck').hidden = true;
  $('#reportPill').hidden = true;
  $('#reportModal').hidden = true;
  $('#modalScrim').hidden = true;
}

/* ── helpers ──────────────────────────────────────────────── */
const journeyMin = () => cumStart[Math.min(S.legIdx, legs.length - 1)] + S.legElapsed;
const rainT      = () => (S.rainStart === null ? -1 : S.simMin - S.rainStart);
const rainLeft   = () => (S.rainStart === null ? 0 : Math.max(0, S.sc.durationMin - rainT()));
const intensity  = () => (S.rainStart === null ? 0 : (S.forecast[rainT()] ?? 0));
const minsToTransfer = () => transferStart - journeyMin();

function hhmm(m) {
  const t = (S.departMin + m) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}

function show(name) {
  $$('.view').forEach(v => { v.hidden = v.dataset.view !== name; });
  const v = $(`.view[data-view="${name}"]`);
  if (v) { v.style.animation = 'none'; void v.offsetWidth; v.style.animation = ''; }
  $('#views').scrollTop = 0;
  $('.phone__screen').classList.toggle('on-home', name === 'iosHome');
  S && (S.view = name);
}

function notify(title, text, ms = 4200) {
  $('#notifTitle').textContent = title;
  $('#notifText').textContent = text;
  const n = $('#notif');
  n.hidden = false;
  $('.phone__screen').classList.add('is-notif');
  clearTimeout(notify._t);
  notify._t = setTimeout(hideNotif, ms);
}

/* ── rendering ────────────────────────────────────────────── */
function legMarkup(l, i, mini) {
  const done = i < S.legIdx, now = i === S.legIdx && S.mode !== 'idle';
  const cls = ['leg', l.exposure === 'exposed' ? 'is-exposed' : '', done ? 'is-done' : '', now ? 'is-now' : ''].join(' ');
  const tag = { covered: 'Sheltered', underground: 'Underground', elevated: 'Elevated', exposed: 'Exposed' }[l.exposure];
  return `<li class="${cls}">
    <div class="leg__rail"><span class="leg__dot"></span><span class="leg__line"></span></div>
    <div class="leg__body">
      <div class="leg__title">${l.title}</div>
      <div class="leg__sub">${l.sub} · ${l.mins} min</div>
      ${mini ? '' : `<span class="leg__tag">${tag}</span>`}
    </div></li>`;
}

function renderJourney() {
  $('#journeyMeta').textContent = `${JOURNEY.saved} · ${totalMins} min · departs ${hhmm(0)}`;
  $('#leadLabel').textContent = `${LEAD_TIME_MIN} minutes`;
  $('#legList').innerHTML = legs.map((l, i) => legMarkup(l, i, false)).join('');
}

function renderTransit() {
  const l = legs[S.legIdx];
  if (!l) return;
  const submerged = l.exposure === 'underground';
  $('#transitState').textContent = submerged ? 'Submerged · no surface view' : 'Surfaced';
  $('#transitLeg').textContent = l.title;
  $('#transitSub').textContent = l.sub;
  $('#sonarCore').textContent = Math.max(0, l.mins - S.legElapsed);
  $('#transitBar').style.width = `${(S.legElapsed / l.mins) * 100}%`;
  const left = totalMins - journeyMin();
  $('#transitEta').textContent =
    `${left} min to go · arriving ~${hhmm(S.simMin + left)}` +
    (minsToTransfer() > 0 ? `  |  surfacing at Buona Vista in ${minsToTransfer()} min` : '');
  $('#legListMini').innerHTML = legs.map((x, i) => legMarkup(x, i, true)).join('');
}

function renderReport() {
  const sc = S.sc, v = verdictFor(sc, S.urgency), b = bandOf(intensity());
  const surfacing = Math.max(0, minsToTransfer());

  $('#reportHead').textContent  = `${sc.label} over Buona Vista`;
  $('#reportBlurb').textContent = sc.blurb;
  $('#radarChip').textContent   = `Rain-area map · ${hhmm(S.simMin)} · 1 km grid`;
  $('#roIntensity').textContent = `${b.label} · ${intensity().toFixed(1)} mm/h`;
  $('#roEnds').textContent      = `${rainLeft()} min`;
  $('#roSurface').textContent   = `${surfacing} min`;

  // 60-minute forecast strip
  const peak = Math.max(sc.peak, 1);
  $('#tlBars').innerHTML = Array.from({ length: 60 }, (_, t) => {
    const mm = S.forecast[rainT() + t] ?? 0;
    const h = mm <= 0 ? 2 : 4 + (mm / peak) * 48;
    const col = mm <= 0 ? 'var(--panel-2)'
      : mm < 2.5 ? 'rgba(61,220,151,.55)'
      : mm < 10  ? 'rgba(226,203,92,.75)'
      : mm < 50  ? 'rgba(240,150,70,.85)' : 'rgba(232,84,84,.9)';
    return `<i class="${t === surfacing ? 'is-mark' : ''}" style="height:${h}px;background:${col}"></i>`;
  }).join('');

  const vd = $('#verdict');
  vd.className = 'verdict v-' + v;
  const copy = {
    proceed: ['Keep going', `It's ${rainLeft()} minutes of drizzle and you'll be under cover on the EW platform before the worst of it. Not worth changing anything.`],
    detour:  ['Worth waiting', `${rainLeft()} minutes is too long to stand around, but too short to justify getting soaked. Spend it somewhere useful — you'll still be home by ${hhmm(S.simMin + rainLeft() + (totalMins - journeyMin()))}.`],
    push:    ['Push through now', `This is set in for ${rainLeft()} minutes and it isn't easing. Waiting buys you nothing — cross now while you still control the timing, laptop sealed.`],
  }[v];
  $('#verdictKicker').textContent = copy[0];
  $('#verdictLine').textContent   = copy[1];

  $('#reportActions').innerHTML = {
    proceed: `<button class="btn btn--primary" data-act="proceed">Got it — keep going</button>`,
    detour:  DETOURS.filter(d => d.mins + d.walk * 2 <= rainLeft() + 8)
               .map((d, i) => `<button class="opt" data-act="detour" data-i="${DETOURS.indexOf(d)}">
                  <span class="opt__icon">${d.icon}</span>
                  <span class="opt__main"><span class="opt__name">${d.name}</span>
                  <span class="opt__meta">${d.where} · ${d.walk} min covered walk · ${d.tag}</span></span>
                  <span class="opt__fit">${d.mins}m fit</span></button>`).join('')
             + `<button class="btn btn--ghost" data-act="push">Push through anyway</button>`,
    push:    `<button class="btn btn--stop" data-act="push">Cross now, laptop sealed</button>
              <button class="opt" data-act="carpool">
                 <span class="opt__icon">🚗</span>
                 <span class="opt__main"><span class="opt__name">Grab a ride-share</span>
                 <span class="opt__meta">Skips the transfer entirely · ~${CARPOOL_MINS} min to your door</span></span>
               </button>
              <button class="btn btn--ghost" data-act="wait">Wait it out anyway</button>`,
  }[v];

  radar.start(sc);
  radar.setFade(1);
}

function renderWait() {
  const left = rainLeft();
  const total = S.sc.durationMin - (S.waitFrom - S.rainStart);
  $('#countNum').textContent = left;
  $('#countProg').style.strokeDashoffset = CIRC * (1 - (total ? left / total : 0));
  $('#detourFoot').textContent = `Rain clears ~${hhmm(S.simMin + left)} · home by ~${hhmm(S.simMin + left + (totalMins - journeyMin()))}`;
}

function paintRig() {
  $('#rigState').innerHTML = `
    <dt>view</dt><dd>${S.view || '—'}</dd>
    <dt>clock</dt><dd>${hhmm(S.simMin)}</dd>
    <dt>journey</dt><dd>${journeyMin()}/${totalMins} min</dd>
    <dt>rain left</dt><dd>${S.rainStart === null ? '—' : rainLeft() + ' min'}</dd>
    <dt>urgency</dt><dd>${S.urgency}</dd>
    <dt>branch</dt><dd>${S.path || '—'}</dd>`;
  $('#clock').textContent = hhmm(S.simMin);
}

/* ── the clock ────────────────────────────────────────────── */
function startClock() {
  clearInterval(timer);
  timer = setInterval(tick, S.speed);
}

function tick() {
  S.simMin++;

  if (S.mode === 'transit') {
    S.legElapsed++;
    const l = legs[S.legIdx];
    if (S.legElapsed >= l.mins) { S.legIdx++; S.legElapsed = 0; }

    if (!S.reportFired && minsToTransfer() <= LEAD_TIME_MIN && S.legIdx <= criticalIdx) return fireReport();
    if (!S.quickFired && S.legIdx === legs.length - 1 && S.legElapsed === 0) return fireQuickCheck();
    if (S.legIdx >= legs.length) return finish();
    renderTransit();
  }

  if (S.mode === 'wait') {
    radar.setFade(rainLeft() / S.sc.durationMin);
    if (rainLeft() <= 0) return allClear();
    renderWait();
  }

  paintRig();
}

/* ── home screen → notification entry ────────────────────────
   Simulates a proactive push arriving before the commuter even surfaces —
   tapping it drops straight into the same report/verdict machinery used
   by the manual walkthrough, just entered earlier. */
function showHomeNotification() {
  $('#homeNotifTitle').textContent = 'Rain ahead at Buona Vista';
  $('#homeNotifText').textContent = `${S.sc.label} expected when you arrive — tap for your surfacing report.`;
  $('#homeNotif').hidden = false;
}

function enterFromNotification() {
  $('#homeNotif').hidden = true;
  S.mode = 'transit';
  S.legIdx = criticalIdx - 1;   // the leg immediately before the exposed transfer
  S.legElapsed = 0;
  show('transit');
  renderTransit();
  fireReport();
}

/* ── transitions ──────────────────────────────────────────── */
function start() {
  S.mode = 'transit';
  show('transit');
  renderTransit();
  startClock();
}

function fireReport() {
  clearInterval(timer);          // the report is a decision point — hold the clock
  S.mode = 'paused';
  S.reportFired = true;
  S.rainStart = S.simMin;
  S.waitFrom = S.simMin;
  S.forecast = buildForecast(S.sc);
  notify(`Surfacing in ${LEAD_TIME_MIN} minutes`, `${S.sc.label} at Buona Vista — tap for the report`);
  openReportModal();          // unhide before rendering — radar.start() measures the canvas
  renderReport();
  paintRig();
}

/* The report floats over whatever's behind it (the transit view) rather than
   replacing it — closing with X doesn't skip the decision, it just parks a
   reminder pill until you come back to it. */
function openReportModal() {
  $('#reportPill').hidden = true;
  $('#modalScrim').hidden = false;
  $('#reportModal').hidden = false;
}
function closeReportModal() {
  $('#modalScrim').hidden = true;
  $('#reportModal').hidden = true;
  $('#reportPill').hidden = false;
}

/* Second exposed point on the route: the short open walk from Blk 505.
   Too short for a full report — just a quick go/hold call using whatever's
   left of the same rain event. */
function fireQuickCheck() {
  clearInterval(timer);
  S.mode = 'paused';
  S.quickFired = true;
  const left = rainLeft();
  $('#qcKicker').textContent = left > 0 ? 'One more open stretch' : 'Home stretch · skies clear';
  $('#qcLine').textContent = left > 0
    ? `Still ${bandOf(intensity()).label.toLowerCase()} near your block, ~${left} min left. Short walk, but it's open the whole way.`
    : `The rain that hit Buona Vista has moved on. Straight home, no detour needed.`;
  $('#qcActions').innerHTML = left > 0
    ? `<button class="btn btn--primary" data-qc="go">Cross now, brolly out</button>
       <button class="btn btn--ghost" data-qc="hold">Hold ${Math.min(5, left)} min under the void deck</button>`
    : `<button class="btn btn--primary" data-qc="go">Got it — straight home</button>`;
  $('#quickCheck').hidden = false;
  renderTransit();
  paintRig();
}

function chooseProceed() { hideReportUI(); S.path = 'proceed'; resumeTransit(); }

function choosePush() {
  hideReportUI();
  S.path = 'push';
  S.wetCrossing = intensity() > 2.5;
  resumeTransit();
}

function chooseCarpool() {
  hideReportUI();
  S.path = 'carpool';
  S.wetCrossing = false;
  S.simMin += CARPOOL_MINS;
  S.legIdx = legs.length;
  resumeTransit();
}

function chooseWait(kind, opt) {
  hideReportUI();
  S.path = kind;                 // 'detour' | 'wait'
  S.detour = opt || null;
  // You still ride out the rest of the current leg before you can stop anywhere —
  // and those minutes come off the rain clock.
  S.simMin += Math.max(0, minsToTransfer());
  S.legIdx = criticalIdx;
  S.legElapsed = 0;
  S.waitFrom = S.simMin;
  $('#detourEyebrow').textContent = kind === 'detour' ? 'Detour in progress' : 'Waiting at the platform';
  $('#detourTitle').textContent   = opt ? `${opt.icon} ${opt.name}` : 'Sheltered at Buona Vista';
  $('#detourSub').textContent     = opt
    ? `${opt.where} · ${opt.walk} min covered walk from the transfer. We'll ping you when the rain clears.`
    : `Nothing here shortens the wait, so make it survivable. We'll ping you when it clears.`;
  $('#checkList').innerHTML = kind === 'wait'
    ? CHECKLIST.map(c => `<li>${c}</li>`).join('')
    : '';
  S.mode = 'wait';
  show('detour');
  renderWait();
  startClock();
}

function allClear() {
  clearInterval(timer);
  radar.setFade(0.05);
  notify('All clear at Buona Vista', 'Rain has passed. Safe to resume.', 6000);
  show('resume');
  $('#resumeSub').textContent =
    `You waited ${S.simMin - S.waitFrom} min. ${legs.length - S.legIdx} legs left — about ${totalMins - journeyMin()} min to your door.`;
  S.mode = 'paused';
  paintRig();
}

function resumeTransit() {
  radar.stop();
  S.mode = 'transit';
  if (S.legIdx >= legs.length) return finish();
  show('transit');
  renderTransit();
  startClock();
}

function finish() {
  clearInterval(timer);
  radar.stop();
  S.mode = 'done';
  const delay = S.simMin - totalMins;
  const laptop = S.wetCrossing ? 'Sleeve damp, machine dry' : 'Dry';
  $('#arrivedHead').textContent = S.wetCrossing ? "You're home — a bit wet" : "You're home, dry";
  $('#arrivedSub').textContent  = {
    proceed: 'You never broke stride. The drizzle was a non-event, which is exactly what the report told you.',
    detour:  `You turned dead waiting time into ${S.detour ? S.detour.tag.toLowerCase() : 'a break'} and still got home without a soaking.`,
    push:    'You crossed on your own timing instead of standing around hoping. The laptop stayed sealed.',
    carpool: 'You called a ride from the transfer — pricier, but you skipped the rain and the wait entirely.',
    wait:    'You sat it out fully prepared rather than gambling on a gap that was never coming.',
  }[S.path] || '';
  $('#summary').innerHTML = `
    <dt>Departed</dt><dd>${hhmm(0)}</dd>
    <dt>Arrived</dt><dd>${hhmm(S.simMin)}</dd>
    <dt>vs. a dry day</dt><dd>${delay > 0 ? '+' + delay + ' min' : 'on time'}</dd>
    <dt>Rain met</dt><dd>${S.sc.label}</dd>
    <dt>Laptop</dt><dd>${laptop}</dd>`;
  show('arrived');
  paintRig();
}

/* ── wiring ───────────────────────────────────────────────── */
$('#maituIcon').onclick   = () => show('journey');
$('#editTripBtn').onclick = () => show('planner');
$('#homeNotif').onclick   = enterFromNotification;
$('#startBtn').onclick  = start;
$('#resumeBtn').onclick = resumeTransit;
$('#againBtn').onclick  = reset;
$('#resetBtn').onclick  = reset;
$('#skipWaitBtn').onclick = () => { S.wetCrossing = intensity() > 2.5; resumeTransit(); };

$('#mapTeaser').textContent = `First leg · ${legs[0].title} · ${legs[0].mins} min`;

$('#urgencySeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#urgencySeg button').forEach(x => x.classList.toggle('is-on', x === b));
});

$('#plannerContinueBtn').onclick = () => {
  const urgency = ($('#urgencySeg .is-on') || {}).dataset?.urgency || 'normal';
  const [dh, dm] = ($('#departInput').value || '18:42').split(':').map(Number);
  tripConfig = { urgency, departMin: (Number.isFinite(dh) ? dh : 18) * 60 + (Number.isFinite(dm) ? dm : 42) };
  reset();
};

$('#reportClose').onclick = closeReportModal;
$('#reportPill').onclick  = openReportModal;

$('#reportActions').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'proceed') chooseProceed();
  if (act === 'push')    choosePush();
  if (act === 'carpool') chooseCarpool();
  if (act === 'wait')    chooseWait('wait', null);
  if (act === 'detour')  chooseWait('detour', DETOURS[+b.dataset.i]);
});

$('#quickCheck').addEventListener('click', e => {
  const b = e.target.closest('[data-qc]');
  if (!b) return;
  $('#quickCheck').hidden = true;
  if (b.dataset.qc === 'hold') S.simMin += Math.min(5, rainLeft());
  else S.wetCrossing = S.wetCrossing || intensity() > 2.5;
  paintRig();
  resumeTransit();
});

$('#checkList').addEventListener('click', e => {
  const li = e.target.closest('li');
  if (li) li.classList.toggle('is-done');
});

function hideNotif() {
  $('#notif').hidden = true;
  $('.phone__screen').classList.remove('is-notif');
}
$('#notif').addEventListener('click', hideNotif);

$('#scenarioSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#scenarioSeg button').forEach(x => x.classList.toggle('is-on', x === b));
  $('#scenarioHint').textContent = SCENARIOS[b.dataset.sc].blurb;
  reset();
});

$('#speedSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#speedSeg button').forEach(x => x.classList.toggle('is-on', x === b));
  S.speed = +b.dataset.ms;
  if (S.mode === 'transit' || S.mode === 'wait') startClock();
});

/* Dev hook for screenshots / demos: ?sc=heavy&auto=1 */
const qs = new URLSearchParams(location.search);
if (SCENARIOS[qs.get('sc')]) $('#scenarioSeg button[data-sc="' + qs.get('sc') + '"]').click();
else reset();
$('#scenarioHint').textContent = S.sc.blurb;
if (!qs.get('sc') && !qs.get('auto')) {
  show('iosHome');
  setTimeout(showHomeNotification, 2200);
}
if (qs.get('auto')) {
  start();
  // ?pick=proceed|push|wait|detour0 — jump straight to a branch, for demos and screenshots.
  const pick = qs.get('pick');
  if (pick) {
    const waitFor = () => !$('#reportModal').hidden
      ? ({ proceed: chooseProceed, push: choosePush, carpool: chooseCarpool, wait: () => chooseWait('wait', null) }[pick]
         || (() => chooseWait('detour', DETOURS[+pick.replace('detour', '') || 0])))()
      : setTimeout(waitFor, 30);
    waitFor();
  }
}
