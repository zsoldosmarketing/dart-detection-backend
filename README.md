# Darts Training App 🎯

A comprehensive darts training and competition application with advanced features including automatic dart detection using computer vision.

## Key Features

- **Training Programs** - Structured training drills and programs
- **Multiple Game Modes** - 501, Cricket, Halve-It, Shanghai, Killer, Knockout
- **PVP System** - Real-time online multiplayer matches
- **Statistics Tracking** - Comprehensive game and player statistics
- **Voice Control** - Hands-free score input with voice recognition
- **Camera Detection** *(Optional)* - Automatic dart detection using AI/Computer Vision
- **Clubs & Tournaments** - Create and join clubs, participate in tournaments
- **Friend System** - Add friends, challenge them to matches
- **Progressive Web App** - Install on any device, works offline

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Optional: Camera Detection Setup

The app includes an **optional** automatic dart detection feature using computer vision.

**For users:** This feature is OFF by default. Enable it only if you want automatic camera-based dart detection.

**For developers:** To enable camera detection:

1. **Quick Setup (5 minutes):** See [QUICK_SETUP.md](./QUICK_SETUP.md)
2. **Full Documentation:** See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
3. **Backend Details:** See [dart-detection-backend/README.md](./dart-detection-backend/README.md)

**Note:** Camera detection requires deploying a Python backend (free on Render.com).

## Technology Stack

- **Frontend:** React + TypeScript + Vite
- **Styling:** TailwindCSS
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Real-time:** Supabase Realtime
- **Computer Vision Backend** *(Optional)*: Python + FastAPI + OpenCV
- **State Management:** Zustand
- **Icons:** Lucide React

## Build & Deploy

```bash
npm run build
```

Deploy the `dist` folder to any static hosting provider (Vercel, Netlify, etc.)

## License

MIT
