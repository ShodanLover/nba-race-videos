// Editorial style: black and white, leader as a big hero number, ranks 2-10 as a ruled list.
// Same page API as scene.js (setup / frame / skipTo / simulateEvents), so render.js and sound.py work unchanged.
const W = 1080, H = 1920, M = 84;
const TOP_N = 10, LIST_Y = 770, ROW_H = 96;
const BRAND = "CertifiedBucketry";
const LOGO = new Image();
LOGO.src = "assets/logo_mark.png"; // logo.jpg cropped to the artwork
const BORDER = 28; // inset of the frame around the whole video
// end-screen lettering for the brand name (render.js --brand-font <key>)
const BRAND_FONTS = {
  inter: { family: "Inter", weight: 500, size: 64 },
  syncopate: { family: "Syncopate", weight: 700, size: 66, upper: true, spacing: 2 },
  playfair: { family: "Playfair", size: 110 },
};

const out = document.getElementById("out");
const ctx = out.getContext("2d");

let cfg, seasons, players, totalFrames, simFrame = 0;
const EVENTS = [];
let lastTop3 = null, lastLeader = null, leaderCooldown = 0, endTriggered = false;
let hero = { name: "", prev: "", changed: -9, flagged: -9 }, endAt = -1;

function seasonLabel(s) { return `${s - 1}–${String(s).slice(-2)}`; }
function fmt(n) { return Math.round(n).toLocaleString("en-US"); }
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);

// The race runs on a shot clock: seasons are spread evenly over exactly raceFrames, so the last season
// lands as the clock hits 0.0 (no whole-frames-per-season rounding).
function timeline(f) {
  if (f >= cfg.raceFrames) return { i: seasons.length - 1, t: 0, hold: true };
  const pos = (f / cfg.raceFrames) * (seasons.length - 1), i = Math.floor(pos);
  return { i, t: pos - i, hold: false };
}
function clockLeft(f) { return Math.max(0, (cfg.raceFrames - f) / cfg.fps); }

function font(size, family, { weight = 400, spacing = 0, italic = false } = {}) {
  ctx.font = family === "Playfair" ? `italic ${size}px Playfair` : `${italic ? "italic " : ""}${weight} ${size}px "${family}"`;
  ctx.letterSpacing = `${spacing}px`;
}
// largest size <= max at which s fits in maxW
function fit(s, max, family, maxW, opts) { font(max, family, opts); const w = ctx.measureText(s).width; return w > maxW ? Math.floor(max * maxW / w) : max; }
function draw(s, x, y, size, family, color, { align = "left", alpha = 1, ...opts } = {}) {
  font(size, family, opts); ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.globalAlpha = 1;
}
// logo is white on black, so "lighten" drops its black square onto the black background
function logo(cx, cy, w, alpha = 1) {
  const h = w * LOGO.height / LOGO.width;
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = "lighten"; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(LOGO, cx - w / 2, cy - h / 2, w, h); ctx.restore();
}
function brandMark(alpha) {
  logo(W - M - 60, 1800, 120, alpha);
  draw(BRAND, W - M - 136, 1814, 34, "Inter", "#fff", { align: "right", weight: 500, alpha });
}
// width the logo + name take up at the bottom right, so the season year can stay clear of it
function brandWidth() { font(34, "Inter", { weight: 500 }); return ctx.measureText(BRAND).width + 136; }
// thin white frame around the video, plus a thick line that traces it clockwise from the top centre
// as the shot clock runs (progress 0..1), so the frame closes exactly at the buzzer
function frame(progress, alpha = 1) {
  const x0 = BORDER, y0 = BORDER, x1 = W - BORDER, y1 = H - BORDER;
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  if (progress > 0) {
    const pts = [[W / 2, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0], [W / 2, y0]];
    let left = progress * 2 * ((x1 - x0) + (y1 - y0));
    ctx.lineWidth = 8; ctx.lineCap = "square"; ctx.beginPath(); ctx.moveTo(...pts[0]);
    for (let k = 1; k < pts.length && left > 0; k++) {
      const [ax, ay] = pts[k - 1], [bx, by] = pts[k], len = Math.hypot(bx - ax, by - ay), u = Math.min(1, left / len);
      ctx.lineTo(ax + (bx - ax) * u, ay + (by - ay) * u); left -= len;
    }
    ctx.stroke();
  }
  ctx.restore();
}
function rule(y, alpha = 1, x0 = M, x1 = W - M, color = "#fff", h = 2) { ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(x0, y, x1 - x0, h); ctx.globalAlpha = 1; }

