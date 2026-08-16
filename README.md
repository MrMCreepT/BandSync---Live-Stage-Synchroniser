# BandSync — Live Stage Synchronizer 🎸🥁🎤

BandSync is a zero-latency, multi-device live stage synchronizer and performance HUD designed for bands, worship teams, and live performers. It provides synchronized click tracks, voice count-in cues, role-tailored performance displays, emergency visual stage cues, MIDI foot pedal integration, and AI-powered setlist tools.

---

## ✨ Features

- ⏱️ **Precision Stage Sync Engine**
  - Millisecond-accurate NTP clock offset calibration between band members.
  - Real-time WebSocket broadcasting with automatic reconnection and fallback to cross-tab `BroadcastChannel`.
  - Scheduled command triggers with lead-time compensation for zero-jitter synchronous playback.

- 🖥️ **Role-Specific Stage HUDs**
  - **Drums & Percussion:** High-contrast visual metronome, beat subdivisions, and bar count-ins.
  - **Vocals:** Synchronized scrolling lyrics and teleprompter display with section markers.
  - **Bass & Guitar:** Live chord sheets, key changes, and tab viewers.
  - **Sound Tech & Musical Director:** Master transport controls, band-wide latency monitor, and member status.

- 🚨 **Live Emergency Stage Cues**
  - Broadcast instant on-screen alerts to all band member displays:
    - *Extend Solo / Jam*
    - *Cut Song Short / Fade Out*
    - *Repeat Chorus*
    - *Mute / Unmute In-Ear Click*
    - *Custom Text Broadcasts*

- 🤖 **AI Song Importer & Analyzer**
  - Integrated with **Google Gemini (`@google/genai`)** to parse raw song lyrics, chord charts, tempo structures, and time signatures directly into synchronized track arrangements.

- 🎛️ **MIDI Foot Pedal Support**
  - Web MIDI API integration for hands-free stage navigation (Next Song, Previous Song, Play/Stop, Emergency Cue trigger).

- 📋 **Gig Hub & Setlist Optimizer**
  - Setlist duration budgeting, set break management, and dynamic reordering for live shows.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Motion, Lucide Icons, Vite 8
- **Backend:** Node.js, Express 5, WebSocket (`ws`), `@google/genai`
- **Audio & Hardware:** Web Audio API (synthesized clicks & voice cues), Web MIDI API

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 20+ recommended)
- [npm](https://www.npmjs.com/) or [Bun](https://bun.sh/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/MrMCreepT/BandSync---Live-Stage-Synchroniser.git
   cd BandSync---Live-Stage-Synchroniser
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Set up your Gemini API Key for AI features:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your Gemini API key in `.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

---

## 💻 Running the App

### Development Mode
Starts both the WebSocket backend and Vite frontend with hot module replacement:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
Builds the client assets and bundles the Node server:
```bash
npm run build
npm start
```

### Type Checking & Linting
```bash
npm run lint
```

---

## 🌐 Deployment

### GitHub Pages (Static Client)
A GitHub Actions workflow is provided in `.github/workflows/static.yml`.

> [!NOTE]
> GitHub Pages hosts static web files only. The React UI and cross-tab synchronization (via `BroadcastChannel`) will function on GitHub Pages, but multi-device WebSocket synchronization requires a hosted Node.js server.

To enable GitHub Pages deployment:
1. Go to **Settings** > **Pages** in your GitHub repository.
2. Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. Push changes to the `main` branch.

### Full Stack Hosting (WebSockets & AI)
For full real-time multi-device synchronization, deploy to platforms supporting Node.js processes such as **Render**, **Fly.io**, **Railway**, or a VPS:
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Environment Variables:** `GEMINI_API_KEY` (optional, for AI features)

---

## 📜 License

MIT License. Feel free to use and adapt for your live stage performances!
