# DayShield UI

`dayshield-ui` is the frontend package for the DayShield appliance. It builds the static management UI bundle consumed by the DayShield backend and update appliance.

## What this repo contains

This repository provides the web application for DayShield management, including:

- UI pages and components for firewall, DNS, NTP, backup, and system status
- build configuration for Vite, TypeScript, and Tailwind CSS
- production asset packaging for appliance deployment

## Requirements

- Node.js 18 or newer
- npm

## Install

Install dependencies once before development or build:

```sh
npm install
```

## Build

Create the production UI bundle:

```sh
npm run build
```

Production assets are emitted to `dist/`.

## Test

Run any available UI tests or validation commands configured in the package.

```sh
npm test
```

## Notes

- The backend API is provided by `dayshield-core`.
- This repo is focused on frontend code, build output, and release packaging.
- UI versioning is independent from core and rootfs components.
