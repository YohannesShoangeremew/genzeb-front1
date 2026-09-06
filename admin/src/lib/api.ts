// Typed client for the Go backend admin API. All admin routes require a JWT
// from an admin login (POST /auth/login with telegram_id + password).

const BASE = (import.meta.env.VITE_API_BASE ?? "https://bingo-api-c6un.onrender.com").replace(/\/$/, "");
const API = `${BASE}/api/v1`;

/**
 * WebSocket URL for a live admin feed, with the JWT on the query string — a
 * browser cannot set an Authorization header on a WebSocket, so the token
 * rides the URL and the server validates it there. http→ws, https→wss.
 */
export function wsURL(path: string): string {
  const base = API.replace(/^http/, "ws");
  const t = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${base}${path}${t}`;
}

const TOKEN_KEY = "bingo_admin_token";

let token: string | null = localStorage.getItem(TOKEN_KEY);

function segment(value: string | number): string {
  return encodeURIComponent(String(value));
}

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return token;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...opts, headers });

  let body: any = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    // body may be a parsed object ({error}/{message}) or a raw string (e.g. gin's
    // plain-text "404 page not found" when a route isn't deployed yet). Render
    // serves HTTP/2, where res.statusText is always empty — so fall back to the
    // status code rather than a bare "Request failed" that hides what happened.
    const fromBody =
      body && typeof body === "object"
        ? body.error || body.message
        : typeof body === "string"
          ? body.trim()
          : "";
    const msg = fromBody || res.statusText || `Request failed (HTTP ${res.status})`;
    throw new ApiError(typeof msg === "string" ? msg : `Request failed (HTTP ${res.status})`, res.status);
  }
  return body as T;
}

// ---- Types ----

export interface User {
  id: string;
  telegram_id: number;
  first_name: string;
  last_name?: string | null;
  phone_number: string;
  referal_code: string;
  role: "user" | "admin";
  banned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  balance: number;
  demo_balance: number;
}

export type UserWithWallet = User & { wallet?: Wallet };

export type TxType = "deposit" | "withdraw" | "transfer_in" | "transfer_out";
export type TxStatus = "pending" | "completed" | "failed" | "cancelled";

// category records what the money movement actually WAS (its source), separate
// from `type` which only records the balance direction. Lets the UI tell a real
// deposit apart from a game prize even though both are type "deposit".
export type TxCategory =
  | "deposit"
  | "withdrawal"
  | "bet"
  | "winnings"
  | "refund"
  | "transfer_in"
  | "transfer_out"
  | "admin_credit"
  | "admin_debit"
  | "bot_funding";

export interface Transaction {
  id: string;
  user_id: string;
  type: TxType;
  category?: TxCategory | null;
  amount: number;
  status: TxStatus;
  transaction_type?: string | null; // payment method (Telebirr; legacy rows may be CBE)
  transaction_id?: string | null;
  reference?: string | null;
  created_at: string;
  // Populated by admin list endpoints (joined from users), so each row knows who
  // it belongs to without loading every user.
  player_name?: string | null;
  player_phone?: string | null;
}

// A player's lifetime play + money record (admin withdrawal review). The money
// fields show the SOURCE of the balance so an admin can tell a real winner from
// someone whose balance came from bonuses/referrals they never earned.
export interface UserGameStats {
  games_played: number;
  games_won: number;
  total_won: number;
  total_staked: number;
  total_deposited: number;
  total_withdrawn: number;
  total_bonus: number;
  real_balance: number;
  bonus_balance: number;
  referred_count: number;
}

export interface AppSettings {
  min_deposit: number;
  welcome_bonus_enabled: boolean;
  referral_enabled: boolean;
  referral_amount: number;
  deposit_bonus_enabled: boolean;
  deposit_bonus_percentage: number;
  maintenance_mode: boolean;
  maintenance_message: string;
  // Per-method deposit switches. Turn a channel off to stop players depositing
  // with it (e.g. when its verification breaks) without touching withdrawals.
  deposit_telebirr_enabled: boolean;
  deposit_cbebirr_enabled: boolean;
  deposit_mpesa_enabled: boolean;
  updated_at: string;
}

// Drill-down behind the dashboard house-cut figure.
export interface HouseCutDetail {
  total_house_cut: number;
  real_player_pnl: number;
  by_tier: { tier: string; games: number; house_cut: number }[];
  by_day: { day: string; games: number; house_cut: number }[];
}

// A referred player (subset of User) for the "invited players" list.
export interface PlayerLite {
  id: string;
  telegram_id: number;
  first_name: string;
  last_name?: string | null;
  phone_number: string;
  created_at: string;
}

// One game a player took part in (for the profile game-history section).
export interface GameHistoryEntry {
  game: {
    id: string;
    game_type: string;
    bet_amount: number;
    state: string;
    prize_pool: number;
    finished_at?: string | null;
    created_at?: string;
  };
  cards_held: number;
  total_stake: number;
  is_winner: boolean;
  win_amount: number;
  joined_at: string;
}

// Player-submitted problem reports ("Report a problem" in the Mini App).
export type SupportCategory = "transaction" | "gameplay" | "other";
export type SupportStatus = "open" | "resolved";

export interface PromoCode {
  code: string;
  bonus_amount: number;
  max_redemptions?: number | null;
  redeemed_count: number;
  expires_at?: string | null;
  active: boolean;
  created_at: string;
}

export interface SupportReport {
  id: string;
  user_id: string;
  category: SupportCategory;
  message: string;
  game_id?: string | null;
  status: SupportStatus;
  created_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  // Reporter identity, joined server-side for the dashboard.
  reporter_first_name?: string;
  reporter_last_name?: string | null;
  reporter_phone?: string;
  reporter_telegram_id?: number;
}

export type GameState = "WAITING" | "COUNTDOWN" | "DRAWING" | "FINISHED" | "CLOSED" | "CANCELLED";

export interface Game {
  id: string;
  game_type: string;
  state: GameState;
  bet_amount: number;
  min_players: number;
  player_count: number;
  prize_pool: number;
  house_cut: number;
  winner_id?: string | null;
  countdown_ends?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminGamePlayer {
  user_id: string;
  first_name: string;
  last_name?: string | null;
  phone_number: string;
  telegram_id: number;
  card_id: number;
  is_eliminated: boolean;
  joined_at: string;
}

export interface GameWinner {
  user_id: string;
  winner_name: string;
  card_id: number;
  prize: number;
}

export interface GameDetail {
  game: Game;
  players: AdminGamePlayer[];
  winners: GameWinner[];
  funding: {
    total_players: number;
    wallet_players: number;
    bonus_players: number;
    mixed_players: number;
  };
}

export interface CancelGameResponse {
  message: string;
  game: Game;
  refunded_count: number;
  refunded_amount: number;
}

export interface DashboardStats {
  pending_deposits: number;
  pending_withdrawals: number;
  total_users: number;
  total_transactions: number;
  total_balance: number;
  games_by_type: Record<string, number>;
  total_house_cut: number;
  // real-player stakes − winnings (bots excluded). Negative = the house has paid
  // real players more than they staked (real cash exposure from bot-inflated pools).
  real_player_game_pnl: number;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export type BiasedDrawMode = "disabled" | "legacy" | "protected";

// Filler bots — house-owned players that auto-fill games short on real players.
export interface BotConfig {
  enabled: boolean;
  min_real_players: number; // deprecated compatibility field
  target_bots: number; // deprecated compatibility field
  minimum_room_players: number; // desired real+bot room size below the threshold
  tiers: string; // comma-separated game types, e.g. "REGULAR,VIP"
  win_rate: number; // retained compatibility setting; current modes define tie handling
  bot_always_win: boolean; // compatibility mirror for an enabled saved mode
  biased_draw_mode: BiasedDrawMode; // saved policy used while real players are below the minimum
  updated_at: string;
}

// One external payment-verifier lookup, for the verification audit page. Lets an
// admin see exactly what the verifier returned for a disputed receipt.
export type VerificationOutcome = "verified" | "rejected" | "unavailable";

export interface VerificationLog {
  id: string;
  user_id?: string | null;
  method: string;
  reference: string;
  outcome: VerificationOutcome;
  reason: string;
  amount?: number | null;
  raw_response: string;
  player_name?: string;
  player_phone?: string;
  created_at: string;
}

export interface AdminEventLog {
  id: string;
  level: "warning" | "info" | "error" | string;
  source: string;
  message: string;
  game_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ---- Bonus wallet (play-only money) ----

/** Play-only money: can buy cards, can never be withdrawn. */
export interface BonusConfig {
  enabled: boolean;
  /** Applies to NEW grants only — a deadline already promised is never moved. */
  expiry_days: number;
  /** Shown to players beside their bonus balance. */
  announcement: string;
  updated_at: string;
}

/**
 * A "first N players" giveaway: a pot split into a fixed number of equal
 * slots, claimed first-come-first-served. Only ONE can be active at a time.
 */
export interface BonusCampaign {
  id: string;
  total_amount: number;
  slots: number;
  /** What one claimer receives — frozen at creation, so everyone gets the same. */
  amount_per_slot: number;
  claimed_count: number;
  announcement: string;
  /** How long a claimed bonus lasts, in minutes. Absent → the Policy default. */
  expiry_minutes?: number;
  status: "active" | "ended";
  created_by?: string;
  created_at: string;
  ended_at?: string;
}

/** One player's claim, with their identity joined in for the admin table. */
export interface BonusCampaignClaim {
  campaign_id: string;
  user_id: string;
  amount: number;
  /** 1-based place in the queue. */
  position: number;
  claimed_at: string;
  name?: string;
  phone?: string;
}

export interface BonusGrant {
  id: string;
  user_id: string;
  amount: number;
  remaining: number;
  reason?: string;
  granted_at: string;
  expires_at: string;
}

export interface BonusBalance {
  amount: number;
  next_expiry?: string;
}

// ---- Telegram broadcasts ----

export interface Broadcast {
  id: string;
  message: string;
  recipients: number;
  sent: number;
  failed: number;
  status: "sending" | "completed" | "failed";
  created_at: string;
  finished_at?: string;
}

export interface BotFillResult {
  game_id: string;
  requested: number;
  added: number;
  real_players: number;
  bot_players: number;
}

// ---- Endpoints ----

function adminPageQuery(limit: number, offset: number, search = ""): string {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const term = search.trim();
  if (term) q.set("search", term);
  return q.toString();
}

export const api = {
  login: (phone: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    }),

  dashboard: () => request<DashboardStats>("/admin/stats/dashboard"),
  houseCutDetail: () => request<{ detail: HouseCutDetail }>("/admin/dashboard/house-cut"),
  adminLogs: (opts: { level?: string; source?: string; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.level) q.set("level", opts.level);
    if (opts.source) q.set("source", opts.source);
    q.set("limit", String(opts.limit ?? 50));
    q.set("offset", String(opts.offset ?? 0));
    return request<{ logs: AdminEventLog[]; total: number; count: number }>(`/admin/logs?${q.toString()}`);
  },

  users: (opts: { limit?: number; offset?: number; search?: string; role?: "user" | "admin" } = {}) => {
    const q = new URLSearchParams({ limit: String(opts.limit ?? 50), offset: String(opts.offset ?? 0) });
    if (opts.search?.trim()) q.set("search", opts.search.trim());
    if (opts.role) q.set("role", opts.role);
    return request<{ users: UserWithWallet[]; count: number }>(`/admin/users?${q.toString()}`);
  },

  userDetail: (id: string) => request<{ user: UserWithWallet }>(`/admin/users/${segment(id)}`),

  // A player's lifetime play record — used to verify a withdrawal is from a real
  // winner, not a farmed/bonus-only account.
  userGameStats: (id: string) =>
    request<{ stats: UserGameStats }>(`/admin/users/${segment(id)}/game-stats`),

  // A player's full transaction history (paginated) for the detail view.
  userTransactions: (id: string, limit = 50, offset = 0) =>
    request<{ transactions: Transaction[]; total: number }>(
      `/admin/users/${segment(id)}/transactions?limit=${limit}&offset=${offset}`,
    ),

  // Everyone this player invited (each links to their profile).
  userReferrals: (id: string) =>
    request<{ users: PlayerLite[]; count: number }>(`/admin/users/${segment(id)}/referrals`),

  // A player's game history (each links to the game detail).
  userGames: (id: string, limit = 20, offset = 0) =>
    request<{ games: GameHistoryEntry[]; total: number; count: number; limit: number; offset: number }>(
      `/admin/users/${segment(id)}/games?limit=${limit}&offset=${offset}`,
    ),

  setRole: (id: string, role: "user" | "admin") =>
    request<{ message: string }>(`/admin/users/${segment(id)}/role`, {
      method: "POST",
      body: JSON.stringify({ role }),
    }),

  makeAdmin: (id: string, password: string) =>
    request<{ message: string }>(`/admin/users/${segment(id)}/make-admin`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  banUser: (id: string) =>
    request<{ message: string }>(`/admin/users/${segment(id)}/ban`, { method: "POST" }),
  unbanUser: (id: string) =>
    request<{ message: string }>(`/admin/users/${segment(id)}/unban`, { method: "POST" }),
  deleteUser: (id: string) =>
    request<{ message: string }>(`/admin/users/${segment(id)}`, { method: "DELETE" }),

  adjustBalance: (id: string, amount: number, reason: string) =>
    request<{ message: string }>(`/admin/users/${segment(id)}/adjust-balance`, {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    }),

  // Transactions. The paginated lists (all, winners) also return `total` — the
  // grand count — so the UI can page through large data instead of truncating.
  transactions: (limit = 50, offset = 0, search = "") =>
    request<{ transactions: Transaction[]; count: number; total: number }>(
      `/admin/transactions?${adminPageQuery(limit, offset, search)}`,
    ),
  winners: (limit = 50, offset = 0, search = "") =>
    request<{ transactions: Transaction[]; count: number; total: number }>(
      `/admin/transactions/winners?${adminPageQuery(limit, offset, search)}`,
    ),
  // Pending/completed deposit & withdrawal lists are paginated (they return a
  // grand `total`), so large queues page instead of getting cut off.
  pendingDeposits: (limit = 50, offset = 0, search = "") =>
    request<{ transactions: Transaction[]; total: number }>(`/admin/transactions/pending/deposits?${adminPageQuery(limit, offset, search)}`),
  pendingWithdrawals: (limit = 50, offset = 0, search = "") =>
    request<{ transactions: Transaction[]; total: number }>(`/admin/transactions/pending/withdrawals?${adminPageQuery(limit, offset, search)}`),
  completedDeposits: (limit = 50, offset = 0, search = "") =>
    request<{ transactions: Transaction[]; total: number }>(`/admin/transactions/completed/deposits?${adminPageQuery(limit, offset, search)}`),
  completedWithdrawals: (limit = 50, offset = 0, search = "") =>
    request<{ transactions: Transaction[]; total: number }>(`/admin/transactions/completed/withdrawals?${adminPageQuery(limit, offset, search)}`),
  failed: (limit = 50, offset = 0, search = "") =>
    request<{ transactions: Transaction[]; total: number }>(`/admin/transactions/failed?${adminPageQuery(limit, offset, search)}`),
  transfers: (limit = 50, offset = 0, search = "") =>
    request<{ transactions: Transaction[]; total: number }>(`/admin/transactions/transfers?${adminPageQuery(limit, offset, search)}`),

  // App settings (minimum deposit, …).
  getSettings: () => request<{ settings: AppSettings }>("/admin/settings"),
  updateSettings: (patch: Partial<AppSettings>) =>
    request<{ settings: AppSettings }>("/admin/settings", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  // approveDeposit refuses a receipt the verifier definitively REJECTED (HTTP 409)
  // unless force=true — for an admin who has confirmed the payment out-of-band.
  approveDeposit: (id: string, force = false) =>
    request<{ message: string }>(
      `/admin/transactions/${segment(id)}/approve-deposit${force ? "?force=true" : ""}`,
      { method: "POST" },
    ),

  // Payment-verifier audit trail. Filter by ?reference to pull every lookup for a
  // disputed receipt; the raw provider response and verdict are on each row.
  verificationLogs: (opts: { reference?: string; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.reference) q.set("reference", opts.reference);
    q.set("limit", String(opts.limit ?? 50));
    q.set("offset", String(opts.offset ?? 0));
    return request<{ logs: VerificationLog[]; total: number }>(
      `/admin/transactions/verification-logs?${q.toString()}`,
    );
  },
  rejectDeposit: (id: string) =>
    request<{ message: string }>(`/admin/transactions/${segment(id)}/reject-deposit`, {
      method: "POST",
    }),
  approveWithdrawal: (id: string) =>
    request<{ message: string }>(`/admin/transactions/${segment(id)}/approve-withdrawal`, {
      method: "POST",
    }),
  rejectWithdrawal: (id: string) =>
    request<{ message: string }>(`/admin/transactions/${segment(id)}/reject-withdrawal`, {
      method: "POST",
    }),
  // Roll back a withdrawal, splitting the refund: genuine (deposit/winnings)
  // portion → cash, the rest → play-only bonus.
  rejectWithdrawalToBonus: (id: string) =>
    request<{ message: string; result: { amount: number; real_refunded: number; bonus_granted: number } }>(
      `/admin/transactions/${segment(id)}/reject-to-bonus`,
      { method: "POST" },
    ),
  cancelTransaction: (id: string) =>
    request<{ message: string }>(`/admin/transactions/${segment(id)}/cancel`, { method: "POST" }),

  // Games
  games: (opts: { state?: GameState; type?: string; active?: boolean; search?: string; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.state) q.set("state", opts.state);
    if (opts.type) q.set("type", opts.type);
    if (opts.active) q.set("active", "true");
    if (opts.search?.trim()) q.set("search", opts.search.trim());
    q.set("limit", String(opts.limit ?? 100));
    q.set("offset", String(opts.offset ?? 0));
    return request<{ games: Game[]; total: number; count: number; limit: number; offset: number }>(
      `/admin/games?${q.toString()}`,
    );
  },
  gameDetail: (id: string) => request<GameDetail>(`/admin/games/${segment(id)}`),
  cancelGame: (id: string) =>
    request<CancelGameResponse>(`/admin/games/${segment(id)}/cancel`, { method: "POST" }),

  // Filler bots
  botConfig: () => request<BotConfig>("/admin/bots/config"),
  updateBotConfig: (
    patch: Partial<
      Pick<
        BotConfig,
        | "enabled"
        | "min_real_players"
        | "target_bots"
        | "minimum_room_players"
        | "tiers"
        | "win_rate"
        | "bot_always_win"
        | "biased_draw_mode"
      >
    >,
  ) =>
    request<BotConfig>("/admin/bots/config", { method: "PUT", body: JSON.stringify(patch) }),
  seedBots: (count?: number) =>
    request<{ message: string }>("/admin/bots/seed", {
      method: "POST",
      body: JSON.stringify(count ? { count } : {}),
    }),
  addBots: (gameId: string, count: number) =>
    request<BotFillResult>(`/admin/games/${segment(gameId)}/add-bots`, {
      method: "POST",
      body: JSON.stringify({ count }),
    }),

  // Bonus wallet
  bonusConfig: () => request<BonusConfig>("/admin/bonus/config"),
  updateBonusConfig: (
    patch: Partial<Pick<BonusConfig, "enabled" | "expiry_days" | "announcement">>,
  ) => request<BonusConfig>("/admin/bonus/config", { method: "PUT", body: JSON.stringify(patch) }),
  grantBonus: (user_id: string, amount: number, reason: string) =>
    request<{ grant: BonusGrant }>("/admin/bonus/grant", {
      method: "POST",
      body: JSON.stringify({ user_id, amount, reason }),
    }),
  /** Award the same bonus to many players — the shape a campaign actually takes. */
  grantBonusBulk: (user_ids: string[], amount: number, reason: string) =>
    request<{ granted: number; attempted: number; failed: Record<string, string> }>(
      "/admin/bonus/grant-bulk",
      { method: "POST", body: JSON.stringify({ user_ids, amount, reason }) },
    ),
  bonusOutstanding: () => request<{ outstanding_bonus: number }>("/admin/bonus/outstanding"),

  // "First N players" giveaways
  /**
   * Start today's giveaway. `broadcast: true` also Telegrams every player —
   * creating the campaign and announcing it are one action so the two can
   * never drift apart.
   */
  createCampaign: (input: {
    total_amount: number;
    slots: number;
    announcement?: string;
    broadcast?: boolean;
    /** Bonus lifetime in minutes; omit to use the Policy default. */
    expiry_minutes?: number;
  }) =>
    request<{ campaign: BonusCampaign }>("/admin/bonus/campaigns", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  campaigns: (limit = 25) =>
    request<{ campaigns: BonusCampaign[] }>(`/admin/bonus/campaigns?limit=${limit}`),
  campaignClaims: (id: string) =>
    request<{ claims: BonusCampaignClaim[] }>(
      `/admin/bonus/campaigns/${segment(id)}/claims`,
    ),
  /** Stop a campaign early. Slots already claimed keep their money. */
  endCampaign: (id: string) =>
    request<{ campaign: BonusCampaign }>(`/admin/bonus/campaigns/${segment(id)}/end`, {
      method: "POST",
    }),
  userBonus: (userId: string) =>
    request<{ grants: BonusGrant[]; balance: BonusBalance }>(`/admin/users/${segment(userId)}/bonus`),

  // Telegram broadcasts
  broadcastAudience: () => request<{ recipients: number }>("/admin/broadcast/audience"),
  sendBroadcast: (message: string) =>
    request<{ broadcast: Broadcast }>("/admin/broadcast", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  broadcast: (id: string) => request<{ broadcast: Broadcast }>(`/admin/broadcast/${segment(id)}`),
  broadcasts: (limit = 25) => request<{ broadcasts: Broadcast[] }>(`/admin/broadcasts?limit=${limit}`),

  // Player problem reports
  reports: (status?: SupportStatus, limit = 100, offset = 0, search = "") => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (search.trim()) q.set("search", search.trim());
    q.set("limit", String(limit));
    q.set("offset", String(offset));
    return request<{ reports: SupportReport[]; count: number }>(`/admin/support?${q.toString()}`);
  },
  resolveReport: (id: string) =>
    request<{ message: string }>(`/admin/support/${segment(id)}/resolve`, { method: "POST" }),

  // Promo codes
  promoCodes: () => request<{ promos: PromoCode[] }>("/admin/promo-codes"),
  createPromoCode: (input: {
    code: string;
    bonus_amount: number;
    max_redemptions?: number | null;
    expires_at?: string | null;
  }) => request<{ promo: PromoCode }>("/admin/promo-codes", { method: "POST", body: JSON.stringify(input) }),
  activatePromoCode: (code: string) =>
    request<{ message: string }>(`/admin/promo-codes/${segment(code)}/activate`, { method: "POST" }),
  deactivatePromoCode: (code: string) =>
    request<{ message: string }>(`/admin/promo-codes/${segment(code)}/deactivate`, { method: "POST" }),
};
