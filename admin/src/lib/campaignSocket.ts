import { wsURL } from "./api";
import type { BonusCampaign, BonusCampaignClaim } from "./api";

// Events the server pushes on the bonus-campaign channel.
export type CampaignEvent =
  | { event: "created"; data: BonusCampaign }
  | {
      event: "claim";
      data: { campaign_id: string; claimed_count: number; slots: number; claim: BonusCampaignClaim };
    }
  | { event: "ended"; data: { campaign_id: string } };

/**
 * Live connection to the admin bonus-campaign feed.
 *
 * This is NOT polling: the socket sits idle and the server pushes a frame the
 * instant a claim lands, so the scoreboard fills in real time during a
 * stampede. It reconnects with backoff if the connection drops, and calls
 * onReconnect so the caller can reload once to catch anything missed while it
 * was away — the one moment a refetch is actually warranted.
 */
export function openCampaignSocket(handlers: {
  onEvent: (e: CampaignEvent) => void;
  onReconnect?: () => void;
}): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempts = 0;
  let hadConnection = false;
  let retimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed) return;
    ws = new WebSocket(wsURL("/ws/admin/bonus-campaign"));

    ws.onopen = () => {
      attempts = 0;
      // Only after a real drop-and-recover: refetch to reconcile. Not on the
      // first connect, where the caller has already loaded via REST.
      if (hadConnection) handlers.onReconnect?.();
      hadConnection = true;
    };

    ws.onmessage = (ev) => {
      try {
        handlers.onEvent(JSON.parse(ev.data) as CampaignEvent);
      } catch {
        // A frame we cannot parse is not worth tearing the socket down for.
      }
    };

    ws.onclose = () => {
      if (closed) return;
      // Exponential backoff capped at 10s, so a backend blip does not become a
      // reconnect storm.
      const delay = Math.min(10000, 500 * 2 ** attempts);
      attempts += 1;
      retimer = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      // onclose fires next and owns the reconnect; nothing to do here.
      ws?.close();
    };
  };

  connect();

  // Teardown for the caller's effect cleanup.
  return () => {
    closed = true;
    if (retimer) clearTimeout(retimer);
    ws?.close();
  };
}
