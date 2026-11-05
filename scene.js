import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { makeBallMaterial, BALL_TILT } from "./ball.js";

const W = 1080, H = 1920;
const PALETTE = ["#ff3e9a", "#ffcc1f", "#22d3ff", "#62ff4a", "#a259ff", "#ff7a1f",
                 "#3d6bff", "#ff4747", "#16e6a6", "#ff8ad8", "#c6ff1f", "#00b3ff"];
const TOP_N = 10, GAP = 1.25, Y_TOP = 5.5, X0 = -3.55, MAX_LEN = 6.3;
const BAR_R = 0.4, BALL_R = 0.6;

// ---------- deterministic RNG ----------
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

const out = document.getElementById("out");
const octx = out.getContext("2d");
const glCanvas = document.createElement("canvas");
glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a5cff, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-6, 10, 12); scene.add(key);
const rim = new THREE.DirectionalLight(0xff9de0, 1.2); rim.position.set(8, -4, -6); scene.add(rim);

// ---------- textures ----------
function stripeTexture() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, 128, 128);
  x.fillStyle = "rgba(255,255,255,0)";
  x.globalCompositeOperation = "destination-out";
  for (let i = -128; i < 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 32, 0); x.lineTo(i + 32 + 128, 128); x.lineTo(i + 128, 128); x.closePath(); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const STRIPES = stripeTexture();
const cylGeo = new THREE.CylinderGeometry(BAR_R, BAR_R, 1, 48, 1, true).rotateZ(Math.PI / 2);
const capGeo = new THREE.SphereGeometry(BAR_R, 32, 24);
const ballGeo = new THREE.SphereGeometry(BALL_R, 72, 48);
const ballMat = makeBallMaterial();

// ---------- clouds ----------
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xd8e8ff, emissiveIntensity: 0.35 });
const clouds = [];
{
  const r = rng(42);
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const n = 4 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), cloudMat);
      const sc = 0.9 + r() * 1.1; s.scale.setScalar(sc);
      s.position.set((k - n / 2) * 1.2 + r() * 0.4, (r() - 0.3) * 0.6 + (k > 0 && k < n - 1 ? 0.5 : 0), r() * 0.5);
      g.add(s);
    }
    g.position.set((i % 2 ? 1 : -1) * (9 + r() * 7), -13 + i * 3.4 + r(), -22 - r() * 8);
    g.userData.speed = 0.15 + r() * 0.25;
    g.scale.setScalar(0.7 + r() * 0.6);
    scene.add(g); clouds.push(g);
  }
}

// ---------- crown ----------
const crown = new THREE.Group();
{
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xffc81a, metalness: 1, roughness: 0.22, clearcoat: 1 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 0.32, 32, 1, true), gold); band.material.side = THREE.DoubleSide; crown.add(band);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.42, 12), gold);
    spike.position.set(Math.cos(a) * 0.45, 0.35, Math.sin(a) * 0.45); crown.add(spike);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshPhysicalMaterial({ color: [0xff2e88, 0x22d3ff, 0x62ff4a, 0xa259ff, 0xff4747][i], roughness: 0.1, clearcoat: 1 }));
    gem.position.set(Math.cos(a) * 0.5, 0.0, Math.sin(a) * 0.5); crown.add(gem);
  }
  crown.rotation.z = -0.25;
  scene.add(crown);
}

// ---------- confetti ----------
const CONF_N = 420;
const confMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.13), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.5 }), CONF_N);
confMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(confMesh);
const conf = [];
{ const c = new THREE.Color(); for (let i = 0; i < CONF_N; i++) { c.set(PALETTE[i % PALETTE.length]); confMesh.setColorAt(i, c); conf.push({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3() }); } }
const crng = rng(99);
function burst(count) {
  let made = 0;
  for (const c of conf) {
    if (made >= count) break; if (c.alive) continue;
    c.alive = true; made++;
    c.p.set((crng() - 0.5) * 12, 11 + crng() * 3, 2 + crng() * 3);
    c.v.set((crng() - 0.5) * 4, -2 - crng() * 3, 0);
    c.r.set(crng() * 6, crng() * 6, crng() * 6);
    c.w.set((crng() - 0.5) * 12, (crng() - 0.5) * 12, (crng() - 0.5) * 12);
  }
}
const dummy = new THREE.Object3D();
function stepConfetti(dt, time) {
  conf.forEach((c, i) => {
    if (c.alive) {
      c.v.y = Math.max(c.v.y - 3 * dt, -4.5);
      c.p.addScaledVector(c.v, dt); c.p.x += Math.sin(time * 3 + i) * 0.02;
      c.r.x += c.w.x * dt; c.r.y += c.w.y * dt; c.r.z += c.w.z * dt;
      if (c.p.y < -13) c.alive = false;
    }
    dummy.position.copy(c.p); dummy.rotation.copy(c.r); dummy.scale.setScalar(c.alive ? 1 : 0);
    dummy.updateMatrix(); confMesh.setMatrixAt(i, dummy.matrix);
  });
  confMesh.instanceMatrix.needsUpdate = true;
}