window.setup = async (c) => {
  cfg = c; seasons = c.data.seasons;
  totalFrames = c.hookFrames + c.raceFrames + c.holdFrames;
  const sample = "ABCabc0123456789,–?" + c.data.players.map((p) => p.name).join("");
  await Promise.all([document.fonts.load('100px Anton', sample), document.fonts.load('italic 100px Playfair', sample),
    document.fonts.load('400 100px Inter', sample), document.fonts.load('500 100px Inter', sample)]);
  const bf = BRAND_FONTS[c.brandFont] || BRAND_FONTS.syncopate;
  if (bf.family !== "Playfair") await document.fonts.load(`${bf.italic ? "italic " : ""}${bf.weight || 400} 100px "${bf.family}"`, BRAND.toUpperCase() + BRAND);
  await LOGO.decode();
  players = c.data.players.map((p) => ({ ...p, val: 0, rank: 99, y: TOP_N, vy: 0, vis: 0 }));
  return totalFrames;
};

function step(f) {
  const dt = 1 / cfg.fps, time = f / cfg.fps;
  const { i, t, hold } = timeline(f);
  const j = Math.min(i + 1, seasons.length - 1);
  for (const p of players) p.val = p.v[i] + (p.v[j] - p.v[i]) * t;
  const top = players.filter((p) => p.val > 0).sort((a, b) => b.val - a.val).slice(0, TOP_N);
  players.forEach((p) => (p.rank = 99));
  top.forEach((p, r) => (p.rank = r + 1));
  for (const p of players) {
    // list row index: rank 2 -> row 0; the leader slides up out of the list into the hero
    const target = p.rank === 1 ? -1.4 : p.rank <= TOP_N ? p.rank - 2 : TOP_N - 0.6;
    const k = 140, d = 17;
    p.vy += ((target - p.y) * k - p.vy * d) * dt; p.y += p.vy * dt;
    const tv = p.rank >= 2 && p.rank <= TOP_N ? 1 : 0;
    p.vis += (tv - p.vis) * Math.min(1, dt * (tv ? 8 : 12));
    if (p.rank > TOP_N && p.vis < 0.02) p.y = TOP_N - 0.6;
  }
  const leader = top[0];
  if (leader && !hero.name) hero.name = leader.name;
  leaderCooldown -= dt;
  if (leader && lastLeader === null) lastLeader = leader.id;
  if (leader && leader.id !== lastLeader && f > cfg.introFrames && leaderCooldown <= 0 && !hold) {
    hero = { name: leader.name, prev: hero.name, changed: time, flagged: time };
    leaderCooldown = 1.5;
    EVENTS.push({ f, type: "leader", name: leader.name });
    lastLeader = leader.id;
  }
  // a lead change during the cooldown still updates the name, just without a second announcement
  if (leader && leader.name !== hero.name && leaderCooldown <= 0) hero = { ...hero, name: leader.name, prev: hero.name, changed: time };
  const top3 = top.slice(0, 3).map((p) => p.id).join();
  if (lastTop3 && top3 !== lastTop3 && f > cfg.introFrames && !hold) EVENTS.push({ f, type: "swap" });
  lastTop3 = top3;
  if (hold && !endTriggered) { EVENTS.push({ f, type: "end" }); endTriggered = true; endAt = time; }
}

