/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IDEN_ISSUER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
