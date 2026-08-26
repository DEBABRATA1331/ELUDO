# 🎲 ELUDO - Real-Time Webhook-Based Online Multiplayer Ludo Game

ELUDO is a modern, real-time online multiplayer Ludo game featuring room-based friend matching, live Webhook event notifications, AI bot fallbacks, 3D dice physics, Web Audio synthesizer FX, and mobile responsive touch controls.

![Ludo Game Preview](https://img.shields.io/badge/LUDO-REALTIME-brightgreen?style=for-the-badge&logo=gamepad)
![Socket.io](https://img.shields.io/badge/Socket.io-v4.7-blue?style=for-the-badge)
![Express](https://img.shields.io/badge/Express-Node.js-black?style=for-the-badge)
![Webhook Enabled](https://img.shields.io/badge/Webhook-Integration-purple?style=for-the-badge)

---

## ✨ Features

- **🎮 Real-Time Online Rooms**: Create or join rooms via 6-digit codes (e.g., `LUDO-8821`) or shareable invite links (`?room=ROOMCODE`). Play seamlessly across multiple browsers/devices.
- **⚡ Webhook Integration**: Configure custom Webhook target endpoints (Discord Webhooks, Zapier, Webhook.site, custom APIs) to dispatch real-time JSON payloads for match milestones:
  - `MATCH_START`
  - `DICE_ROLL`
  - `TOKEN_CAPTURED`
  - `TOKEN_HOME`
  - `MATCH_VICTORY`
- **🤖 Intelligent AI Bots**: Add AI bots (`RoboRoller`, `LudoMaster AI`, `CyberPawn`) to fill open slots or practice solo.
- **🎯 Full Standard Ludo Rules**:
  - 15x15 board grid, 52 outer track tiles, 4 home corridors, 8 safe star spots.
  - Require roll 6 to exit base.
  - Extra turns on rolling 6, capturing opponent tokens, or reaching home center.
  - Turn forfeiture for 3 consecutive 6s.
- **🎨 Glassmorphism & 3D Visuals**: Dark neon theme, 3D rolling dice cube animation, glowing valid token move indicators, and victory fanfares.
- **📱 100% Mobile Responsive**: Dedicated mobile touch navigation, scalable 15x15 board layout, and touch-optimized action buttons for smartphones & tablets.
- **🔊 Web Audio API Synth**: Procedural sound FX generated in real-time without external audio downloads.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- npm

### Installation & Running Locally

1. Clone the repository:
```bash
git clone https://github.com/DEBABRATA1331/ELUDO.git
cd ELUDO
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your web browser and navigate to:
```
http://localhost:3005
```

---

## ⚡ Webhook Payload Schema Example

When a token is captured, your configured Webhook receives a JSON payload like this:

```json
{
  "event": "TOKEN_CAPTURED",
  "roomCode": "LUDO-8821",
  "timestamp": "2026-08-26T22:00:00.000Z",
  "game": {
    "players": [
      { "name": "Player 1", "color": "red", "isBot": false },
      { "name": "RoboRoller", "color": "green", "isBot": true }
    ],
    "currentTurn": "red",
    "status": "in_progress"
  },
  "details": {
    "attacker": "Player 1",
    "victim": "RoboRoller",
    "victimColor": "green"
  }
}
```

---

## 📄 License
ISC License © 2026 Debabrata Sahoo
