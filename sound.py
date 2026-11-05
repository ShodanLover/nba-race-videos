"""Synthesize an original sound-effects track (and optional beat) for a rendered race video.

Usage:
  python3 sound.py audio/ev_01.json videos/01_scoring_3d.mp4 [--beat]

Writes <video>_sfx.mp4 (effects only) or <video>_beat.mp4 (effects + beat).
Every sound is generated here from scratch, so there is nothing to clear for copyright.
"""
import json, sys, subprocess, os, wave
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
rng = np.random.default_rng(7)


def t_(dur):
    return np.arange(int(dur * SR)) / SR


def env(dur, attack=0.003, decay=0.1):
    t = t_(dur)
    return np.minimum(1, t / attack) * np.exp(-t / decay)


def filt(x, kind, f):
    return sosfilt(butter(2, f, btype=kind, fs=SR, output="sos"), x)


def sweep(f0, f1, dur, curve=1.0):
    t = t_(dur)
    f = f0 + (f1 - f0) * (t / dur) ** curve
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def noise(dur):
    return rng.standard_normal(int(dur * SR))


# ---------------- sound effects ----------------
def pop(pitch=700):
    s = sweep(pitch, pitch * 1.9, 0.09, 0.6) * env(0.09, 0.002, 0.035)
    click = filt(noise(0.01), "highpass", 3000) * env(0.01, 0.0005, 0.003) * 0.3
    s[: len(click)] += click
    return s


def thud():
    body = sweep(140, 48, 0.25, 0.4) * env(0.25, 0.002, 0.09)
    slap = filt(noise(0.06), "bandpass", [200, 1800]) * env(0.06, 0.001, 0.015) * 0.6
    body[: len(slap)] += slap
    return body * 1.2


def whoosh(dur=0.45, up=True):
    n = noise(dur)
    t = t_(dur)
    out = np.zeros_like(n)
    # crossfade between bandpass bands to fake a sweeping filter
    bands = [(300, 900), (700, 2000), (1500, 4000), (3000, 8000)]
    if not up:
        bands = bands[::-1]
    pos = t / dur * (len(bands) - 1)
    for k, b in enumerate(bands):
        w = np.clip(1 - np.abs(pos - k), 0, 1)
        out += filt(n, "bandpass", list(b)) * w
    shape = np.sin(np.pi * t / dur) ** 2
    return out * shape * 0.5


def snare(vel=1.0):
    n = filt(noise(0.12), "highpass", 1200) * env(0.12, 0.001, 0.04)
    tone = np.sin(2 * np.pi * 190 * t_(0.12)) * env(0.12, 0.001, 0.03) * 0.5
    return (n + tone) * vel * 0.55


def crash(dur=1.8):
    n = filt(noise(dur), "highpass", 4000)
    shimmer = filt(noise(dur), "bandpass", [6000, 12000]) * 0.6
    return (n + shimmer) * env(dur, 0.002, 0.55) * 0.45


def tick(high=True):
    f = 2300 if high else 1800
    return np.sin(2 * np.pi * f * t_(0.03)) * env(0.03, 0.0005, 0.007) * 0.18


def bloop():
    return sweep(380, 980, 0.13, 0.7) * env(0.13, 0.003, 0.05) * 0.45


def bell(freq, dur=0.9):
    t = t_(dur)
    s = (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t / 0.08)
         + 0.2 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t / 0.04))
    return s * env(dur, 0.002, 0.3) * 0.35


def crackle(dur=0.9, density=90):
    out = np.zeros(int(dur * SR))
    for _ in range(int(dur * density)):
        i = rng.integers(0, len(out) - 400)
        c = filt(noise(0.008), "highpass", 2500) * env(0.008, 0.0003, 0.002)
        out[i:i + len(c)] += c * rng.uniform(0.2, 0.6)
    return out * np.linspace(1, 0.2, len(out))


def saw(freq, dur, vib=0.0):
    t = t_(dur)
    f = freq * (1 + vib * np.sin(2 * np.pi * 6 * t))
    ph = np.cumsum(f) / SR
    return 2 * (ph % 1) - 1


def horn():
    dur = 0.42
    s = filt(saw(523, dur, 0.012), "lowpass", 2600)
    t = t_(dur)
    return s * np.minimum(1, t / 0.03) * np.where(t > dur - 0.08, (dur - t) / 0.08, 1) * 0.25


def brass_chord(freqs, dur, decay=0.6):
    s = sum(filt(saw(f, dur, 0.004), "lowpass", 2200) for f in freqs) / len(freqs)
    return s * env(dur, 0.015, decay) * 0.55


def new_leader():
    out = np.zeros(int(1.4 * SR))
    for k, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0]):  # C6 E6 G6 C7
        b = bell(f)
        i = int(k * 0.075 * SR)
        out[i:i + len(b)] += b[: len(out) - i]
    h = horn()
    out[: len(h)] += h * 0.8
    c = crackle(1.0)
    out[int(0.05 * SR):int(0.05 * SR) + len(c)] += c * 0.5
    return out


def fanfare():
    out = np.zeros(int(3.2 * SR))
    C4, E4, G4, C5, E5, G5 = 261.6, 329.6, 392.0, 523.3, 659.3, 784.0
    hits = [(0.0, [G4, C5], 0.16), (0.18, [G4, C5], 0.16), (0.36, [G4, C5], 0.16), (0.56, [C4, E4, G4, C5, E5, G5], 1.6)]
    for at, fr, dur in hits:
        d = 2.4 if dur > 1 else 0.2
        s = brass_chord(fr, d, decay=dur)
        i = int(at * SR)
        out[i:i + len(s)] += s
    cr = crash(2.2)
    i = int(0.56 * SR)
    out[i:i + len(cr)] += cr * 0.8
    c = crackle(1.6, 140)
    out[i:i + len(c)] += c * 0.6
    return out


