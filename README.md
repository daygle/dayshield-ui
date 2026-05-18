# DayShield Firewall UI

React + Vite frontend for DayShield Firewall management.

This package produces the static management UI bundle used by DayShield Firewall.
The `.github/workflows/release.yml` workflow builds and publishes the release artifact
automatically when a version tag is pushed; local builds are for development validation only.

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

## Releasing

This repo manages its own release lifecycle independently of `dayshield-core` and
`dayshield-rootfs`. The release workflow (`.github/workflows/release.yml`) is triggered
by a tag push matching `v*` **or** via manual workflow dispatch.

### Create a release

```sh
git tag v1.2.3
git push origin v1.2.3
```

The workflow will:

1. Install dependencies and run `npm run build` (passing the tag as `GITHUB_RELEASE_TAG`
   so the bundle embeds the correct version string).
2. Package the built `dist/` directory as `ui-v1.2.3.tar.zst`.
3. Compute a `ui-v1.2.3.tar.zst.sha256` checksum file.
4. Create a GitHub Release tagged `v1.2.3` and attach both files as release assets.

### Manual dispatch

If you need to re-publish an artifact without creating a new tag (e.g. a CI retry), use
**Actions → Release UI Artifact → Run workflow** and supply the tag name in the input
field.

### Artifact naming convention

| Asset | Description |
|---|---|
| `ui-vX.Y.Z.tar.zst` | zstd-compressed tarball of the production build |
| `ui-vX.Y.Z.tar.zst.sha256` | SHA-256 checksum of the tarball |

The on-device updater fetches the artifact URL from the central update manifest. The
manifest maps each component (`core`, `ui`, `rootfs`) to its own latest release
independently — updating one component does not require updating the others.

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
