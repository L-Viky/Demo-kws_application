# KWS Smart Home — Edge AI Demo

A browser-based smart home simulation controlled entirely by voice commands, running a **Binarized Neural Network (BNN)** for keyword spotting directly on the device — no server, no cloud, no data leaves your phone.

> 📹 **[Watch the video demo]((https://drive.google.com/file/d/1Q3IUECtZk_lkxYn46Lw0QCgklTX0x5MU/view?usp=sharing))** ← _replace this with your actual link_

---

## What it does

You navigate an avatar through a four-room 2D top-down house (living room, bedroom, bathroom, kitchen) and interact with objects — lights, shutters, TV, fireplace, fridge, stove, PC — using a small set of spoken keywords. The model runs entirely in the browser via TensorFlow.js, with all audio processing (FFT, Mel filterbank, BNN inference) happening locally in JavaScript at 16 kHz.

The app can be installed as a **PWA** and works fully **offline** after the first load.

---

## How it works

### Keyword Spotting pipeline

```
Microphone  →  16 kHz PCM  →  Ring buffer  →  RMS gate
    →  Hann window + STFT (512-pt FFT)  →  32-band Mel filterbank  →  log
    →  51 × 32 × 1 spectrogram tensor  →  BNN inference  →  command
```

1. **Audio capture** — `getUserMedia` → `ScriptProcessor` (4096-sample chunks). If the browser opens the context at a non-16 kHz rate, audio is resampled in JS with linear interpolation.
2. **Preprocessing** — identical to training: 25 ms Hann-windowed frames (400 samples), 19.5 ms hop (312 samples), 51 frames per second, 32 Mel bands (20 Hz – 8 kHz), log-energy.
3. **Inference** — `tf.loadLayersModel` with two custom TF.js layers (`BinaryConv2D`, `BinaryActivation`) that replicate the Keras BNN ops. The model topology is patched at load time to handle Keras 3 format differences.
4. **Confirmation gate** — a word must win 2 consecutive inference windows (every 400 ms) at confidence ≥ 0.6, plus an RMS gate (< 0.01 → skip) to suppress silence, plus a 1 s refractory period after each accepted command.

### Recognised keywords

| Movement | Interaction | Device control |
|---|---|---|
| `up` `down` `left` `right` | `yes` `no` | `on` `off` |
| `go` `stop` | | |

Special tokens: `_silence_` and `_unknown_` are never forwarded to the command handler.

### Interaction model

1. Walk near an object — a bubble appears: _"Interact with X?"_
2. Say **yes** to activate the interaction.
3. Say **on/off** (lights, TV, fireplace, fridge, stove, PC) or **up/down** (shutters).
4. Say **no** to dismiss — the object is blocked for 10 s (or until you walk away), then re-proposed automatically.

`up` and `down` double as avatar movement commands when no interaction is active.

---

## Project structure

```
.
├── kws_smart_home_v4.html   # Single-page app shell (PWA meta, layout)
├── script.js                # All logic: rendering, physics, audio, BNN
├── style.css                # UI styles (topbar, side panel, mobile bottom-sheet)
├── manifest.json            # PWA manifest
├── sw.js                    # Service worker (offline caching)
├── icon-192.png             # App icon
└── assets/
    └── tfjs_model/
        ├── model.json       # BNN model topology + weight manifest
        └── *.bin            # Weight shards
```

> The model lives under `assets/tfjs_model/`. If you retrain, drop the new `model.json` + `.bin` files there — the loader patches the topology automatically.

---

## Running the demo

The app requires **HTTPS** (or `localhost`) for microphone access. The simplest setup uses a local HTTP server exposed through a tunnel:

### 1. Install dependencies (one-time)

```bash
npm install -g localtunnel   # or: npx localtunnel (no install needed)
```

### 2. Start the server

Open **two terminals** in the project folder:

**Terminal 1 — static file server:**
```bash
python3 -m http.server 8000
```

**Terminal 2 — public HTTPS tunnel:**
```bash
npx localtunnel --port 8000
```

The tunnel prints a URL like `https://xyz.loca.lt`. The first time you open it you may need to click a "Continue" button on the localtunnel landing page.

### 3. Open the app

```
https://<your-subdomain>.loca.lt/kws_smart_home_v4.html
```

On mobile: tap **"Add to Home Screen"** to install it as a PWA. After that it works without an internet connection.

---

## Controls

| Input | Action |
|---|---|
| **WASD** / **Arrow keys** | Move avatar |
| **Y** | `yes` |
| **N** | `no` |
| **O** | `on` |
| **F** | `off` |
| **U** | `up` |
| Voice (mic on) | Any of the 10 keywords above |

When the microphone is off, the app runs a **demo loop** that cycles through `yes → on → yes → up → no → yes → down → yes → off` automatically so you can see the interaction flow without speaking.

---

## UI panels

**Top bar** — app name, "EDGE AI — TinyML" badge, current room name.

**KWS Monitor** (side panel / mobile bottom-sheet):
- Live audio waveform
- Last recognised word + confidence
- System state badge (`listening` / `proposta` / `bloccato`)
- Object list for the current room (coloured dots: on/open = green)
- Command log (last 60 entries, timestamped)
- Mic toggle button

On mobile the panel is a bottom-sheet: tap its header to expand/collapse.

---

## Technical notes

### BNN custom layers

The Keras model uses `BinaryConv2D` and `BinaryActivation` layers that are not built into TF.js. They are re-implemented in `script.js` and registered with `tf.serialization.registerClass`:

- **BinaryConv2D** — standard `tf.conv2d` with `sign(w)` binarised weights (0 → +1).
- **BinaryActivation** — element-wise `sign(x)` (0 → +1).

The topology is also patched at load time to rename `Activation` layers whose `activation` field is an object (Keras 3 format) to `BinaryActivation`, and to add `batch_input_shape` where Keras 3 uses `batch_shape`.

### Audio graph resilience

Some browsers open an `AudioContext` at 44.1 kHz or 48 kHz instead of 16 kHz. The app tries to open at 16 kHz first; if the microphone then delivers only silence for 2 s (silent-mic watchdog), it tears down the context and rebuilds it at the native device rate, then resamples in `bnnResampleLinear` before feeding the ring buffer.

### Collision system

Avatar movement uses a circle vs. rectangle (AABB) and circle vs. circle test. Obstacles are defined as static rectangles and circles (plants) in `OBSTACLES` / `PLANT_OBSTACLES`. The canvas scales to fit any screen; all coordinates are in "house space" and converted to pixels via a `scale` factor computed on every resize.

---

## Browser requirements

- **Chrome / Edge 89+** or **Safari 14.5+** (for `getUserMedia` + `AudioContext`)
- **HTTPS** or `localhost` (required for microphone)
- JavaScript enabled (no build step — everything is plain JS)

---

## License

_Add your license here._
