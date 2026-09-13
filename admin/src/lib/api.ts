export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type VerificationOutcome = "verified" | "rejected" | "unavailable";

export interface User {
  id: string;
  telegram_id: number | string;
  first_name: string;
  last_name: string;
  phone_number: string;
  referal_code?: string;
  role: "admin" | "user";
  banned: boolean;
  created_at: string;
  wallet?: {
    balance: number;
    demo_balance: number;
  };
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
  player_name?: string;
  player_phone?: string;
  type: string;
  category?: string;
  amount: number;
  status: string;
  transaction_type?: string;
  transaction_id?: string;
  reference?: string;
  created_at: string;
}

export interface VerificationLog {
  id: string;
  created_at: string;
  user_id?: string;
  player_name?: string;
  player_phone?: string;
  method: string;
  reference: string;
  outcome: VerificationOutcome;
  amount?: number;
  reason?: string;
  raw_response: string;
}

export interface UserGameRecord {
  total_stake: number;
  is_winner: boolean;
  win_amount: number;
  joined_at: string;
  game: {
    id: string;
    game_type: string;
  };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/admin";
const TOKEN_KEY = "admin_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP error ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  });
  const q = searchParams.toString();
  return q ? `?${q}` : "";
}

export const api = {
  // Auth
  login: (phoneOrId: string | number, password: string) =>
    request<{ token: string; user: User }>(`/auth/login`, {
      method: "POST",
      body: JSON.stringify({ telegram_id: phoneOrId, phone: phoneOrId, password }),
    }),

  // Users & Accounts
  users: (params: { limit: number; offset: number; search?: string }) =>
    request<{ users: User[]; count: number }>(`/users${buildQuery(params)}`),

  userDetail: (id: string) =>
    request<{ user: User }>(`/users/${id}`),

  userGameStats: (id: string) =>
    request<{ stats: UserGameStats }>(`/users/${id}/game-stats`),

  adjustBalance: (id: string, amount: number, reason?: string) =>
    request<void>(`/users/${id}/balance`, {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    }),

  makeAdmin: (id: string, password: string) =>
    request<void>(`/users/${id}/make-admin`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  setRole: (id: string, role: "admin" | "user") =>
    request<void>(`/users/${id}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  banUser: (id: string) =>
    request<void>(`/users/${id}/ban`, { method: "POST" }),

  unbanUser: (id: string) =>
    request<void>(`/users/${id}/unban`, { method: "POST" }),

  deleteUser: (id: string) =>
    request<void>(`/users/${id}`, { method: "DELETE" }),

  userReferrals: (id: string) =>
    request<{ users: User[] }>(`/users/${id}/referrals`),

  userGames: (id: string, limit: number, offset: number) =>
    request<{ games: UserGameRecord[]; total: number }>(`/users/${id}/games${buildQuery({ limit, offset })}`),

  userTransactions: (id: string, limit: number, offset: number) =>
    request<{ transactions: Transaction[]; total: number }>(`/users/${id}/transactions${buildQuery({ limit, offset })}`),

  // Verification Logs
  verificationLogs: (params: { reference?: string; limit: number; offset: number }) =>
    request<{ logs: VerificationLog[]; total: number }>(`/verification-logs${buildQuery(params)}`),

  // Transactions Ledger
  pendingDeposits: (limit: number, offset: number, search?: string) =>
    request<{ transactions: Transaction[]; total?: number }>(`/transactions/pending-deposits${buildQuery({ limit, offset, search })}`),

  pendingWithdrawals: (limit: number, offset: number, search?: string) =>
    request<{ transactions: Transaction[]; total?: number }>(`/transactions/pending-withdrawals${buildQuery({ limit, offset, search })}`),

  winners: (limit: number, offset: number, search?: string) =>
    request<{ transactions: Transaction[]; total?: number }>(`/transactions/winners${buildQuery({ limit, offset, search })}`),

  transactions: (limit: number, offset: number, search?: string) =>
    request<{ transactions: Transaction[]; total?: number }>(`/transactions${buildQuery({ limit, offset, search })}`),

  completedDeposits: (limit: number, offset: number, search?: string) =>
    request<{ transactions: Transaction[]; total?: number }>(`/transactions/completed-deposits${buildQuery({ limit, offset, search })}`),

  completedWithdrawals: (limit: number, offset: number, search?: string) =>
    request<{ transactions: Transaction[]; total?: number }>(`/transactions/completed-withdrawals${buildQuery({ limit, offset, search })}`),

  transfers: (limit: number, offset: number, search?: string) =>
    request<{ transactions: Transaction[]; total?: number }>(`/transactions/transfers${buildQuery({ limit, offset, search })}`),

  failed: (limit: number, offset: number, search?: string) =>
    request<{ transactions: Transaction[]; total?: number }>(`/transactions/failed${buildQuery({ limit, offset, search })}`),

  // Actions
  approveDeposit: (id: string, force = false) =>
    request<void>(`/transactions/${id}/approve-deposit`, {
      method: "POST",
      body: JSON.stringify({ force }),
    }),

  rejectDeposit: (id: string) =>
    request<void>(`/transactions/${id}/reject-deposit`, { method: "POST" }),

  approveWithdrawal: (id: string) =>
    request<void>(`/transactions/${id}/approve-withdrawal`, { method: "POST" }),

  rejectWithdrawalToBonus: (id: string) =>
    request<{ result: { real_refunded: number; bonus_granted: number } }>(`/transactions/${id}/reject-withdrawal-bonus`, {
      method: "POST",
    }),

  cancelTransaction: (id: string) =>
    request<void>(`/transactions/${id}/cancel`, { method: "POST" }),
};