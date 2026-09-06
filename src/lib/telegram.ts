// Thin wrapper over the Telegram WebApp runtime (window.Telegram.WebApp),
// injected by telegram-web-app.js in index.html. Falls back to a dev shim so
// the app can run in a plain browser during development.

type HapticStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type HapticNotify = "error" | "success" | "warning";

interface TGWebApp {
  initData: string;
  initDataUnsafe: any;
  version: string;
  colorScheme: string;
  ready(): void;
  expand(): void;
  close(): void;
  // 7.7+: stop Telegram from hijacking vertical drags to minimize the app,
  // which otherwise steals scroll from inner overflow regions.
  disableVerticalSwipes?(): void;
  enableVerticalSwipes?(): void;
  openTelegramLink(url: string): void;
  openLink(url: string): void;
  HapticFeedback?: {
    impactOccurred(style: HapticStyle): void;
    notificationOccurred(type: HapticNotify): void;
    selectionChanged(): void;
  };
  MainButton?: {
    setText(t: string): void;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
  };
  BackButton?: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TGWebApp };
  }
}

const SHIM_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_DEV_TELEGRAM_SHIM === "1";

/**
 * Dev-only fake initData. The backend verifies the HMAC signature, so this will
 * NOT pass real Telegram validation — it only lets the UI render in a browser.
 * For end-to-end testing against the backend, paste a real initData string into
 * localStorage under "dev_init_data".
 */
function devInitData(): string {
  const override = localStorage.getItem("dev_init_data");
  if (override) return override;
  // A plausible-looking (but unsigned) initData blob.
  const user = encodeURIComponent(
    JSON.stringify({
      id: 123456789,
      first_name: "Dev",
      last_name: "Player",
      username: "devplayer",
      language_code: "en",
    }),
  );
  return `user=${user}&auth_date=1700000000&hash=devshimhash`;
}

export const tg: TGWebApp | null =
  typeof window !== "undefined" ? window.Telegram?.WebApp ?? null : null;

export function isInTelegram(): boolean {
  return !!tg && !!tg.initData && tg.initData.length > 0;
}

export function getInitData(): string {
  if (isInTelegram()) return tg!.initData;
  if (SHIM_ENABLED) return devInitData();
  return "";
}

export function initTelegram(): void {
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    // Let inner scroll regions (e.g. the card picker) handle vertical drags
    // instead of Telegram closing/minimizing the app.
    tg.disableVerticalSwipes?.();
    tg.setHeaderColor?.("#12233f");
    tg.setBackgroundColor?.("#0a1526");
  } catch {
    /* older clients */
  }
}

// ---- Haptics (no-ops outside Telegram) ----

export const haptic = {
  impact(style: HapticStyle = "light") {
    tg?.HapticFeedback?.impactOccurred(style);
  },
  notify(type: HapticNotify) {
    tg?.HapticFeedback?.notificationOccurred(type);
  },
  select() {
    tg?.HapticFeedback?.selectionChanged();
  },
};

// ---- Links ----

export function openTelegramLink(url: string): void {
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank");
}

export function shareToTelegram(url: string, text: string): void {
  const share = `https://t.me/share/url?url=${encodeURIComponent(
    url,
  )}&text=${encodeURIComponent(text)}`;
  openTelegramLink(share);
}