// ---------- state ----------
let cfg, players, seasons, simFrame = 0, totalFrames;
const EVENTS = []; let lastTop3 = null;
let lastLeader = null, leaderCooldown = 0, banner = null, seasonPop = 0, lastSeasonLabel = null, endTriggered = false;
const crownState = { x: 0, y: 0 };

function seasonLabel(s) { return `${s - 1}-${String(s).slice(-2)}`; }
function fmt(n) { return Math.round(n).toLocaleString("en-US"); }

function timeline(f) {
  const g = f - cfg.introFrames;
  if (g <= 0) return { i: 0, t: 0, hold: false };
  const i = Math.floor(g / cfg.framesPerSeason);
  if (i >= seasons.length - 1) return { i: seasons.length - 1, t: 0, hold: true };
  return { i, t: (g % cfg.framesPerSeason) / cfg.framesPerSeason, hold: false };
}

window.setup = async (c) => {
  cfg = c; seasons = c.data.seasons;
  totalFrames = c.hookFrames + c.introFrames + (seasons.length - 1) * c.framesPerSeason + c.holdFrames;
  await document.fonts.load('80px "Lilita"');
  players = c.data.players.map((p) => {
    const color = new THREE.Color(PALETTE[hash(p.id) % PALETTE.length]);
    const tex = STRIPES.clone(); tex.needsUpdate = true;
    const mat = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.22, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.06 });
    const stripeMat = new THREE.MeshPhysicalMaterial({ color: color.clone().lerp(new THREE.Color("#ffffff"), 0.18), emissive: color, emissiveIntensity: 0.3, roughness: 0.3, clearcoat: 1, alphaMap: tex, transparent: true });
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(cylGeo, mat), stripes = new THREE.Mesh(cylGeo, stripeMat), cap = new THREE.Mesh(capGeo, mat), ball = new THREE.Group(), ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.rotation.copy(BALL_TILT); ball.add(ballMesh);
    stripes.scale.set(1, 1.01, 1.01);
    g.add(cyl, stripes, cap, ball); g.visible = false; scene.add(g);
    return { ...p, css: "#" + color.getHexString(), g, cyl, stripes, cap, ball, tex, y: -9, vy: 0, vis: 0, val: 0, rank: 99 };
  });
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
    const target = p.rank <= TOP_N ? Y_TOP - (p.rank - 1) * GAP : Y_TOP - TOP_N * GAP - 0.6;
    const k = 140, d = 17;
    p.vy += ((target - p.y) * k - p.vy * d) * dt; p.y += p.vy * dt;
    const tv = p.rank <= TOP_N ? 1 : 0;
    p.vis += (tv - p.vis) * Math.min(1, dt * (tv ? 9 : 16));
    if (p.rank > TOP_N && p.vis < 0.02) p.y = Y_TOP - TOP_N * GAP - 0.6;
  }
  const leader = top[0];
  leaderCooldown -= dt;
  // Announce every lead change; if one happens during the cooldown it is announced as soon as the
  // cooldown ends (and skipped only if the lead has flipped back to the last announced player).
  if (leader && lastLeader === null) lastLeader = leader.id;
  if (leader && leader.id !== lastLeader && f > cfg.introFrames && leaderCooldown <= 0 && !hold) {
    burst(160); banner = { text: "NEW #1!", name: leader.name, born: time, life: 1.4 }; leaderCooldown = 1.5;
    EVENTS.push({ f, type: "leader", name: leader.name });
    lastLeader = leader.id;
  }
  const top3 = top.slice(0, 3).map((p) => p.id).join();
  if (lastTop3 && top3 !== lastTop3 && f > cfg.introFrames && !hold) EVENTS.push({ f, type: "swap" });
  lastTop3 = top3;
  if (hold && !endTriggered) { EVENTS.push({ f, type: "end" }); endTriggered = true; burst(400); banner = { text: "ALL-TIME #1", name: leader.name, born: time, life: 999 }; }
  if (hold && (f % 20 === 0)) burst(40);
  const sl = seasonLabel(seasons[t < 0.5 ? i : j]);
  if (sl !== lastSeasonLabel) { seasonPop = 1; lastSeasonLabel = sl; }
  seasonPop = Math.max(0, seasonPop - dt * 4);
  stepConfetti(dt, time);
  for (const c of clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 16) c.position.x = -16; }
  if (leader) { crownState.x += (barEnd(leader) - crownState.x) * 0.35; crownState.y += (leader.y - crownState.y) * 0.35; }
}

