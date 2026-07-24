# Reelio

A local companion that plays Instagram Reels in an always-on-top overlay while you code with [Claude Code](https://claude.ai/code).

**Not affiliated with Instagram, Meta, or Anthropic.** Uses your personal Instagram session via browser automation. For personal/developer use only — may break when Instagram changes.

## Requirements

- Node.js 18+
- macOS (primary; other platforms untested in v0.1)
- Claude Code

## Install

```bash
npm install -g reelio
```

First install automatically downloads Playwright Chromium and player dependencies.

## Quick start

```bash
reelio setup              # creates ~/.reelio/.env
# Edit ~/.reelio/.env with IG_USERNAME and IG_PASSWORD

reelio hooks install      # Claude play/pause hooks (any project)
reelio login              # one-time Instagram login (visible browser)
reelio start              # server + overlay player
reelio doctor             # verify install
```

Open Claude Code in **any project**, submit a prompt — reels play for the full turn and pause when Claude finishes.

## Commands

| Command | Description |
|---------|-------------|
| `reelio setup [--hooks]` | Create `~/.reelio/.env` |
| `reelio login` | Save Instagram session to `~/.reelio/session` |
| `reelio start [--foreground]` | Start server (:3001) + Electron player |
| `reelio stop` | Stop server and player |
| `reelio doctor` | Health checks |
| `reelio scrape [--count <n>] [--out <path>] [--fresh] [--headless]` | Scrape explore Reels to JSON (no player) |
| `reelio hooks install` | Install global Claude Code hooks |

## Configuration

Config file: `~/.reelio/.env` (see `.env.example`).

| Variable | Default | Purpose |
|----------|---------|---------|
| `REELIO_HOME` | `~/.reelio` | Data directory |
| `PORT` | `3001` | API server port |
| `REELIO_API` | `http://localhost:3001` | Hook scripts API base |
| `HEADLESS` | `true` | Hide Playwright browser (`false` for login) |
| `IG_USERNAME` / `IG_PASSWORD` | — | First-time login only |

## Development

```bash
git clone <repo> && cd Reelio
npm install                 # runs postinstall
npm link                    # puts `reelio` on your PATH (local dev)
# or use npm scripts: npm run doctor, npm run setup, npm run start:all

npm start                   # server only
npm run player              # Electron + Vite dev server
npm run hooks:install
npm run test:smoke          # requires running server
```

## Troubleshooting

**Port in use** — Change `PORT` in `~/.reelio/.env` or run `reelio stop`.

**No reels / buffer empty** — Run `reelio login`, then `reelio start`. Wait for startup seed or check `curl localhost:3001/api/buffer/status`.

**Hooks not firing** — Run `reelio hooks status`. Server must be running before Claude prompts.

**Player blank** — Run `cd player && npm run build`, or reinstall: `npm install -g reelio`.

Run `reelio doctor` for a full checklist.

## Privacy

100% local. No telemetry. Credentials stay in `~/.reelio/.env`.

## License

MIT — see [LICENSE](LICENSE).
