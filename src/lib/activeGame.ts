import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { GameSocket } from "@/lib/ws";
import { useWallet } from "@/store/walletStore";
import type { Game } from "@/types/api";

// Polls the purpose-built /me/active-game endpoint and surfaces the one live
// game the user can return to. This single-row lookup replaces scanning
// paginated history: it can't be thrown off by the pagination window or by
// payload-shape drift, so the return-to-game pill stays reliable.
//
// Note the endpoint nests the live Game under `game.game` (the outer object is
// the participation entry). We stay defensive on shape — tolerating both the
// nested and a flat game — so a backend response quirk can never silently hide
// the pill.
export function useActiveGame(): Game | null {
  const { data } = useQuery({
    queryKey: ["active-game"],
    queryFn: () => api.activeGame(),
    refetchInterval: 5000,
  });
  return useMemo(() => {
    const entry: any = data?.game ?? null;
    if (!entry) return null;
    const g: Game | undefined = entry?.game ?? entry;
    return g && g.state ? g : null;
  }, [data]);
}

// Refresh the wallet the moment the player's live game ends — i.e. the polled
// active game goes from present to gone (won, lost, refunded, or cancelled).
//
// A player watching in the game room already gets a fresh balance from the
// WINNER socket event. But one who navigated away (e.g. tapped back to the
// lobby) isn't on that socket, so no event reaches them and their prize/refund
// wouldn't show until they reopened the app. This closes that gap wherever they
// are, within one poll interval.
export function useRefreshWalletOnGameEnd(activeGame: Game | null) {
  const refresh = useWallet((s) => s.refresh);
  const prevId = useRef<string | null>(null);
  useEffect(() => {
    const cur = activeGame?.id ?? null;
    if (prevId.current && !cur) refresh().catch(() => {});
    prevId.current = cur;
  }, [activeGame, refresh]);
}

// Instant (0s) balance refresh: while the player has a live game but ISN'T in
// its room, keep a lightweight spectator socket to that game so the WINNER /
// FINISHED / CANCELLED event reaches them the moment it fires — then refresh the
// wallet. This is the real-time path; useRefreshWalletOnGameEnd (poll) is the
// safety net if the socket is down or a message is missed.
//
// Skipped while the game room itself is open (it already has its own socket and
// refreshes on WINNER), so we never run two sockets to the same game.
export function useActiveGameLiveRefresh(activeGame: Game | null) {
  const refresh = useWallet((s) => s.refresh);
  const { pathname } = useLocation();
  const id = activeGame?.id ?? null;
  const inRoom = !!id && pathname === `/game/${id}`;

  useEffect(() => {
    if (!id || inRoom) return;
    const feed = new GameSocket(id);
    const off = feed.on((msg) => {
      const terminal =
        msg.event === "WINNER" ||
        (msg.event === "GAME_STATUS" &&
          ["FINISHED", "CANCELLED"].includes(
            (msg.data as any)?.status ?? (msg.data as any)?.state,
          ));
      if (terminal) refresh().catch(() => {});
    });
    feed.connect();
    return () => {
      off();
      feed.close();
    };
  }, [id, inRoom, refresh]);
}