function vmax() { return Math.max(1, ...players.map((p) => p.val)); }
function barLen(p) { return (p.val / vmax()) * MAX_LEN; }
function barEnd(p) { return X0 + barLen(p) + BALL_R * 0.7; }

const v3 = new THREE.Vector3();
function toScreen(x, y, z = 0) { v3.set(x, y, z).project(camera); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; }

function text(ctx, s, x, y, size, fill, { stroke = "#2a0f5c", sw = size * 0.2, align = "center", shadow = true } = {}) {
  ctx.font = `${size}px Lilita`; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  if (shadow) { ctx.lineWidth = sw; ctx.strokeStyle = "rgba(30,0,70,0.55)"; ctx.strokeText(s, x, y + size * 0.1); ctx.fillStyle = "rgba(30,0,70,0.55)"; ctx.fillText(s, x, y + size * 0.1); }
  ctx.lineWidth = sw; ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
function pill(ctx, x, y, w, h, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = "rgba(30,0,70,0.45)"; ctx.save(); ctx.translate(0, 8); ctx.fill(); ctx.restore();
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = stroke; ctx.stroke();
}
function elastic(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos(t * 10.5); }

function render(f) {
  const time = f / cfg.fps;
  camera.position.set(-1.6 + Math.sin(time * 0.6) * 0.35, 0.6 + Math.cos(time * 0.45) * 0.25, 27);
  camera.lookAt(0.0, 0.0, 0);
  const vm = vmax();
  for (const p of players) {
    const on = p.vis > 0.02 && p.val > 0;
    p.g.visible = on; if (!on) continue;
    const L = Math.max(0.001, (p.val / vm) * MAX_LEN);
    const s = p.vis;
    p.g.position.set(0, p.y + Math.sin(time * 2.2 + hash(p.id) % 7) * 0.05, 0);
    p.g.scale.set(1, s, s);
    p.cyl.scale.x = L; p.cyl.position.x = X0 + L / 2;
    p.stripes.scale.x = L; p.stripes.position.x = X0 + L / 2;
    p.tex.repeat.set(1, Math.max(0.01, L / 1.4)); p.tex.offset.y = -time * 0.5;
    p.cap.position.x = X0;
    p.ball.position.x = X0 + L + BALL_R * 0.7;
    p.ball.rotation.set(0, 0, -(L / BALL_R) * 0.9); // rolls as the bar grows
    // squash & stretch while moving between lanes
    const sq = Math.min(0.25, Math.abs(p.vy) * 0.03);
    p.ball.scale.set(1 + sq, 1 - sq * 0.6, 1);
  }
  const leader = players.filter((p) => p.rank === 1)[0];
  crown.visible = !!leader;
  if (leader) { crown.position.set(crownState.x + 0.15, crownState.y + BALL_R + 0.28 + Math.sin(time * 4) * 0.06, 0); crown.rotation.y = time * 1.5; }

  renderer.render(scene, camera);

  // ---- composite ----
  const ctx = octx;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#36b7ff"); sky.addColorStop(0.55, "#8f7bff"); sky.addColorStop(1, "#ff7ad9");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // sunburst
  ctx.save(); ctx.translate(W / 2, H * 0.45); ctx.rotate(time * 0.12);
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  for (let k = 0; k < 18; k++) { ctx.rotate((Math.PI * 2) / 18); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-90, -2200); ctx.lineTo(90, -2200); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.drawImage(glCanvas, 0, 0);

  // bar labels
  const visible = players.filter((p) => p.g.visible).sort((a, b) => a.y - b.y);
  for (const p of visible) {
    const a = Math.min(1, p.vis * 1.4); ctx.globalAlpha = a;
    const [sx, sy] = toScreen(X0 - 0.95, p.y);
    const medal = p.rank === 1 ? "#ffd21f" : p.rank === 2 ? "#e6ecff" : p.rank === 3 ? "#ffa25a" : "#ffffff";
    ctx.beginPath(); ctx.arc(sx, sy + 6, 34, 0, 7); ctx.fillStyle = "rgba(30,0,70,0.45)"; ctx.fill();
    ctx.beginPath(); ctx.arc(sx, sy, 34, 0, 7); ctx.fillStyle = medal; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = "#2a0f5c"; ctx.stroke();
    text(ctx, p.rank <= TOP_N ? String(p.rank) : "", sx, sy + 2, 38, "#2a0f5c", { stroke: medal, sw: 0, shadow: false });
    const [nx, ny] = toScreen(X0 - 0.2, p.y);
    text(ctx, p.name, nx, ny - 2, 44, "#ffffff", { align: "left", sw: 10 });
    const [vx, vy] = toScreen(p.ball.position.x + BALL_R + 0.2, p.y);
    text(ctx, fmt(p.val), vx, vy, 40, "#fff35c", { align: "left", sw: 9 });
  }
  ctx.globalAlpha = 1;

  // title (bounces in)
  const ti = elastic(Math.min(1, time / 0.7));
  ctx.save(); ctx.translate(W / 2, 128); ctx.scale(ti, ti); ctx.rotate(Math.sin(time * 1.6) * 0.015);
  const words = cfg.title.split("|");
  words.forEach((w, k) => text(ctx, w, 0, (k - (words.length - 1) / 2) * 104, 100, k === 0 ? "#ffffff" : "#fff35c", { sw: 20 }));
  ctx.restore();
  ctx.save(); ctx.translate(W / 2, 262); ctx.scale(ti, ti);
  ctx.font = "40px Lilita"; const sw = ctx.measureText(cfg.subtitle).width + 70;
  pill(ctx, 0, 0, sw, 70, "#ff3e9a", "#2a0f5c");
  text(ctx, cfg.subtitle, 0, 2, 40, "#ffffff", { sw: 0, shadow: false });
  ctx.restore();

  // banner
  if (banner) {
    const age = time - banner.born;
    if (age > banner.life) banner = null;
    else {
      const sc = elastic(Math.min(1, age / 0.5)) * (age > banner.life - 0.25 ? Math.max(0, (banner.life - age) / 0.25) : 1);
      ctx.save(); ctx.translate(W / 2, 1735); ctx.scale(sc, sc); ctx.rotate(-0.03);
      ctx.font = "64px Lilita"; const bw = Math.max(ctx.measureText(banner.name).width, 380) + 120;
      pill(ctx, 0, 10, bw, 190, "#ffcc1f", "#2a0f5c");
      text(ctx, banner.text, 0, -38, 58, "#ff3e9a", { sw: 12 });
      text(ctx, banner.name, 0, 44, 64, "#ffffff", { sw: 13 });
      ctx.restore();
    }
  }

  // season badge
  const { i, t } = timeline(f); const j = Math.min(i + 1, seasons.length - 1);
  const ps = 1 + seasonPop * 0.12;
  if (!banner) {
  ctx.save(); ctx.translate(W / 2, 1745); ctx.scale(ps, ps);
  pill(ctx, 0, 0, 470, 150, "#22d3ff", "#2a0f5c");
  text(ctx, seasonLabel(seasons[t < 0.5 ? i : j]), 0, 4, 104, "#ffffff", { sw: 18 });
  ctx.restore();
  }
  text(ctx, cfg.source, W / 2, 1875, 26, "#ffffff", { sw: 6, shadow: false });
}

// ---------- hook intro ("Think you can guess...?") ----------
const bigBall = new THREE.Group();
{ const m = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), ballMat); m.rotation.copy(BALL_TILT); bigBall.add(m); }
bigBall.visible = false; scene.add(bigBall);

