/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_WS_BASE?: string;
  readonly VITE_BOT_USERNAME?: string;
  readonly VITE_DEV_TELEGRAM_SHIM?: string;
  readonly VITE_DEV_MOCK_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
