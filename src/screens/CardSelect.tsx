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
import { BingoCardView } from "@/components/bingo/BingoCard";
import { PREGENERATED_CARDS } from "@/data/pregeneratedCards";
import type { BingoCard, GameType } from "@/types/api";
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

const ALL_CARDS = Array.from({ length: MAX_CARD_ID - MIN_CARD_ID + 1 }, (_, i) => i + MIN_CARD_ID);

// Deterministic 5x5 fallback card generator in case PREGENERATED_CARDS entry is missing or indexed differently
function generateFallbackCard(id: number): BingoCard {
  const lcg = (seed: number) => {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return s;
    };
  };

  const rand = lcg(id * 99991 + 7);

  const getCol = (min: number, max: number, count: number) => {
    const nums: number[] = [];
    while (nums.length < count) {
      const n = min + (rand() % (max - min + 1));
      if (!nums.includes(n)) nums.push(n);
    }
    return nums;
  };

  const b = getCol(1, 15, 5);
  const iCol = getCol(16, 30, 5);
  const n = getCol(31, 45, 5);
  n[2] = 0; // FREE space in center
  const g = getCol(46, 60, 5);
  const o = getCol(61, 75, 5);

  const numbers: number[][] = [];
  for (let row = 0; row < 5; row++) {
    numbers.push([b[row], iCol[row], n[row], g[row], o[row]]);
  }

  return { id, numbers } as BingoCard;
}

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

  // Preview Modal state
  const [previewId, setPreviewId] = useState<number | null>(null);

  // Universal card resolver: handles Arrays, 0-indexed/1-indexed, Key-Value Maps, and fallback logic
  const previewCard = useMemo(() => {
    if (previewId === null) return null;

    try {
      const cardsData = PREGENERATED_CARDS as any;

      if (cardsData) {
        let raw: any = null;

        if (Array.isArray(cardsData)) {
          raw = cardsData.find(
            (c: any) => c?.id === previewId || c?.card_id === previewId || c?.cardId === previewId
          );
          if (!raw && cardsData[previewId - 1]) raw = cardsData[previewId - 1];
          if (!raw && cardsData[previewId]) raw = cardsData[previewId];
        } else if (typeof cardsData === "object") {
          raw = cardsData[previewId] ?? cardsData[String(previewId)] ?? cardsData.cards?.[previewId];
        }

        if (raw) {
          const cardObj = raw.card || raw;
          const numbers = cardObj.numbers || cardObj.grid || cardObj.matrix || cardObj.numbers_json;
          if (Array.isArray(numbers)) {
            return {
              ...cardObj,
              id: cardObj.id ?? cardObj.card_id ?? previewId,
              numbers: numbers,
            } as BingoCard;
          }
          if (cardObj && typeof cardObj === "object") {
            return cardObj as BingoCard;
          }
        }
      }
    } catch (e) {
      console.error("Error loading pregenerated card:", e);
    }

    return generateFallbackCard(previewId);
  }, [previewId]);

  useEffect(() => {
    refreshWallet().catch(() => {});
  }, [refreshWallet]);

  const [overlay, setOverlay] = useState<Map<number, "add" | "remove">>(new Map());

  const gameQ = useQuery({
    queryKey: ["game-for-type", type],
    queryFn: async () => (await api.games(type)).games[0] ?? null,
    refetchInterval: 5000,
  });
  const gameId = gameQ.data?.id ?? null;
  const refetchGame = gameQ.refetch;

  const stateQ = useQuery({
    queryKey: ["game-state", gameId],
    queryFn: () => api.gameState(gameId!),
    enabled: !!gameId,
    refetchInterval: 3000,
  });

  const [takenLive, setTakenLive] = useState<Set<number>>(new Set());
  const [livePrize, setLivePrize] = useState<number | null>(null);
  const [serverEndsAt, setServerEndsAt] = useState<number | null>(null);

  useEffect(() => {
    if (stateQ.data?.takenCards) setTakenLive(new Set(stateQ.data.takenCards));
  }, [stateQ.data]);

  useEffect(() => {
    if (!gameId) return;
    setLivePrize(null);
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
        case "NEW_GAME_AVAILABLE":
          refetchGame();
          break;
        case "GAME_STATUS": {
          const status = msg.data?.status ?? msg.data?.state;
          if (status === "FINISHED" || status === "CANCELLED") refetchGame();
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
  const liveGame = stateQ.data?.game ?? gameQ.data ?? null;
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const countdownEnds =
    serverEndsAt ??
    (liveGame?.countdown_ends ? Date.parse(liveGame.countdown_ends) : null);
  const secondsLeft =
    countdownEnds != null ? Math.max(0, Math.ceil((countdownEnds - nowTs) / 1000)) : null;

  const isCountdown =
    secondsLeft != null &&
    (liveGame?.state === "COUNTDOWN" || (serverEndsAt != null && serverEndsAt > nowTs));

  const roundCode =
    liveGame?.round_code ||
    (gameId ? gameId.replace(/-/g, "").slice(0, 4).toUpperCase() : "----");

  const winningsQ = useQuery({
    queryKey: ["my-winnings"],
    queryFn: api.myWinnings,
    refetchInterval: 60000,
  });

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

  const owned = useMemo(() => {
    const s = new Set(serverOwned);
    overlay.forEach((op, id) => (op === "add" ? s.add(id) : s.delete(id)));
    return s;
  }, [serverOwned, overlay]);

  const desired = useRef(new Map<number, boolean>());
  const confirmed = useRef(new Map<number, boolean>());
  const inFlight = useRef(new Set<number>());
  const serverOwnedRef = useRef(serverOwned);
  serverOwnedRef.current = serverOwned;

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
  const takenCount = taken.size;

  const enteredRef = useRef(false);

  useEffect(() => {
    enteredRef.current = false;
    setOverlay(new Map());
    setTakenLive(new Set());
    setLivePrize(null);
    setServerEndsAt(null);
    setPreviewId(null);
    desired.current.clear();
    confirmed.current.clear();
    inFlight.current.clear();
  }, [gameId]);

  const roundOver = liveGame?.state === "FINISHED" || liveGame?.state === "CANCELLED";
  const refetchWinnings = winningsQ.refetch;

  useEffect(() => {
    if (roundOver) {
      refetchGame();
      refetchWinnings();
    }
  }, [roundOver, refetchGame, refetchWinnings]);

  useEffect(() => {
    const drawing = liveGame?.state === "DRAWING";
    const countdownEnded =
      isCountdown && secondsLeft !== null && secondsLeft <= 2 && ownedCount > 0;
    if (
      (drawing || countdownEnded) &&
      gameId &&
      !finishedGames.has(gameId) &&
      !enteredRef.current
    ) {
      enteredRef.current = true;
      haptic.impact("medium");
      nav(`/game/${gameId}`);
    }
  }, [liveGame?.state, isCountdown, secondsLeft, ownedCount, gameId, nav]);

  const toggle = (id: number) => {
    if (!gameId) return;
    sound.preloadCalls();
    const isMine = owned.has(id);
    if (takenByOther(id, isMine)) return;

    if (!isMine) {
      if (ownedCount >= MAX_CARDS_PER_PLAYER) {
        push(t("card.maxCards", { max: MAX_CARDS_PER_PLAYER }), "error");
        return;
      }
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

  const takenByOther = (id: number, isMine: boolean) =>
    taken.has(id) && !isMine && !serverOwned.has(id) && !overlay.has(id);

  const syncCard = async (id: number) => {
    if (!gameId || inFlight.current.has(id)) return;
    inFlight.current.add(id);
    try {
      for (;;) {
        const want = desired.current.get(id);
        const actual = confirmed.current.get(id) ?? serverOwnedRef.current.has(id);
        if (want === undefined || want === actual) break;
        if (want) {
          await api.join(gameId, id);
        } else {
          await api.leave(gameId, id);
        }
        confirmed.current.set(id, want);
      }
    } catch (e) {
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

      {home && <BonusCampaign />}

      <div className="mb-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-bg-elevated to-bg-card p-4">
        <div className="grid grid-cols-3 items-start gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              🎮 PLAY
            </div>
            <div className="font-display text-2xl font-extrabold text-ink">
              {type === "VIP" ? "👑 " : ""}
              {money(bet)}
            </div>
          </div>
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
          return (
            <button
              key={id}
              disabled={isTaken}
              onClick={() => {
                haptic.selection();
                setPreviewId(id);
              }}
              className={[
                "flex aspect-square items-center justify-center rounded-md text-[11px] font-bold transition-all duration-100 active:scale-90",
                isMine
                  ? "scale-105 bg-neon-cyan/15 text-white ring-2 ring-neon-cyan shadow-glow-cyan"
                  : isTaken
                    ? "cursor-not-allowed bg-black/60 text-ink-faint/25 line-through ring-1 ring-white/5"
                    : "bg-bg-card text-ink ring-1 ring-white/10 hover:ring-neon-cyan/60",
              ].join(" ")}
            >
              {id}
            </button>
          );
        })}
      </div>

      {/* INSTANT CARD PREVIEW MODAL */}
      {previewId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-white/15 bg-bg-card p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-lg font-bold text-white">
                Card #{previewId}
              </span>
              <button
                onClick={() => setPreviewId(null)}
                className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-ink-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              {previewCard ? (
                <BingoCardView card={previewCard} daubed={new Set()} />
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-center text-xs text-neon-red">
                  Card data unavailable.
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPreviewId(null)}
                className="flex-1 rounded-xl bg-white/10 py-2 text-xs font-bold text-white"
              >
                Close
              </button>

              <button
                disabled={takenByOther(previewId, owned.has(previewId))}
                onClick={() => {
                  toggle(previewId);
                  setPreviewId(null);
                }}
                className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                  owned.has(previewId)
                    ? "bg-neon-red/20 text-neon-red ring-1 ring-neon-red/50"
                    : "bg-neon-cyan text-bg font-extrabold"
                }`}
              >
                {owned.has(previewId) ? "Remove Card" : "Select Card"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div aria-hidden className={home ? "h-24" : "h-6"} />
    </ScreenShell>
  );
}