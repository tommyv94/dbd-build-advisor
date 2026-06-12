# Build Advisor — Product Roadmap

Fan-made Dead by Daylight perk build advisor. This document captures planned and suggested future work so it can be referenced across sessions and agent windows.

**Last updated:** 2026-06-12  
**Current release:** see `package.json` / [GitHub Releases](https://github.com/tommyv94/dbd-build-advisor/releases/latest)

---

## Current state (baseline)

What the app already does well:

- **Desktop app** — Electron, Windows + macOS installers, silent in-app auto-updates via GitHub Releases
- **Character collection** — Survivor/Killer roster, perk inventory tiers, power-aware killer logic
- **Build advisor** — Chat-based help with inventory-aware substitutions (optional OpenAI key)
- **Character guides** — Suggested builds and power/play guides per character
- **Saved loadouts** — Per-profile saves; staleness flags when perks or patch data change
- **Live sync** — Refreshes perks and patch version from [dbd.tricky.lol](https://dbd.tricky.lol) on launch
- **Profiles** — Multiple local profiles with import/export
- **Local-first privacy** — Data in `%APPDATA%\Build Advisor\`; API key never bundled

**Distribution for friends (first install only):**  
https://github.com/tommyv94/dbd-build-advisor/releases/latest

---

## Phase 1 — Polish what you have (high impact, builds on existing code)

### Distribution & onboarding

| Item | Description | Notes |
|------|-------------|-------|
| In-app getting started | First-run wizard: pick mains → set perk tiers → optional API key | Most friends won't read the README |
| Release notes in update banner | Show GitHub release notes when an update is available | `electron-updater` can pass `releaseNotes` |
| Install hints (unsigned) | Short first-run note: Windows SmartScreen / macOS right-click → Open | Free alternative to paid code signing; README already documents this |

### Advisor UX

| Item | Description | Notes |
|------|-------------|-------|
| Visual build editor | Drag 4 perks into slots; show synergy notes from existing engines | Reuses `build-intelligence`, `character-guide`, `BuildCard` patterns |
| One-click “Apply suggestion” | Save from character guide or chat directly to loadouts | Avoid copy/paste between advisor and saved builds |
| Stronger “needs review” flow | On patch change, show *what* changed per saved build + suggested replacement | Extend `build-staleness.ts` with actionable fixes |

**Why Phase 1 first:** Biggest gap vs dedicated build tools; mostly UI on top of existing server logic.

---

## Phase 2 — Make it a daily-use tool

### Collection & inventory

| Item | Description |
|------|-------------|
| Bulk tier tools | “Mark all owned DLC perks T3”, “clear unowned”, filter by character/DLC/shrine |
| Perk search by tag | Filter by taxonomy tags (`anti-heal`, `loop-break`, `gen-speed`, etc.) |
| Character favorites / recents | Pin Nurse, Meg, etc. at top of roster |

### Smarter recommendations

| Item | Description |
|------|-------------|
| Playstyle presets | Buttons like “chase Nurse”, “slowdown Hag”, “gen defense survivor” that pre-fill advisor context |
| Build compare | Two saved loadouts side-by-side with overlap/conflict highlights |
| Offline resilience | Cache last good API snapshot; app works when tricky.lol is down (show “cached patch X”) |

### Profiles & sharing

| Item | Description |
|------|-------------|
| Shareable build codes | Export/import short JSON or text blob — no server required |
| Profile templates | Starters: “Fresh account”, “Full meta”, “Killer main only” |

---

## Phase 3 — Bigger bets

### Advisor without OpenAI

| Item | Description |
|------|-------------|
| Local LLM (O.g. Ollama) | Chat for friends who won't use OpenAI |
| Pure rules mode | Toggle: inventory + scoring + guides only, no API key required |

### Platform & reach

| Item | Description |
|------|-------------|
| ~~macOS build~~ | ✅ Universal DMG + ZIP, CI on `macos-latest`, auto-update via `latest-mac.yml` |
| Optional hosted web build | Read-only collection + guides for people who won't install desktop app |

### Game depth (if API/data allows)

| Item | Description |
|------|-------------|
| Killer addons / items | Extend power-aware logic beyond perks |
| Patch changelog panel | When `perkVersion` bumps, show buffs/nerfs relevant to user's inventory |
| Archetype meta notes | Lightweight patch-aware blurbs tied to scoring, not scraped tier lists |

---

## Phase 4 — Nice-to-have / fan flair

| Item | Description |
|------|-------------|
| Discord Rich Presence | e.g. “Build Advisor · Nurse loadouts” |
| Offerings / map tags on saved builds | Notes-only metadata on loadouts |
| Collection stats | “78% of survivor perks owned at T3” |
| Custom themes | Alternate fog palettes; separate mute for stinger vs ambient |

---

## Recommended priority order

| Order | Focus | Rationale |
|-------|--------|-----------|
| 1 | Visual build editor + apply-from-guide + onboarding | Core UX; reuses existing engines |
| 2 | Perk tag search + bulk inventory + share codes | Friends set up fast and swap builds |
| 3 | Offline cache + patch review UX | Reliability when game/API updates |
| 4 | Local LLM / no-key advisor mode | Lower barrier without OpenAI |

---

## Explicitly deprioritized (for now)

| Item | Why not early |
|------|----------------|
| Code signing (Win + Mac) | Paid certs (~$200–400/yr); out of scope — friends use README / in-app install hints instead |
| Bloodweb / Steam sync | No clean official API; high effort, fragile |
| Cloud accounts / sync | Conflicts with local-first privacy unless explicitly desired |
| Mobile app | DBD planning fits desktop; mobile is a separate product |

---

## Technical context for agents

Key areas when implementing roadmap items:

| Area | Path |
|------|------|
| UI shell | `src/App.tsx`, `src/App.css`, `src/dbd-atmosphere.css` |
| Collection | `src/components/CharacterCollection.tsx` |
| Advisor chat | `src/components/ChatPanel.tsx`, `server/chat-handler.ts` |
| Build logic | `server/build-engine.ts`, `server/build-intelligence.ts` |
| Character guides | `server/character-guide.ts` |
| Saved builds / staleness | `src/components/SavedBuildsPanel.tsx`, `src/lib/build-staleness.ts` |
| Profiles | `src/components/ProfileManager.tsx`, `server/profiles.ts` |
| Game data API | `server/dbd-api.ts` |
| Killer synergy | `server/killer-synergy.ts`, `server/mechanics-analyzer.ts` |
| Perk taxonomy | `server/perk-taxonomy.ts` |
| Desktop / updates | `electron/main.mjs`, `electron/updater.mjs`, `.github/workflows/release.yml` |
| Types | `src/types.ts` |

**Release process:** bump `package.json` version → commit → `git tag vX.Y.Z` → push tag → GitHub Actions publishes installer + `latest.yml`.

---

## How to use this file

- Pick a **phase** and **item** before starting work in a new agent session.
- Link PRs/commits to roadmap items when possible.
- Update **Last updated** and strike through or move items to a “Done” section as they ship.

### Done (move items here as completed)

- [x] GitHub Releases distribution (share link, not Discord `.exe`)
- [x] In-app auto-update (check on launch + interval, silent install)
- [x] App version in UI (header + settings)
- [x] macOS + Windows releases (universal Mac DMG, Windows NSIS, dual-platform CI)
- [x] Release workflow dedupe fix (incomplete duplicate GitHub releases)
- [x] First-run onboarding wizard (mains → perk tiers → optional API key)
- [x] Install hints for unsigned desktop builds (in onboarding welcome step)
- [x] Release notes in update banner (`What's new` expandable)
- [x] Visual build editor / Build lab (4 slots, synergy notes via enrich API)
- [x] One-click save from character guides, chat, and build lab
- [x] Stronger needs-review flow (`Apply fix` on stale saved builds via reconcile API)
