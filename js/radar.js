/* Animated stand-in for an NEA rain-area map tile centred on the transfer station. */

function Radar(canvas) {
  const ctx = canvas.getContext('2d');
  let cells = [];
  let raf = null;
  let scenario = SCENARIOS.moderate;
  let fade = 1;          // 0..1 — scales with how much rain is left

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.max(1, Math.round(r.width  * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: r.width, h: r.height };
  }

  function seed(sc) {
    scenario = sc;
    const { w, h } = size();
    cells = [];
    for (let i = 0; i < sc.cells; i++) {
      cells.push({
        x: Math.random() * w * 1.4 - w * 0.2,
        y: Math.random() * h * 1.4 - h * 0.2,
        r: 8 + Math.random() * 30,
        a: 0.18 + Math.random() * 0.5,
        vx: 0.09 + Math.random() * 0.14,
        vy: -0.05 - Math.random() * 0.08,
      });
    }
  }

  function colorFor(a) {
    // Green → yellow → orange → red, mirroring rain-radar convention.
    const t = Math.min(1, a * (scenario.peak / 22 + 0.35));
    if (t < 0.35) return `rgba(62, 196, 142, ${0.20 + t})`;
    if (t < 0.6)  return `rgba(226, 203, 92, ${0.22 + t * 0.7})`;
    if (t < 0.82) return `rgba(240, 150, 70, ${0.24 + t * 0.6})`;
    return `rgba(232, 84, 84, ${0.26 + t * 0.55})`;
  }

  function draw() {
    const { w, h } = { w: canvas.clientWidth, h: canvas.clientHeight };
    ctx.clearRect(0, 0, w, h);

    // map grid
    ctx.strokeStyle = 'rgba(125, 149, 163, 0.14)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 26) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // rain cells
    ctx.globalCompositeOperation = 'lighter';
    for (const c of cells) {
      c.x += c.vx; c.y += c.vy;
      if (c.x - c.r > w * 1.2) c.x = -w * 0.2;
      if (c.y + c.r < -h * 0.2) c.y = h * 1.2;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, colorFor(c.a * fade));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // station marker
    const cx = w / 2, cy = h / 2;
    ctx.strokeStyle = 'rgba(230, 240, 245, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 16, cy); ctx.lineTo(cx - 12, cy);
    ctx.moveTo(cx + 12, cy); ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy - 12);
    ctx.moveTo(cx, cy + 12); ctx.lineTo(cx, cy + 16); ctx.stroke();
    ctx.fillStyle = '#e6f0f5';
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();

    raf = requestAnimationFrame(draw);
  }

  return {
    start(sc) { if (sc !== scenario || !cells.length) seed(sc); if (!raf) draw(); },
    setFade(f) { fade = Math.max(0.05, Math.min(1, f)); },
    stop() { if (raf) cancelAnimationFrame(raf); raf = null; },
  };
}
