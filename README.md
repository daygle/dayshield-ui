# DayShield Firewall UI

React + Vite frontend for DayShield Firewall management.

This package produces the static management UI bundle used by DayShield Firewall.
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
- Each component — Core, Web UI, and Root Filesystem — carries its own independent
  version/tag. The UI artifact is published as `ui-vX.Y.Z.tar.zst` and its version
  need not match the core or rootfs release tags.
- The update registry resolves the latest artifact version for each component
  independently through a manifest-driven model; a component absent from a given
  manifest release is not treated as an error.
