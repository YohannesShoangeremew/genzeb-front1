import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ScreenShell } from "@/components/layout/ScreenShell";
import { Header } from "@/components/layout/Header";
import { useToast } from "@/components/ui/Toast";
import { FullSpinner } from "@/components/ui/Spinner";
import { BalancePill } from "@/components/ui/BalancePill";
import { LangToggle } from "@/components/ui/LangToggle";
import {
  MAX_CARD_ID,
  MIN_CARD_ID,
  BET_BY_TYPE,
  MAX_CARDS_PER_PLAYER,
} from "@/lib/constants";
import { money } from "@/lib/format";
import { api, ApiError } from "@/lib/api";
import { GameSocket } from "@/lib/ws";
import { haptic } from "@/lib/telegram";
import { sound } from "@/lib/audio";
import { finishedGames } from "@/lib/finishedGames";
import { useWallet } from "@/store/walletStore";
import { useSettings } from "@/store/settingsStore";
import { BonusCampaign } from "@/components/lobby/BonusCampaign";
import type { GameType } from "@/types/api";

const ALL_CARDS = Array.from({ length: MAX_CARD_ID - MIN_CARD_ID + 1 }, (_, i) => i + MIN_CARD_ID);

// `home` = this is the Play tab landing (route "/"): it shows the bottom tab
// bar and a balance + VIP + language header instead of a back button. Without
// it, it's the VIP sub-screen (back button, no tabs) reached from the home VIP
// button.
//
// Flow: tapping a card RESERVES it immediately (no charge, no Join button). The
// stake is taken for everyone when the 40s countdown ends, at which point the
// game starts and reserved players are pulled straight into the board.
export function CardSelect({ home = false }: { home?: boolean }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { gameType } = useParams<{ gameType: GameType }>();
  const type = (gameType ?? "REGULAR") as GameType;
  const bet = BET_BY_TYPE[type] ?? 0;
  const spendable = useWallet((s) => s.spendable);
  const refreshWallet = useWallet((s) => s.refresh);
  const push = useToast((s) => s.push);
  const soundEnabled = useSettings((s) => s.soundEnabled);
  sound.enabled = soundEnabled;

  // Pull a fresh balance whenever the picker opens, so the affordability gating
  // reflects real money — not a stale cached value from a prior game / deposit.
  useEffect(() => {
    refreshWallet().catch(() => {});
  }, [refreshWallet]);

  // Optimistic selection overlay: cards whose on-screen state is ahead of the
  // server. A tap flips the card here INSTANTLY (glow appears/disappears like
  // a click); the reserve/release request then runs in the background and the
  // entry is dropped once the server confirms — or reverted if it refuses.
  const [overlay, setOverlay] = useState<Map<number, "add" | "remove">>(new Map());

  // Fetch/create the active game for this stake (creates if none). Polled:
  // when a round finishes the backend spawns the NEXT game, and a player
  // sitting on this screen must roll over to it automatically — without the
  // poll they'd keep watching the dead game forever (no countdown, no
  // redirect) until they re-opened the bot. The WS below also triggers an
  // immediate refetch on NEW_GAME_AVAILABLE / game-over, so the poll is just
  // the safety net.
  const gameQ = useQuery({
    queryKey: ["game-for-type", type],
    queryFn: async () => (await api.games(type)).games[0] ?? null,
    refetchInterval: 5000,
  });
  const gameId = gameQ.data?.id ?? null;
  const refetchGame = gameQ.refetch;

  // Poll taken cards + live game state (fallback / periodic reconcile).
  const stateQ = useQuery({
    queryKey: ["game-state", gameId],
    queryFn: () => api.gameState(gameId!),
    enabled: !!gameId,
    refetchInterval: 3000,
  });

  // Live taken-cards set: seeded from poll snapshots, then kept current in
  // REAL TIME by the game WebSocket — the backend broadcasts PLAYER_JOINED /
  // PLAYER_LEFT with the card_id on every reservation and release, so other
  // players' picks grey out here within milliseconds instead of waiting for
  // the next 3s poll. That makes two-players-tap-the-same-card races rare;
  // when one still happens, the server arbitrates and the loser's optimistic
  // tap reverts (see syncCard).
  const [takenLive, setTakenLive] = useState<Set<number>>(new Set());
  const [livePrize, setLivePrize] = useState<number | null>(null);
  // Server-anchored countdown end, expressed on the LOCAL clock: set from the
  // server-computed secondsLeft in WS INITIAL_STATE (someone opening the app
  // mid-countdown gets the true remaining time immediately) and re-anchored by
  // every per-second COUNTDOWN tick. Deriving seconds from the game's
  // countdown_ends timestamp against Date.now() — the fallback below — is off
  // by however much the player's device clock is skewed, which can freeze the
  // display at 0 with many seconds left or hold it past the real start.
  const [serverEndsAt, setServerEndsAt] = useState<number | null>(null);
  useEffect(() => {
    if (stateQ.data?.takenCards) setTakenLive(new Set(stateQ.data.takenCards));
  }, [stateQ.data]);
  useEffect(() => {
    if (!gameId) return;
    setLivePrize(null); // prize belongs to a game; reset when it changes
    const feed = new GameSocket(gameId);
    const off = feed.on((msg) => {
      switch (msg.event) {
        case "INITIAL_STATE":
          if (Array.isArray(msg.data?.takenCards)) {
            setTakenLive(new Set<number>(msg.data.takenCards));
          }
          if (typeof msg.data?.game?.prize_pool === "number") {
            setLivePrize(msg.data.game.prize_pool);
          }
          if (
            msg.data?.game?.state === "COUNTDOWN" &&
            typeof msg.data?.secondsLeft === "number"
          ) {
            setServerEndsAt(Date.now() + msg.data.secondsLeft * 1000);
          }
          break;
        case "COUNTDOWN":
          if (typeof msg.data?.secondsLeft === "number") {
            setServerEndsAt(Date.now() + msg.data.secondsLeft * 1000);
          }
          break;
        case "PLAYER_JOINED":
        case "PLAYER_LEFT": {
          const cardId = msg.data?.card_id;
          if (typeof cardId === "number") {
            setTakenLive((prev) => {
              const n = new Set(prev);
              if (msg.event === "PLAYER_JOINED") n.add(cardId);
              else n.delete(cardId);
              return n;
            });
          }
          if (typeof msg.data?.prize_pool === "number") {
            setLivePrize(msg.data.prize_pool);
          }
          break;
        }
        // The round we're watching ended and its successor exists (the backend
        // announces it on the OLD game's channel) — jump to the new round now
        // rather than on the next poll, so the fresh grid/countdown appears
        // with no manual action.
        case "NEW_GAME_AVAILABLE":
          refetchGame();
          break;
        case "GAME_STATUS": {
          const status = msg.data?.status ?? msg.data?.state;
          if (status === "FINISHED" || status === "CANCELLED") refetchGame();
          // Countdown aborted (not enough paying players → back to WAITING):
          // drop the anchor so the hero doesn't keep ticking a dead countdown.
          if (status === "WAITING") setServerEndsAt(null);
          break;
        }
      }
    });
    feed.connect();
    return () => {
      off();
      feed.close();
    };
  }, [gameId]);
  const taken = takenLive;

  // Live snapshot for the hero: prize, player count, state and the countdown.
  const liveGame = stateQ.data?.game ?? gameQ.data ?? null;
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // Prefer the server-anchored end (skew-free); fall back to the game's
  // countdown_ends timestamp only until the first WS anchor arrives.
  const countdownEnds =
    serverEndsAt ??
    (liveGame?.countdown_ends ? Date.parse(liveGame.countdown_ends) : null);
  const secondsLeft =
    countdownEnds != null ? Math.max(0, Math.ceil((countdownEnds - nowTs) / 1000)) : null;
  // A live server anchor still in the future proves the countdown is running
  // even while the 3s state poll hasn't caught up yet (e.g. the app was opened
  // seconds after the countdown started).
  const isCountdown =
    secondsLeft != null &&
    (liveGame?.state === "COUNTDOWN" || (serverEndsAt != null && serverEndsAt > nowTs));
  // Human-readable daily round code from the backend, e.g. "3" (3rd game of the
  // day). Falls back to a game-id slice for older games without the field.
  const roundCode =
    liveGame?.round_code ||
    (gameId ? gameId.replace(/-/g, "").slice(0, 4).toUpperCase() : "----");

  // The player's winnings today (Ethiopian day) — the WIN stat in the hero.
  // Refetched when a round ends so a fresh win shows the moment the player
  // lands back on the picker.
  const winningsQ = useQuery({
    queryKey: ["my-winnings"],
    queryFn: api.myWinnings,
    refetchInterval: 60000,
  });

  // Cards this player has reserved in the current game.
  const ownedQ = useQuery({
    queryKey: ["my-cards", gameId],
    queryFn: () => api.myCardsInGame(gameId!),
    enabled: !!gameId,
    refetchInterval: 3000,
  });
  const serverOwned = useMemo(
    () => new Set((ownedQ.data?.cards ?? []).map((c) => c.card_id)),
    [ownedQ.data],
  );

  // What the player sees = server state + optimistic overlay.
  const owned = useMemo(() => {
    const s = new Set(serverOwned);
    overlay.forEach((op, id) => (op === "add" ? s.add(id) : s.delete(id)));
    return s;
  }, [serverOwned, overlay]);

  // Per-card background sync machinery: `desired` is the latest intent (what
  // the player wants the card to be), `confirmed` the last state the server
  // acknowledged to us directly (poll data may lag it by up to 3s), `inFlight`
  // guards one request chain per card. A rapid select→unselect while the first
  // request is still on the wire simply updates `desired`; the chain fires the
  // follow-up call when the first completes — latest intent always wins.
  const desired = useRef(new Map<number, boolean>());
  const confirmed = useRef(new Map<number, boolean>());
  const inFlight = useRef(new Set<number>());
  const serverOwnedRef = useRef(serverOwned);
  serverOwnedRef.current = serverOwned;

  // Drop overlay entries (and per-card confirmations) once a poll agrees with
  // them — the server has caught up, the base data is now authoritative. Until
  // then the overlay keeps the glow correct even if a stale in-flight poll
  // response lands after a successful reserve.
  useEffect(() => {
    setOverlay((prev) => {
      const n = new Map(prev);
      let changed = false;
      n.forEach((op, id) => {
        if ((op === "add") === serverOwned.has(id)) {
          n.delete(id);
          confirmed.current.delete(id);
          changed = true;
        }
      });
      return changed ? n : prev;
    });
  }, [serverOwned]);

  const ownedCount = owned.size;
  const takenCount = taken.size; // total cards reserved in this game (all players)

  // When the countdown ends and drawing begins, pull reserved players straight
  // into the game board (only once).
  // Once a round is being drawn, everyone goes into the room — players to play,
  // and anyone who didn't pick a card to spectate ("wait for next round"). One
  // game per table, so the picker only ever shows the single current game.
  //
  // Players are sent in with ~2s STILL LEFT on the countdown — not when the
  // 3s state-poll notices DRAWING — so the room is mounted and its game socket
  // connected BEFORE the first number is drawn: the player sees the last tick
  // ("2…1"), then the first call arrives live with its voice, instead of
  // finding a number already sitting on the board. (Combined with the
  // backend's first-draw grace this leaves several seconds of headroom even
  // on a slow connection.)
  const enteredRef = useRef(false);

  // Rolling over to the next round replaces gameId while the picker stays
  // mounted — every bit of per-game local state must reset with it, or the
  // old round's optimistic glows / taken cards / entry latch would leak onto
  // the fresh grid.
  useEffect(() => {
    enteredRef.current = false;
    setOverlay(new Map());
    setTakenLive(new Set());
    setLivePrize(null);
    setServerEndsAt(null);
    desired.current.clear();
    confirmed.current.clear();
    inFlight.current.clear();
  }, [gameId]);

  // Poll-based fallback for the rollover (the WS refetch above is the fast
  // path): if the state feed says the watched round is over, look up its
  // successor.
  const roundOver = liveGame?.state === "FINISHED" || liveGame?.state === "CANCELLED";
  const refetchWinnings = winningsQ.refetch;
  useEffect(() => {
    if (roundOver) {
      refetchGame();
      refetchWinnings(); // a just-won prize shows in WIN immediately
    }
  }, [roundOver, refetchGame, refetchWinnings]);

  useEffect(() => {
    const drawing = liveGame?.state === "DRAWING";
    const countdownEnded =
      isCountdown && secondsLeft !== null && secondsLeft <= 2 && ownedCount > 0;
    if (
      (drawing || countdownEnded) &&
      gameId &&
      !finishedGames.has(gameId) && // never bounce back into a game that's over
      !enteredRef.current
    ) {
      enteredRef.current = true;
      haptic.impact("medium");
      nav(`/game/${gameId}`);
    }
  }, [liveGame?.state, isCountdown, secondsLeft, ownedCount, gameId, nav]);

  // Tapping a card reserves it (or releases it if already reserved). No charge
  // happens here — reserved cards are billed together when the game starts.
  //
  // The tap is OPTIMISTIC: the glow flips immediately (feels like a click) and
  // the reserve/release request runs in the background via syncCard. If the
  // server refuses (e.g. another player grabbed the card in the same second),
  // the card visibly reverts and a toast explains why.
  const toggle = (id: number) => {
    if (!gameId) return;
    // Unlock + warm the caller audio on this real user gesture: resume the
    // AudioContext (it starts suspended) and fetch+decode the call clips now, so
    // the FIRST number call in the game room plays instantly instead of being
    // swallowed by a still-suspended context. Idempotent (cached after first).
    sound.preloadCalls();
    const isMine = owned.has(id);
    if (takenByOther(id, isMine)) return; // reserved by someone else

    if (!isMine) {
      if (ownedCount >= MAX_CARDS_PER_PLAYER) {
        push(t("card.maxCards", { max: MAX_CARDS_PER_PLAYER }), "error");
        return;
      }
      // Cash PLUS bonus: bonus pays for cards first, so gating on cash alone
      // locked players out of the very thing their bonus was granted for.
      if (spendable() < (ownedCount + 1) * bet) {
        push(t("card.insufficient"), "error");
        return;
      }
    }

    haptic.select();
    const want = !isMine;
    desired.current.set(id, want);
    setOverlay((prev) => new Map(prev).set(id, want ? "add" : "remove"));
    void syncCard(id);
  };

  // A card counts as taken by ANOTHER player only when it isn't mine in any
  // sense — not on screen, not on the server, not mid-flight. The WS echoes my
  // own reservation into `taken` almost instantly, so without the extra
  // checks a card I'm releasing would flash the "taken by someone else" style
  // until the release round-trip completes.
  const takenByOther = (id: number, isMine: boolean) =>
    taken.has(id) && !isMine && !serverOwned.has(id) && !overlay.has(id);

  // Background request chain for one card: keep issuing join/leave until the
  // server state matches the player's latest intent. Never runs more than one
  // request per card at a time; new taps just update `desired` and the chain
  // catches up — so a select→unselect faster than one round-trip still ends
  // released on the server (a stale reservation here would bill the player at
  // countdown end).
  const syncCard = async (id: number) => {
    if (!gameId || inFlight.current.has(id)) return;
    inFlight.current.add(id);
    try {
      for (;;) {
        const want = desired.current.get(id);
        const actual = confirmed.current.get(id) ?? serverOwnedRef.current.has(id);
        if (want === undefined || want === actual) break;
        if (want) {
          await api.join(gameId, id); // reserve the card (charged at game start)
        } else {
          await api.leave(gameId, id); // release the reservation (nothing charged)
        }
        confirmed.current.set(id, want);
      }
    } catch (e) {
      // Server refused (card taken in a race, game already started, …): revert
      // this card's optimistic state and re-sync the grid so the player sees
      // the truth.
      desired.current.delete(id);
      setOverlay((prev) => {
        const n = new Map(prev);
        n.delete(id);
        return n;
      });
      const msg = e instanceof ApiError ? e.message : "error";
      push(msg === "insufficient balance" ? t("card.insufficient") : msg, "error");
      void Promise.all([ownedQ.refetch(), stateQ.refetch()]);
    } finally {
      inFlight.current.delete(id);
    }
  };

  if (gameQ.isLoading) {
    return (
      <ScreenShell tabs={home}>
        {!home && <Header back title={`${type} · ${money(bet)}`} />}
        <FullSpinner label={t("common.loading")} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell tabs={home}>
      {home ? (
        // Landing header: balance, a VIP-room shortcut, sound + language toggles.
        <div className="mb-3 flex items-center justify-between gap-2">
          <BalancePill />
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                haptic.impact("medium");
                nav("/play/VIP");
              }}
              className="flex items-center gap-1 rounded-full border border-neon-gold/40 bg-neon-gold/10 px-3 py-1.5 text-xs font-bold text-neon-gold active:scale-95"
            >
              👑 {t("lobby.vipRoom")}
            </button>
            <LangToggle />
          </div>
        </div>
      ) : (
        <Header
          back
          title={
            <span>
              {money(bet)}{" "}
              <span className="text-sm text-ink-faint">{`· ${type}`}</span>
            </span>
          }
        />
      )}
      {/* Today's giveaway. Home only — inside a table the player is here to
          pick a card, and it renders nothing when no campaign is running. */}
      {home && <BonusCampaign />}
      {/* Live game hero — PLAY · ደራሽ (+taken) · WIN, with countdown. Display only. */}
      <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-bg-elevated to-bg-card p-4">
        <div className="grid grid-cols-3 items-start gap-2">
          {/* PLAY — the stake for this table */}
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              🎮 PLAY
            </div>
            <div className="font-display text-2xl font-extrabold text-ink">
              {type === "VIP" ? "👑 " : ""}
              {money(bet)}
            </div>
          </div>
          {/* ደራሽ — the prize pool + how many cards are taken */}
          <div className="min-w-0 text-center">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              {t("card.prize")}
            </div>
            <div className="font-display text-2xl font-extrabold text-neon-cyan">
              {money(livePrize ?? liveGame?.prize_pool ?? 0)}
            </div>
            <div className="text-[10px] text-ink-faint">
              {t("card.takenCards", { count: takenCount })}
            </div>
          </div>
          {/* WIN — what this player has won TODAY (Ethiopian day). 0 until
              they win a round; updates the moment a won round ends. */}
          <div className="min-w-0 text-right">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              🏆 WIN
            </div>
            <div className="font-display text-2xl font-extrabold text-neon-gold">
              {money(winningsQ.data?.today ?? 0)}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5 text-xs text-ink-muted">
          <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono font-bold text-ink">
            {t("card.round")} #{roundCode}
          </span>
          {isCountdown ? (
            <span className="flex items-center gap-2">
              <span className="text-[11px] text-ink-faint">{t("card.startingIn")}</span>
              <span className="rounded-lg border border-neon-cyan/50 px-2.5 py-0.5 font-display text-lg font-extrabold tabular-nums text-neon-cyan shadow-glow-cyan">
                {secondsLeft}
              </span>
            </span>
          ) : liveGame?.state === "DRAWING" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neon-green/15 px-2.5 py-1 text-[11px] font-bold text-neon-green">
              <span className="size-1.5 animate-pulse rounded-full bg-neon-green" />
              {t("card.live")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-bold text-ink-muted">
              <span className="size-1.5 animate-pulse rounded-full bg-ink-faint" />
              {t("card.waitingPlayers")}
            </span>
          )}
        </div>
      </div>

      <p className="mb-2 text-xs text-ink-faint">
        {t("card.tapToPick")} ·{" "}
        {t("card.capHint", { count: ownedCount, max: MAX_CARDS_PER_PLAYER })}
      </p>

      {/* Selected-cards strip. With hundreds of cards in the grid, the cyan
          highlight on a picked cell scrolls out of view — this pins the chosen
          numbers to the top so the player always sees what they picked. Each
          chip removes that card (releases the reservation) on tap. */}
      {ownedCount > 0 && (
        <div className="sticky top-0 z-10 -mx-4 mb-2 border-b border-white/5 bg-bg/95 px-4 py-2 backdrop-blur">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-neon-cyan">
            {t("card.yourSelection")} · {t("card.selectedCount", { count: ownedCount })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...owned]
              .sort((a, b) => a - b)
              .map((id) => (
                <button
                  key={id}
                  onClick={() => toggle(id)}
                  className="flex items-center gap-1 rounded-full bg-neon-cyan/15 px-2.5 py-1 text-xs font-bold text-white ring-1 ring-neon-cyan/50 transition active:scale-90"
                >
                  #{id}
                  <span className="text-[10px] opacity-60">✕</span>
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1 pb-3 sm:grid-cols-9">
        {ALL_CARDS.map((id) => {
          const isMine = owned.has(id);
          const isTaken = takenByOther(id, isMine);
          // Only cards taken by someone else are disabled. Cards the player
          // can't currently afford — or that exceed their card cap — stay
          // TAPPABLE: tapping shows a clear "insufficient balance" / "max
          // cards" message (see toggle) instead of greying out the whole grid.
          // No in-flight lock: taps apply optimistically and sync behind.
          return (
            <button
              key={id}
              disabled={isTaken}
              onClick={() => toggle(id)}
              className={[
                "flex aspect-square items-center justify-center rounded-md text-[11px] font-bold transition-all duration-100 active:scale-90",
                isMine
                  ? // YOURS: glowing cyan cell (matches the design) — unmistakable.
                    "scale-105 bg-neon-cyan/15 text-white ring-2 ring-neon-cyan shadow-glow-cyan"
                  : isTaken
                    ? // TAKEN by someone else: near-black, dim + struck — clearly blocked.
                      "cursor-not-allowed bg-black/60 text-ink-faint/25 line-through ring-1 ring-white/5"
                    : // AVAILABLE (incl. low balance / at cap): bright, tappable tile.
                      "bg-bg-card text-ink ring-1 ring-white/10 hover:ring-neon-cyan/60",
              ].join(" ")}
            >
              {id}
            </button>
          );
        })}
      </div>

      {/* Spacer so the last row clears the sticky tab bar. */}
      <div aria-hidden className={home ? "h-24" : "h-6"} />
    </ScreenShell>
  );
}
