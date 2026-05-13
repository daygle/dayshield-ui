# DayShield UI

React + Vite frontend for DayShield management.

This package produces the static management UI bundle used by DayShield.
GitHub Actions builds the release artifact automatically; local builds are for
development validation only.

## Requirements

- Node.js 18+
- npm

## Install dependencies

```sh
npm install
```

## Build

```sh
npm run build
```

The production assets are emitted to `dist/`.

## Notes

- The backend API is provided by `dayshield-core` (default service port `8443`).
- Suricata managed rulesets are configured from **Security → Suricata → Rulesets**
  (install, update checks, update, enable/disable, and removal actions when supported by backend API).
- There is no supported development server or preview workflow in this package.
- Tagged releases are built and published automatically through the
	`dayshield-core` release workflow as `ui-vX.Y.Z.tar.zst`.