function render(f) {
  const time = f / cfg.fps;
  const { i, t } = timeline(f);
  const j = Math.min(i + 1, seasons.length - 1);
  const intro = easeOut(f / cfg.introFrames);
  const end = endAt >= 0 ? easeOut((time - endAt) / 0.6) : 0;
  // after the buzzer the list clears out, then the follow screen takes its place
  const clear = endAt >= 0 ? easeOut((time - endAt - 0.05) / 0.25) : 0;
  const follow = endAt >= 0 ? easeOut((time - endAt - 0.3) / 0.4) : 0;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);

  // header
  const title = cfg.title.replace("|", " "), titleW = W - 2 * M - 200;
  draw(title, M, 132, fit(title, 34, "Inter", titleW, { weight: 500, spacing: 7 }), "Inter", "#fff", { weight: 500, spacing: 7, alpha: intro });
  draw(cfg.subtitle, M, 180, fit(cfg.subtitle, 28, "Inter", titleW, {}), "Inter", "#fff", { alpha: intro });
  // shot clock: whole seconds from 24, tenths (in red) under 5, like an arena shot clock
  const left = clockLeft(f);
  const clock = left >= 5 ? String(Math.ceil(left)) : (Math.floor(left * 10) / 10).toFixed(1);
  draw(clock, W - M, 196, 120, "Anton", left < 5 ? "#ff3b30" : "#fff", { align: "right", alpha: intro });
  rule(222, intro);

  // hero: the leader
  const leader = players.filter((p) => p.rank === 1)[0];
  draw(end > 0 ? "ALL-TIME NO. 1" : "NO. 1", M, 300, 26, "Inter", "#fff", { weight: 500, spacing: 7, alpha: intro });
  const flag = time - hero.flagged;
  if (flag < 1.8 && end === 0) {
    const a = clamp(flag / 0.12) * clamp((1.8 - flag) / 0.3);
    font(24, "Inter", { weight: 500, spacing: 6 });
    const tw = ctx.measureText("NEW").width + 34;
    ctx.globalAlpha = a; ctx.fillStyle = "#fff"; ctx.fillRect(M + 150, 270, tw, 42); ctx.globalAlpha = 1;
    draw("NEW", M + 150 + 18, 301, 24, "Inter", "#000", { weight: 500, spacing: 6, alpha: a });
  }
  if (leader) {
    const v = fmt(leader.val);
    draw(v, M - 6, 570, fit(v, 270, "Anton", W - 2 * M, {}), "Anton", "#fff", { alpha: intro });
  }
  const ch = time - hero.changed;
  const nameSize = (s) => fit(s, 92, "Playfair", W - 2 * M, {});
  if (ch < 0.35 && hero.prev) draw(hero.prev, M, 680 - easeOut(ch / 0.35) * 30, nameSize(hero.prev), "Playfair", "#fff", { alpha: 1 - ch / 0.35 });
  const inT = hero.prev ? easeOut((ch - 0.15) / 0.45) : 1;
  draw(hero.name, M, 680 + (1 - inT) * 40, nameSize(hero.name), "Playfair", "#fff", { alpha: inT * intro });
  // white rule wipes across on every lead change, and stays full at the end
  const wipe = Math.max(end, ch < 1.6 && hero.prev ? easeOut(ch / 0.5) * clamp((1.6 - ch) / 0.4) : 0);
  rule(730, intro);
  if (wipe > 0) rule(729, 1, M, M + (W - 2 * M) * wipe, "#fff", 4);

  // list: ranks 2-10
  const lead = Math.max(1, leader ? leader.val : 1);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, LIST_Y + (TOP_N - 1) * ROW_H + 8); ctx.clip(); // rows dropping out of the top 10 vanish under the last rule
  for (const p of players) {
    if (p.vis < 0.02) continue;
    const yT = LIST_Y + p.y * ROW_H;
    const stagger = clamp(intro * 1.6 - Math.max(0, p.y) * 0.07);
    const a = p.vis * stagger * (1 - clear) * clamp(1 + p.y * 0.8); // fades as it rises into the hero
    if (a < 0.02) continue;
    if (p.rank >= 2 && p.rank <= TOP_N) draw(String(p.rank).padStart(2, "0"), M, yT + 54, 28, "Inter", "#fff", { alpha: a });
    const nx = M + 82, valW = 230;
    draw(p.name, nx, yT + 54, fit(p.name, 40, "Inter", W - M - nx - valW, { weight: 500 }), "Inter", "#fff", { weight: 500, alpha: a });
    draw(fmt(p.val), W - M, yT + 58, 46, "Anton", "#fff", { align: "right", alpha: a });
    ctx.globalAlpha = a; ctx.fillStyle = "#fff"; ctx.fillRect(nx, yT + 74, (W - M - nx) * (p.val / lead), 3); ctx.globalAlpha = 1;
  }
  ctx.restore();

  // season + brand
  const sl = seasonLabel(seasons[t < 0.5 ? i : j]);
  const yearW = W - 2 * M - brandWidth() - 50;
  draw(sl, M - 2, 1830, fit(sl, 92, "Anton", yearW, {}), "Anton", "#fff", { alpha: intro * (1 - clear) });
  brandMark(intro * (1 - clear));
  frame(Math.min(1, f / cfg.raceFrames));

  if (follow > 0) {
    const rise = (1 - follow) * 40;
    logo(W / 2, 960 + rise, 440, follow);
    draw("FOLLOW FOR MORE", W / 2, 1250 + rise, fit("FOLLOW FOR MORE", 120, "Anton", W - 2 * M, {}), "Anton", "#fff", { align: "center", alpha: follow });
    rule(1290 + rise, follow, W / 2 - 120 * follow, W / 2 + 120 * follow, "#fff", 4);
    const bf = BRAND_FONTS[cfg.brandFont] || BRAND_FONTS.syncopate, bt = bf.upper ? BRAND.toUpperCase() : BRAND;
    const bo = { weight: bf.weight || 400, italic: bf.italic, spacing: bf.spacing || 0 };
    const bs = fit(bt, bf.size, bf.family, W - 2 * M - 40, bo);
    draw(bt, W / 2, 1335 + rise + bs * 0.74, bs, bf.family, "#fff", { align: "center", alpha: follow, ...bo });
  }
  // the follow screen holds, then everything but the logo fades to black
  const outro = endAt >= 0 ? easeOut((time - endAt - 1.9) / 0.6) : 0;
  if (outro > 0) {
    ctx.globalAlpha = outro; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    logo(W / 2, 960, 440);
  }
}

