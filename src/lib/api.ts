// Typed fetch wrapper around the Go backend. Attaches the JWT and normalizes
// error handling. Endpoints mirror cmd/server/main.go.

import type {
  BingoCard,
  BonusCampaignStatus,
  BonusClaim,
  Game,
  GamePlayer,
  GameStateResponse,
  GameType,
  LoginResponse,
  PaymentMethod,
  Transaction,
  User,
  Wallet,
} from "@/types/api";
import { getCard } from "@/lib/cards";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function segment(value: string | number): string {
  return encodeURIComponent(String(value));
}

export class ApiError extends Error {
  status: number;
  /**
   * Stable machine-readable code from the server, when it sends one (e.g. a
   * refused bonus claim: "exhausted" | "already_claimed" | "not_eligible").
   *
   * Carried separately from `message` because `message` is English prose
   * written for developers. Anything shown to a player has to come from the
   * translation files, so the UI switches on this and never renders `message`.
   */
  reason?: string;
  constructor(status: number, message: string, reason?: string) {
    super(message);
    this.status = status;
    this.reason = reason;
    this.name = "ApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network_error");
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new ApiError(res.status, msg, data?.reason);
  }
  return data as T;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  base: API_BASE,

  // ---- App status (public, no auth) ----
  // Polled to decide whether to show the maintenance screen. Fails soft to
  // "live" so a status blip never locks players out of a working app.
  status: () =>
    request<{
      maintenance: boolean;
      message: string;
      min_deposit: number;
      // Per-method deposit availability, keyed by PaymentMethod. A method the
      // admin has switched off (e.g. broken verification) is hidden from the
      // deposit picker. Absent/true → available.
      deposit_methods?: Partial<Record<PaymentMethod, boolean>>;
    }>("GET", "/api/v1/status").catch(() => ({
      maintenance: false,
      message: "",
      min_deposit: 50,
      deposit_methods: undefined,
    })),

  // ---- Auth ----
  telegramLogin: (initData: string) =>
    request<LoginResponse>("POST", "/api/v1/auth/telegram", {
      init_data: initData,
    }),

  // ---- Profile ----
  me: () => request<{ user: User }>("GET", "/api/v1/me").then((r) => r.user),
  updateName: (first_name: string, last_name?: string | null) =>
    request<{ user: User }>("PUT", "/api/v1/me/name", { first_name, last_name }).then((r) => r.user),

  // ---- Wallet ----
  myWallet: () => request<{ wallet: Wallet }>("GET", "/api/v1/me/wallet").then((r) => r.wallet),
  /**
   * Play-only bonus: buys cards, can never be withdrawn. Returned alongside
   * the operator's announcement so the promotion text and the balance it
   * refers to are always shown together.
   */
  myBonus: () =>
    request<{ bonus: { amount: number; next_expiry?: string }; announcement: string }>(
      "GET",
      "/api/v1/me/bonus",
    ),
  /**
   * The running "first N players" giveaway, plus what THIS player can do about
   * it. `campaign` is null on a day with no promotion — that is a normal empty
   * state, not an error.
   */
  myBonusCampaign: () =>
    request<BonusCampaignStatus>("GET", "/api/v1/me/bonus/campaign"),
  /**
   * Take a slot. Rejects with ApiError(409) carrying a `reason` code when the
   * slots are gone, the player already claimed, or they have never deposited.
   */
  claimBonus: () =>
    request<{ claim: BonusClaim }>("POST", "/api/v1/me/bonus/claim"),
  deposits: () =>
    request<{ deposits?: Transaction[] }>("GET", "/api/v1/me/wallet/deposits").then((r) => ({
      transactions: r.deposits ?? [],
    })),
  withdrawals: () =>
    request<{ withdrawals?: Transaction[] }>("GET", "/api/v1/me/wallet/withdrawals").then((r) => ({
      transactions: r.withdrawals ?? [],
    })),
  transfers: () =>
    request<{ transfers?: any[] }>("GET", "/api/v1/me/wallet/transfers"),
  deposit: (amount: number, transaction_type: PaymentMethod, transaction_id: string) =>
    request<{ transaction: Transaction }>("POST", "/api/v1/wallet/deposit", {
      amount,
      transaction_type,
      transaction_id,
    }),
  withdraw: (amount: number, account_number: string, account_type: PaymentMethod) =>
    request<{ transaction: Transaction }>("POST", "/api/v1/wallet/withdraw", {
      amount,
      account_number,
      account_type,
    }),
  transfer: (receiver_id: string, amount: number) =>
    request<unknown>("POST", "/api/v1/wallet/transfer", { receiver_id, amount }),

  // ---- Games ----
  games: (type?: GameType) =>
    request<{ games: Game[] }>(
      "GET",
      `/api/v1/games${type ? `?type=${encodeURIComponent(type)}` : ""}`,
    ),
  gameState: (gameId: string) =>
    request<GameStateResponse>("GET", `/api/v1/games/${segment(gameId)}/state`),
  card: (cardId: number) => {
    // Cards are a fixed table shipped with the app (an exact mirror of the
    // backend's), so displaying one needs no network round-trip. The server
    // still derives the same card from the id for win validation. Fall back to
    // the API only for an unexpected out-of-range id.
    const local = getCard(cardId);
    return local
      ? Promise.resolve({ card: local })
      : request<{ card: BingoCard }>("GET", `/api/v1/cards/${segment(cardId)}`);
  },
  // Summed prize money — today (Ethiopian time) and all time. Backs the WIN
  // stat on the card picker.
  myWinnings: () =>
    request<{ today: number; total: number }>("GET", "/api/v1/me/winnings"),
  myGames: (limit = 20, offset = 0) => {
    const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return request<{ games: any[]; count: number }>(
      "GET",
      `/api/v1/me/games?${q.toString()}`,
    );
  },
  // The one live game the user still holds cards in (WAITING/COUNTDOWN/DRAWING),
  // or { game: null }. Purpose-built single-row lookup backing the
  // return-to-live-game pill — cheaper and less ambiguous than scanning
  // paginated history. The live Game is nested under `game.game`.
  activeGame: () =>
    request<{ game: { game: Game } | null }>(
      "GET",
      `/api/v1/me/active-game`,
    ),
  myPlayerInGame: (gameId: string) =>
    request<{ player: GamePlayer | null }>(
      "GET",
      `/api/v1/me/games/${segment(gameId)}`,
    ),
  // All of the user's active cards in a game (a player may hold up to 4).
  myCardsInGame: (gameId: string) =>
    request<{ cards: GamePlayer[] }>(
      "GET",
      `/api/v1/me/games/${segment(gameId)}/cards`,
    ),
  join: (gameId: string, card_id: number) =>
    request<{ player: GamePlayer }>("POST", `/api/v1/games/${segment(gameId)}/join`, {
      card_id,
    }),
  // Leave one card (card_id) or the whole game (omit card_id).
  leave: (gameId: string, card_id?: number) =>
    request<{ message: string }>("POST", `/api/v1/games/${segment(gameId)}/leave`, {
      card_id: card_id ?? 0,
    }),
  claimBingo: (gameId: string, card_id: number, marked_numbers: number[]) =>
    request<{ winner: boolean; message: string }>(
      "POST",
      `/api/v1/games/${segment(gameId)}/bingo`,
      { card_id, marked_numbers },
    ),

  // Report a problem to the admins (transaction / gameplay / other). The
  // reporter is taken from the auth token server-side.
  submitReport: (
    category: "transaction" | "gameplay" | "other",
    message: string,
    game_id?: string,
  ) => request<unknown>("POST", "/api/v1/support", { category, message, game_id }),
};
