# DayShield UI

React + Vite frontend for DayShield management.

## Requirements

- Node.js 18+
- npm

## Quick start

```sh
npm install
npm run dev
```

By default, the UI server listens on `http://localhost:8443`.

### Override the UI port

Set `DAYSHIELD_UI_PORT` or `UI_PORT` before running the dev server or preview server:

```sh
DAYSHIELD_UI_PORT=8080 npm run dev
```

You can also put the setting in a `.env` file in the repository root:

```env
DAYSHIELD_UI_PORT=8080
```

## Build

```sh
npm run build
npm run preview
```

## Notes

- The backend API is provided by `dayshield-core` (default service port `3000`).