function renderHook(f) {
  const time = f / cfg.fps, dur = cfg.hookFrames / cfg.fps;
  const fade = 1 - easeOut((time - (dur - 0.25)) / 0.25);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  const parts = cfg.hook.split("|");
  const lines = ["WHO IS THE", ...parts.slice(0, -1), parts[parts.length - 1] + "?"];
  const sizes = lines.map((l) => fit(l, 170, "Anton", W - 2 * M, {}));
  const lh = (k) => sizes[k] * 1.04;
  const blockH = lines.reduce((s, _, k) => s + lh(k), 0);
  let y = 960 - blockH / 2;
  draw("QUESTION", M, y - 60, 26, "Inter", "#fff", { weight: 500, spacing: 8, alpha: easeOut(time / 0.3) * fade });
  lines.forEach((l, k) => {
    y += lh(k);
    const p = easeOut((time - 0.1 - k * 0.12) / 0.35);
    ctx.save(); ctx.beginPath(); ctx.rect(0, y - lh(k), W, lh(k) + 8); ctx.clip(); // line slides up out of its own mask
    draw(l, M - 4, y + (1 - p) * lh(k), sizes[k], "Anton", "#fff", { alpha: fade });
    ctx.restore();
  });
  const q = easeOut((time - 0.1 - lines.length * 0.12 - 0.12) / 0.4);
  draw("Drop your answer in the comments.", M, y + 110 + (1 - q) * 16, 54, "Playfair", "#fff", { alpha: q * fade });
  rule(y + 40, q * fade, M, M + (W - 2 * M) * q, "#fff", 4);
  brandMark(fade);
  frame(0); // stays put through the cut to the race
}

function simulateTo(f) { // inclusive
  while (simFrame <= f) { if (simFrame >= cfg.hookFrames) step(simFrame - cfg.hookFrames); simFrame++; }
}
window.frame = (f) => {
  simulateTo(f);
  f < cfg.hookFrames ? renderHook(f) : render(f - cfg.hookFrames);
  return out.toDataURL("image/jpeg", 0.92);
};
window.skipTo = (f) => simulateTo(f - 1);
window.simulateEvents = () => {
  simulateTo(totalFrames - 1);
  // one clock tick per shot-clock second (24 of them); the buzzer goes on the "end" event at 0.0
  const clockFrames = [];
  for (let k = 0; k * cfg.fps < cfg.raceFrames; k++) clockFrames.push(cfg.hookFrames + k * cfg.fps);
  return { style: "editorial", fps: cfg.fps, hookFrames: cfg.hookFrames, raceFrames: cfg.raceFrames, totalFrames,
    events: EVENTS.map((e) => ({ ...e, f: e.f + cfg.hookFrames })), clockFrames };
};
window.ready = true;
