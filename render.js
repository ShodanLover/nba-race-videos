// Usage: node render.js data_pts.json "ALL-TIME|SCORING LEADERS" "Career points" out.mp4 [seconds] [--preview f1,f2,...]
const http = require("http"), fs = require("fs"), path = require("path"), { spawn } = require("child_process");
const { chromium } = require("playwright");

const [dataFile, title, subtitle, outFile, secondsArg] = process.argv.slice(2);
const previewIdx = process.argv.indexOf("--preview");
const preview = previewIdx > 0 ? process.argv[previewIdx + 1].split(",").map(Number) : null;
const argOf = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const FPS = 30, WORKERS = Number(process.env.WORKERS || 4);
const data = JSON.parse(fs.readFileSync(dataFile));
const seconds = Number(secondsArg) > 0 ? Number(secondsArg) : 45;
const cfg = {
  data, title, subtitle, fps: FPS,
  source: "Regular season · NBA/BAA · Data: Basketball-Reference · 2026-27 through Nov",
  framesPerSeason: Math.max(6, Math.round((seconds * FPS) / (data.seasons.length - 1))),
  introFrames: 24, holdFrames: Math.round(Number(argOf("--hold") || 3) * FPS),
  hookFrames: Math.round(3.6 * FPS), hook: argOf("--hook") || "ALL-TIME|LEADER",
};

const root = __dirname;
const types = { ".html": "text/html", ".js": "text/javascript", ".woff2": "font/woff2", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`http://127.0.0.1:${port}/scene.html`);
  await page.waitForFunction(() => window.ready === true);
  const total = await page.evaluate((c) => window.setup(c), cfg);
  return { page, total };
}

async function grab(page, f) {
  const url = await page.evaluate((f) => window.frame(f), f);
  return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
}

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  // GL=d3d11 (default, Windows GPU), GL=gl / GL=vulkan (other GPUs), GL=swiftshader (no graphics card)
  const gl = process.env.GL || (process.platform === "win32" ? "d3d11" : "gl");
  const browser = await chromium.launch({ args: [`--use-angle=${gl}`, "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-gpu"] });

  const eventsOut = argOf("--events");
  if (eventsOut) {
    const { page } = await openPage(browser, port);
    fs.writeFileSync(eventsOut, JSON.stringify(await page.evaluate(() => window.simulateEvents())));
    console.log("wrote", eventsOut);
    await browser.close(); server.close(); return;
  }

  if (preview) {
    const { page } = await openPage(browser, port);
    for (const f of preview) { fs.writeFileSync(`${outFile}_${f}.jpg`, await grab(page, f)); console.log("frame", f); }
    await browser.close(); server.close(); return;
  }

  const { page: p0, total } = await openPage(browser, port);
  await p0.close();
  const chunk = Math.ceil(total / WORKERS);
  const t0 = Date.now();
  const parts = await Promise.all([...Array(WORKERS).keys()].map(async (w) => {
    const start = w * chunk, end = Math.min(total, start + chunk);
    const part = `${outFile}.part${w}.mp4`;
    const { page } = await openPage(browser, port);
    await page.evaluate((f) => window.skipTo(f), start);
    const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-r", String(FPS), "-i", "-",
      "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", part], { stdio: ["pipe", "inherit", "inherit"] });
    for (let f = start; f < end; f++) {
      const buf = await grab(page, f);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      if (w === 0 && f % 60 === 0) console.log(`worker0 ${f - start}/${end - start}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await new Promise((r) => ff.on("close", r));
    return part;
  }));
  await browser.close(); server.close();
  const list = `${outFile}.txt`;
  fs.writeFileSync(list, parts.map((p) => `file '${path.resolve(p)}'`).join("\n"));
  await new Promise((r) => spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", outFile], { stdio: "inherit" }).on("close", r));
  parts.forEach((p) => fs.unlinkSync(p)); fs.unlinkSync(list);
  console.log(`wrote ${outFile}: ${(total / FPS).toFixed(1)}s in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})();
