# 🏆 Hirustar Season 5 — Premium Scoreboard System

A professional, real-time, broadcast-ready scoreboard system designed for the **Hirustar Season 5** singing competition. This system provides a stunning visual leaderboard, a comprehensive admin dashboard, and dedicated judge panels, all synchronized via WebSockets for zero-latency performance.

![Hirustar S5 UI](https://img.shields.io/badge/UI-Premium_Glassmorphism-gold?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Tech-Node.js_|_Socket.io_|_Express-blue?style=for-the-badge)
![Build Status](https://img.shields.io/badge/Build-Portable_EXE-green?style=for-the-badge)

## ✨ Core Components

### 🖥️ Main Scoreboard (`/display`)
- **Premium Aesthetics**: High-end glassmorphism design with frosted effects, gold accents, and dynamic typography.
- **Dynamic Leaderboard**: Real-time auto-sorting of contestants based on high-to-low scores.
- **FLIP Animations**: Ultra-smooth transitions and reordering when ranks change.
- **Broadcast Optimized**: Supports 4K motion backgrounds (MP4) and transparent UI overlays.
- **Interactive Feed**: Instant visual feedback (+7 points) with judge attribution.

### 👨‍⚖️ Judge Dashboards (`/judge/:id`)
- **Real-Time Sync**: Judges see the live leaderboard rankings as they update.
- **One-Tap Voting**: Simplified interface for judges to award points instantly.
- **Collision Prevention**: Built-in logic prevents multiple judges from voting for the same contestant simultaneously.
- **Mobile Responsive**: Fully optimized for tablets and smartphones.

### ⚙️ Admin Control Center (`/admin`)
- **Live Content Manager**: Add, edit, or remove contestants and judges on the fly.
- **Image Upload System**: Drag-and-drop photo uploads for participants directly through the browser.
- **Network Monitoring**: See all connected display, judge, and admin nodes in real-time.
- **Remote Focus**: One-click "Focus" button to bring specific windows to the foreground on all connected machines.
- **Round Management**: Quickly reset votes for new rounds or clear all scores for a fresh start.

### 🤖 Switcher Agent (Remote Control)
The **Switcher Agent** is a standalone background utility that runs on judge or display machines.
- **Auto-Launch**: Automatically opens the correct judge interface in Chrome based on the machine's local IP.
- **Remote Focus Control**: Allows the Admin to remotely bring Chrome or other applications (like the bundled EXE) to the foreground.
- **Zero Configuration**: Once configured via `config.json`, it runs silently and connects to the central server.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/Da-Yvez/Hirustar-Scoreboard.git

# Install dependencies
npm install
```

### 3. Run the Server
```bash
npm start
```

Access the interfaces via your browser:
- **Admin**: `http://localhost:3000/admin`
- **Display**: `http://localhost:3000/display`
- **Judge 1**: `http://localhost:3000/judge/1`

> [!TIP]
> To access from other devices (Tablets/Phones), use your computer's IP address: `http://<YOUR_IP>:3000`

---

## 📦 Standalone Bundling

### 🏆 Scoreboard Server
To create the main portable `.exe` for Windows:
```bash
# In the root directory
npm run bundle
```
This generates `hirustar-scoreboard.exe`.

### 🤖 Switcher Agent
To create the portable agent utility:
```bash
# Navigate to the Switcher Agent directory
cd "Switcher Agent"

# Install agent-specific dependencies
npm install

# Bundle the agent
npm run bundle
```
This generates `switcher-agent.exe`.

> [!IMPORTANT]
> **Persistence**: The Scoreboard EXE automatically creates a `state.json` in its directory to save all data.
> **Assets**: Custom images uploaded via the Admin panel are stored in a `public/images` folder created next to the EXE.

---

## 🛠️ Technology Stack
- **Backend**: Node.js & Express
- **Real-time**: Socket.io (WebSocket)
- **Frontend**: Vanilla JS (ES6+)
- **Styling**: Premium CSS Design System (Frosted Glass & Gold Palette)
- **Persistence**: JSON-based flat-file database (`state.json`)
- **Bundling**: Vercel Pkg

---

## 📂 Project Structure
- `server.js`: Core WebSocket server and API logic.
- `public/`: Frontend assets (HTML, CSS, JS).
- `data.js`: Default fallback data.
- `state.json`: Active session data (auto-generated).
- `Switcher Agent/`: Remote control agent source code and config.

Developed for **Hirustar Season 5**.
