# DBD Build Advisor

A fan-made Dead by Daylight perk build advisor — desktop app with live game data, character collection, saved loadouts, and optional AI chat.

> **Not affiliated with Behaviour Interactive.** Perk data comes from the community [dbd.tricky.lol](https://dbd.tricky.lol) API.

## Features

- **Character collection** — Survivor/Killer roster, perk inventory, power-aware killer suggestions
- **Build advisor** — Chat-based build help with inventory-aware substitutions
- **Saved loadouts** — Save builds per profile; flags outdated perks when game data updates
- **Live sync** — Refreshes perks and patch version from the API on launch
- **Desktop app** — Frameless Electron UI with fog ambience (optional OpenAI key in settings)

## Quick start (development)

```bash
npm install
npm run dev
```

Launches the desktop app (Electron + embedded API).

Web-only development:

```bash
npm run dev:web
```

Open http://localhost:5173 (API on http://localhost:3001).

## Build Windows installer

```bash
npm run build:installer
```

Output: `dist-electron/Build Advisor Setup 1.0.0.exe`

Share the `.exe` with friends — each install uses its own local profile data (nothing from your machine is bundled).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Desktop app (recommended) |
| `npm run dev:web` | Browser + Express API |
| `npm run build` | Production frontend build |
| `npm run build:engine` | Bundle server engine for Electron |
| `npm run build:installer` | Windows NSIS installer |
| `npm run icons` | Regenerate app icons from `build/icon.svg` |

## Data & privacy

- Profiles, API keys, and saved builds are stored **locally** (`%APPDATA%\Build Advisor` on Windows for the installed app).
- Dev desktop uses the same AppData folder as the installed app on your PC.
- Optional OpenAI key is stored in your local profile only — never sent anywhere except OpenAI when you use chat.

## License

Fan tool for personal use. Dead by Daylight is © Behaviour Interactive.