# ---------------- beat ----------------
def kick():
    return sweep(150, 42, 0.32, 0.35) * env(0.32, 0.001, 0.11) * 0.9


def clap():
    out = np.zeros(int(0.2 * SR))
    for k in range(3):
        b = filt(noise(0.15), "bandpass", [900, 3500]) * env(0.15, 0.001, 0.03 if k < 2 else 0.07)
        i = int(k * 0.011 * SR)
        out[i:i + len(b)] += b[: len(out) - i]
    return out * 0.35


def hat(open_=False):
    d = 0.2 if open_ else 0.05
    return filt(noise(d), "highpass", 7000) * env(d, 0.001, 0.06 if open_ else 0.012) * 0.22


def bass(freq, dur):
    t = t_(dur)
    s = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * freq * 2 * t)
    return s * np.minimum(1, t / 0.005) * np.exp(-t / 0.25) * 0.35


def beat(start, end, total, bpm=124):
    out = np.zeros(total)
    spb = 60 / bpm
    roots = [65.4, 55.0, 43.7, 49.0]  # C2 A1 F1 G1 – I vi IV V
    n = 0
    tt = start
    while tt < end:
        i = int(tt * SR)
        beat_in_bar = n % 4
        bar = n // 4
        add(out, kick(), tt, 1.0)
        if beat_in_bar in (1, 3):
            add(out, clap(), tt, 1.0)
        add(out, hat(), tt + spb / 2, 1.0)
        add(out, hat(), tt + spb * 0.75, 0.5)
        if beat_in_bar == 3 and bar % 2 == 1:
            add(out, hat(True), tt + spb / 2, 1.0)
        root = roots[(bar // 2) % 4]
        add(out, bass(root, spb * 0.45), tt + spb / 2, 1.0)
        tt += spb
        n += 1
    return out


def add(track, s, at, gain=1.0):
    i = int(at * SR)
    if i >= len(track) or i < 0:
        return
    j = min(len(track), i + len(s))
    track[i:j] += s[: j - i] * gain


def write_wav(path, x):
    x = np.tanh(x * 1.1) * 0.95  # soft limiter
    pcm = (x * 32767).astype(np.int16)
    stereo = np.stack([pcm, pcm], axis=1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(stereo.tobytes())


def build(events_path, with_beat):
    ev = json.load(open(events_path))
    fps = ev["fps"]
    dur = ev["totalFrames"] / fps
    total = int(dur * SR)
    sfx = np.zeros(total)
    hook = ev["hookFrames"] / fps

    # --- hook: drumroll building, pops per line, ball bounces, exit whoosh, crash on start ---
    tt, rate = 0.15, 7.0
    while tt < hook - 0.32:
        prog = tt / hook
        add(sfx, snare(0.25 + 0.75 * prog), tt, 0.55)
        rate = 7 + 20 * prog ** 1.5
        tt += 1 / rate
    n_lines = 6  # 2 fixed lines + 2 hook lines + "IS?" + CTA
    for k in range(n_lines - 1):
        add(sfx, pop(620 + k * 70), 0.1 + k * 0.14 + 0.06, 0.9)
    add(sfx, pop(1100), 0.1 + (n_lines - 1) * 0.14 + 0.1 + 0.06, 1.0)  # CTA button
    k = 1
    while k * np.pi / 3.2 < hook - 0.3:  # big ball touches down when |sin(3.2 t)| == 0
        add(sfx, thud(), k * np.pi / 3.2, 0.8)
        k += 1
    add(sfx, whoosh(0.4, up=True), hook - 0.38, 1.0)
    add(sfx, crash(), hook, 1.0)
    add(sfx, kick(), hook, 1.0)

    # --- race ---
    for k, f in enumerate(ev["seasonFrames"]):
        add(sfx, tick(k % 2 == 0), f / fps, 1.0)
    last_swap = -9
    for e in ev["events"]:
        at = e["f"] / fps
        if e["type"] == "leader":
            add(sfx, new_leader(), at, 1.0)
            add(sfx, whoosh(0.35, up=False), at - 0.05, 0.5)
        elif e["type"] == "swap" and at - last_swap > 0.35:
            add(sfx, bloop(), at, 1.0)
            last_swap = at
        elif e["type"] == "end":
            add(sfx, fanfare(), at, 1.0)

    mix = sfx
    if with_beat:
        end_at = next((e["f"] / fps for e in ev["events"] if e["type"] == "end"), dur)
        b = beat(hook, dur, total)
        fade = np.ones(total)
        fs, fe = int((end_at + 0.3) * SR), int((end_at + 1.6) * SR)
        fade[fs:fe] = np.linspace(1, 0.35, fe - fs)
        fade[fe:] = 0.35
        tail = int(1.0 * SR)
        fade[-tail:] *= np.linspace(1, 0, tail)
        mix = sfx + b * fade * 0.55
    peak = np.max(np.abs(mix))
    return mix / peak * 0.9


if __name__ == "__main__":
    events, video = sys.argv[1], sys.argv[2]
    with_beat = "--beat" in sys.argv
    mix = build(events, with_beat)
    base = os.path.splitext(video)[0]
    wav = base + ("_beat.wav" if with_beat else "_sfx.wav")
    out = base + ("_beat.mp4" if with_beat else "_sfx.mp4")
    write_wav(wav, mix)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-i", wav, "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "44100", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out], check=True)
    os.remove(wav)
    print("wrote", out)
