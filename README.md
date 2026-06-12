# DBD Build Advisor

A fan-made Dead by Daylight perk build advisor — desktop app with live game data, character collection, saved loadouts, and optional AI chat.

> **Not affiliated with Behaviour Interactive.** Perk data comes from the community [dbd.tricky.lol](https://dbd.tricky.lol) API.

## Download (for you & friends)

**Share this link in Discord** — no need to upload the `.exe`:

**https://github.com/tommyv94/dbd-build-advisor/releases/latest**

Friends click **Build Advisor Setup X.X.X.exe** on that page and run the installer. The installed app also checks for updates automatically and shows a banner when a new version is available.

## Features

- **Character collection** — Survivor/Killer roster, perk inventory, power-aware killer suggestions
- **Build advisor** — Chat-based build help with inventory-aware substitutions
- **Saved loadouts** — Save builds per profile; flags outdated perks when game data updates
- **Live sync** — Refreshes perks and patch version from the API on launch
- **Auto-updates** — Installed app checks GitHub Releases for new versions
- **Desktop app** — Frameless Electron UI with fog ambience (optional OpenAI key in settings)

## Quick start (development)

```bash
npm install --legacy-peer-deps
npm run dev
```

Launches the desktop app (Electron + embedded API).

Web-only development:

```bash
npm run dev:web
```

Open http://localhost:5173 (API on http://localhost:3001).

## Build Windows installer (local)

```bash
npm run build:installer
```

Output: `dist-electron/Build Advisor Setup X.X.X.exe`

## Publish a release (updates for everyone)

1. Bump `"version"` in `package.json` (e.g. `1.0.2`)
2. Commit and push to GitHub
3. Create and push a tag:

```bash
git tag v1.0.2
git push origin v1.0.2
```

GitHub Actions builds the installer and uploads it to **Releases** (including the `latest.yml` file the app uses for auto-update).

You can also run the workflow manually: **Actions → Release → Run workflow**.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Desktop app (recommended) |
| `npm run dev:web` | Browser + Express API |
| `npm run build:installer` | Windows NSIS installer (local only) |
| `npm run release` | Build + publish to GitHub Releases (needs `GH_TOKEN`) |
| `npm run icons` | Regenerate app icons from `build/icon.svg` |

## Data & privacy

- Profiles, API keys, and saved builds are stored **locally** (`%APPDATA%\Build Advisor` on Windows).
- Optional OpenAI key stays on your machine — never bundled in the installer or sent anywhere except OpenAI when you use chat.

## License

Fan tool for personal use. Dead by Daylight is © Behaviour Interactive.