function hookStep(f) {
  const dt = 1 / cfg.fps, time = f / cfg.fps;
  if (f === 0) burst(220);
  stepConfetti(dt, time);
  for (const c of clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 16) c.position.x = -16; }
}

function fitText(ctx, s, size, maxW) {
  ctx.font = `${size}px Lilita`;
  const w = ctx.measureText(s).width;
  return w > maxW ? Math.floor(size * maxW / w) : size;
}

function renderHook(f) {
  const time = f / cfg.fps, dur = cfg.hookFrames / cfg.fps;
  const outT = Math.max(0, (time - (dur - 0.3)) / 0.3); // exit animation in the last 0.3s
  const exitScale = 1 - outT * outT;
  camera.position.set(-1.6 + Math.sin(time * 0.6) * 0.35, 0.6 + Math.cos(time * 0.45) * 0.25, 27);
  camera.lookAt(0, 0, 0);
  for (const p of players) p.g.visible = false;
  crown.visible = false;
  bigBall.visible = true;
  const bounce = Math.abs(Math.sin(time * 3.2));
  const bs = 2.3 * elastic(Math.min(1, time / 0.6)) * exitScale;
  bigBall.scale.set(bs * (1 + (1 - bounce) * 0.06), bs * (1 - (1 - bounce) * 0.06), bs);
  bigBall.position.set(0, -5.6 + bounce * 1.0, 1);
  bigBall.rotation.set(0, time * 1.6, -time * 0.8);
  renderer.render(scene, camera);
  bigBall.visible = false;

  const ctx = octx;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#36b7ff"); sky.addColorStop(0.55, "#8f7bff"); sky.addColorStop(1, "#ff7ad9");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H * 0.45); ctx.rotate(time * 0.25);
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  for (let k = 0; k < 18; k++) { ctx.rotate((Math.PI * 2) / 18); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-90, -2200); ctx.lineTo(90, -2200); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.drawImage(glCanvas, 0, 0);

  const lines = [["THINK YOU CAN GUESS", "#ffffff"], ["WHO THE CURRENT", "#ffffff"],
    ...cfg.hook.split("|").map((l) => [l, "#fff35c"]), ["IS?", "#ff3e9a"]];
  const lh = 128, top = 400;
  lines.forEach(([l, color], k) => {
    const t0 = 0.1 + k * 0.14;
    const sc = elastic(Math.max(0, Math.min(1, (time - t0) / 0.55))) * exitScale;
    if (sc <= 0) return;
    const size = fitText(ctx, l, l === "IS?" ? 150 : 112, 960);
    ctx.save(); ctx.translate(W / 2, top + k * lh + (l === "IS?" ? 14 : 0)); ctx.scale(sc, sc);
    ctx.rotate(Math.sin(time * 2 + k) * 0.02);
    text(ctx, l, 0, 0, size, color, { sw: size * 0.2 });
    ctx.restore();
  });
  // call to action
  const ct0 = 0.1 + lines.length * 0.14 + 0.1;
  const cs = elastic(Math.max(0, Math.min(1, (time - ct0) / 0.5))) * exitScale * (1 + Math.sin(time * 8) * 0.03);
  if (cs > 0) {
    ctx.save(); ctx.translate(W / 2, top + lines.length * lh + 70); ctx.scale(cs, cs); ctx.rotate(-0.03);
    pill(ctx, 0, 0, 760, 140, "#ffcc1f", "#2a0f5c");
    text(ctx, "COMMENT BELOW NOW!", 0, 4, 72, "#ff3e9a", { sw: 13 });
    ctx.restore();
  }
}

function simulateTo(f) { // inclusive
  while (simFrame <= f) { simFrame < cfg.hookFrames ? hookStep(simFrame) : step(simFrame - cfg.hookFrames); simFrame++; }
}
window.frame = (f) => {
  simulateTo(f);
  f < cfg.hookFrames ? renderHook(f) : render(f - cfg.hookFrames);
  return out.toDataURL("image/jpeg", 0.92);
};
window.skipTo = (f) => simulateTo(f - 1);
// Simulate the whole video without rendering and return timed events (for the sound track).
window.simulateEvents = () => {
  simulateTo(totalFrames - 1);
  const seasonFrames = [];
  for (let i = 0; i < seasons.length - 1; i++) seasonFrames.push(cfg.introFrames + i * cfg.framesPerSeason + Math.ceil(cfg.framesPerSeason / 2));
  return { fps: cfg.fps, hookFrames: cfg.hookFrames, introFrames: cfg.introFrames, totalFrames,
    events: EVENTS.map((e) => ({ ...e, f: e.f + cfg.hookFrames })), seasonFrames: seasonFrames.map((f) => f + cfg.hookFrames) };
};
window.ready = true;
