# Changelog

## 0.1.0 — 2026-06-23

### Added

- Global CLI: `reelio setup`, `login`, `start`, `stop`, `doctor`
- `postinstall` auto-installs Playwright Chromium and player/Electron deps
- Config loaded from `~/.reelio/.env` with session at `~/.reelio/session`
- Production Electron player loads `player/dist` (no Vite dev server required)
- `GET /api/config` for dynamic player API/WebSocket URLs
- Install manifest at `~/.reelio/install-manifest.json`
- Smoke test script: `npm run test:smoke`

### Packaging

- Player UI prebuilt in `player/dist/` for npm tarball (Option 1)
- Electron moved to `player` runtime dependencies
