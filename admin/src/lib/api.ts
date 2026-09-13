export type VerificationOutcome = "verified" | "rejected" | "unavailable";

export interface VerificationLog {
  id: string;
  user_id?: string;
  player_name?: string;
  player_phone?: string;
  method: string;
  reference: string;
  outcome: VerificationOutcome;
  amount?: number;
  reason?: string;
  raw_response: string;
  created_at: string;
}

export interface User {
  id: string;
  telegram_id: number | string;
  first_name?: string;
  last_name?: string;
  phone_number: string;
  role: "admin" | "user";
  banned: boolean;
  referal_code?: string;
  wallet?: {
    balance: number;
    demo_balance: number;
  };
  created_at: string;
}

export interface UserGameStats {
  games_played: number;
  games_won: number;
  total_deposited: number;
  total_bonus: number;
  total_won: number;
  total_staked: number;
  total_withdrawn: number;
  real_balance: number;
  bonus_balance: number;
  referred_count: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: "deposit" | "withdrawal" | "transfer_in" | "transfer_out" | "win" | "bet" | "bonus" | "referral";
  category?: string;
  amount: number;
  status: "completed" | "pending" | "failed" | "cancelled";
  transaction_id?: string;
  reference?: string;
  created_at: string;
}

export interface UserGameHistory {
  game: {
    id: string;
    game_type: string;
  };
  total_stake: number;
  is_winner: boolean;
  win_amount: number;
  joined_at: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/admin";

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const query = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return query ? `?${query}` : "";
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || errData.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const api = {
  base: API_BASE,

  // Auth
  login: (phoneOrId: string | number, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ telegram_id: phoneOrId, phone: phoneOrId, password }),
    }),

  // Overview / Dashboard
  getStats: () => request<any>("/stats"),
  getPendingDeposits: () => request<any>("/deposits/pending"),

  // Users
  users: (params: { limit: number; offset: number; search?: string }) =>
    request<{ users: User[]; count: number }>(`/users${buildQuery(params)}`),

  userDetail: (id: string) =>
    request<{ user: User }>(`/users/${id}`),

  userGameStats: (id: string) =>
    request<{ stats: UserGameStats }>(`/users/${id}/stats`),

  userReferrals: (id: string) =>
    request<{ users: User[] }>(`/users/${id}/referrals`),

  userGames: (id: string, limit: number, offset: number) =>
    request<{ games: UserGameHistory[]; total: number }>(
      `/users/${id}/games${buildQuery({ limit, offset })}`
    ),

  userTransactions: (id: string, limit: number, offset: number) =>
    request<{ transactions: Transaction[]; total: number }>(
      `/users/${id}/transactions${buildQuery({ limit, offset })}`
    ),

  // User Actions
  adjustBalance: (id: string, amount: number, reason?: string) =>
    request(`/users/${id}/adjust-balance`, {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    }),

  makeAdmin: (id: string, password: string) =>
    request(`/users/${id}/make-admin`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  setRole: (id: string, role: "admin" | "user") =>
    request(`/users/${id}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),

  banUser: (id: string) =>
    request(`/users/${id}/ban`, { method: "POST" }),

  unbanUser: (id: string) =>
    request(`/users/${id}/unban`, { method: "POST" }),

  deleteUser: (id: string) =>
    request(`/users/${id}`, { method: "DELETE" }),

  // Games
  cancelGame: (id: string) =>
    request(`/games/${id}/cancel`, { method: "POST" }),

  // Verification Logs
  verificationLogs: (params: { reference?: string; limit: number; offset: number }) =>
    request<{ logs: VerificationLog[]; total: number }>(
      `/verification-logs${buildQuery(params)}`
    ),
};