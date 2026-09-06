// Reconnecting WebSocket client for the read-only game stream.
// Endpoint: ws(s)://host/api/v1/ws/game?type=VIP  or  /ws/game/:gameId
import type { WsMessage } from "@/types/api";

function wsBase(): string {
  const explicit = import.meta.env.VITE_WS_BASE as string | undefined;
  if (explicit) return explicit.replace(/\/$/, "");
  const apiBase = (import.meta.env.VITE_API_BASE ?? "http://localhost:8000")
    .replace(/\/$/, "")
    .replace(/^http/, "ws"); // http->ws, https->wss
  return apiBase;
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

export function gameSocketUrl(target: string): string {
  const base = wsBase();
  return target === "REGULAR" || target === "VIP"
    ? `${base}/api/v1/ws/game?type=${encodeURIComponent(target)}`
    : `${base}/api/v1/ws/game/${segment(target)}`;
}

type Listener = (msg: WsMessage) => void;
type StatusListener = (status: "connecting" | "open" | "closed") => void;

export class GameSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private attempts = 0;
  private closedByUser = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly url: string;

  /** `target` is a game type (REGULAR / VIP) or a game UUID. */
  constructor(target: string) {
    this.url = gameSocketUrl(target);
  }

  connect() {
    this.closedByUser = false;
    this.open();
  }

  private open() {
    this.emitStatus("connecting");
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.attempts = 0;
      this.emitStatus("open");
    };
    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsMessage;
        this.listeners.forEach((l) => l(msg));
      } catch {
        /* ignore malformed */
      }
    };
    this.ws.onclose = () => {
      this.emitStatus("closed");
      if (!this.closedByUser) this.scheduleReconnect();
    };
    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (this.closedByUser) return;
    this.attempts = Math.min(this.attempts + 1, 6);
    const delay = Math.min(1000 * this.attempts, 6000);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private emitStatus(s: "connecting" | "open" | "closed") {
    this.statusListeners.forEach((l) => l(s));
  }

  close() {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.listeners.clear();
    this.statusListeners.clear();
  }
}
