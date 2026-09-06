import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useActiveGame,
  useActiveGameLiveRefresh,
  useRefreshWalletOnGameEnd,
} from "@/lib/activeGame";
import { finishedGames } from "@/lib/finishedGames";

// Headless (renders nothing). Replaces the old "return to live game" pill:
//  - keeps the wallet fresh when the player's live game ends, and
//  - on open, routes a player who is already mid-draw straight into the game
//    room — no intermediate screen.
// Pre-draw games (WAITING/COUNTDOWN) are left on the picker, which is where
// joining / the countdown happen.
export function LiveGameSync() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const activeGame = useActiveGame();
  useActiveGameLiveRefresh(activeGame);
  useRefreshWalletOnGameEnd(activeGame);

  // Redirect once per session-open, so the player isn't yanked back into the
  // room if they later navigate away (e.g. to the wallet).
  const redirected = useRef(false);
  useEffect(() => {
    if (redirected.current) return;
    if (
      activeGame?.state === "DRAWING" &&
      activeGame.id &&
      !finishedGames.has(activeGame.id) &&
      !pathname.startsWith("/game")
    ) {
      redirected.current = true;
      nav(`/game/${activeGame.id}`);
    }
  }, [activeGame, pathname, nav]);

  return null;
}
