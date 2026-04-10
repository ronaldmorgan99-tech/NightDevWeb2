/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_STUDIO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
