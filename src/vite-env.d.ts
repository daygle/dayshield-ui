/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_RELEASE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
