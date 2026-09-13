const API_BASE = (import.meta.env.VITE_API_BASE ?? "http://localhost:8000").replace(/\/$/, "");

let adminToken: string | null = localStorage.getItem("admin_token");

export function getToken(): string | null {
  return adminToken ?? localStorage.getItem("admin_token");
}

export function setAdminToken(token: string | null) {
  adminToken = token;
  if (token) {
    localStorage.setItem("admin_token", token);
  } else {
    localStorage.removeItem("admin_token");
  }
}

export const setToken = setAdminToken;
export const setAuthToken = setAdminToken;

// --- Interfaces & Types ---

export interface User {
  id: string;
  telegram_id: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  is_banned?: boolean;
  balance?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export type VerificationOutcome = "approved" | "rejected" | "pending" | "success" | "failed" | string;

export interface VerificationLog {
  id: string;
  user_id?: string;
  action?: string;
  outcome?: VerificationOutcome;
  details?: string;
  created_at?: string;
  [key: string]: any;
}

export interface Transaction {
  id: string;
  user_id?: string;
  amount: number;
  type: string;
  status: string;
  reason?: string;
  created_at?: string;
  [key: string]: any;
}

export interface UsersResponse {
  users: User[];
  total?: number;
  count?: number;
  page?: number;
}

export interface UserTransactionsResponse {
  transactions: Transaction[];
  total: number;
}

export interface VerificationLogsResponse {
  logs: VerificationLog[];
  total: number;
}

export class ApiError extends Error {
  status: number;
  reason?: string;
  constructor(status: number, message: string, reason?: string) {
    super(message);
    this.status = status;
    this.reason = reason;
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (adminToken) headers["Authorization"] = "Bearer " + adminToken;

  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
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
    const msg = (data && (data.error || data.message)) || ("HTTP " + res.status);
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

  // Auth
  login: (telegram_id: number | string, password: string) =>
    request<{ token: string; user?: User }>("POST", "/api/v1/auth/login", {
      telegram_id: typeof telegram_id === "string" ? parseInt(telegram_id, 10) || telegram_id : telegram_id,
      password,
    }),

  // Dashboard Stats
  getStats: () =>
    request<any>("GET", "/api/v1/admin/stats/dashboard"),

  // Transactions
  getPendingDeposits: () =>
    request<any>("GET", "/api/v1/admin/transactions/pending/deposits"),
  approveDeposit: (id: string) =>
    request<any>("POST", "/api/v1/admin/transactions/" + encodeURIComponent(id) + "/approve-deposit"),
  rejectDeposit: (id: string) =>
    request<any>("POST", "/api/v1/admin/transactions/" + encodeURIComponent(id) + "/reject-deposit"),

  getPendingWithdrawals: () =>
    request<any>("GET", "/api/v1/admin/transactions/pending/withdrawals"),
  approveWithdrawal: (id: string) =>
    request<any>("POST", "/api/v1/admin/transactions/" + encodeURIComponent(id) + "/approve-withdrawal"),
  rejectWithdrawal: (id: string) =>
    request<any>("POST", "/api/v1/admin/transactions/" + encodeURIComponent(id) + "/reject-withdrawal"),

  // Users
  getUsers: (page = 1, search = ""): Promise<UsersResponse> => {
    const q = new URLSearchParams({ page: String(page), search });
    return request<UsersResponse>("GET", "/api/v1/admin/users?" + q.toString());
  },
  users: (page = 1, search = ""): Promise<UsersResponse> => {
    const q = new URLSearchParams({ page: String(page), search });
    return request<UsersResponse>("GET", "/api/v1/admin/users?" + q.toString());
  },
  getUser: (id: string): Promise<User> =>
    request<User>("GET", "/api/v1/admin/users/" + encodeURIComponent(id)),
  getUserTransactions: (id: string, page = 1): Promise<UserTransactionsResponse> => {
    const q = new URLSearchParams({ page: String(page) });
    return request<UserTransactionsResponse>("GET", "/api/v1/admin/users/" + encodeURIComponent(id) + "/transactions?" + q.toString());
  },
  updateUserRole: (id: string, role: string) =>
    request<any>("PUT", "/api/v1/admin/users/" + encodeURIComponent(id) + "/role", { role }),
  toggleUserBan: (id: string, banned: boolean) =>
    request<any>("PUT", "/api/v1/admin/users/" + encodeURIComponent(id) + "/ban", { banned }),
  adjustUserBalance: (id: string, amount: number, type: "credit" | "debit", reason: string) =>
    request<any>("POST", "/api/v1/admin/users/" + encodeURIComponent(id) + "/balance", { amount, type, reason }),

  // Verification Logs
  getVerificationLogs: (page = 1, search = ""): Promise<VerificationLogsResponse> => {
    const q = new URLSearchParams({ page: String(page), search });
    return request<VerificationLogsResponse>("GET", "/api/v1/admin/verification-logs?" + q.toString());
  },
  verificationLogs: (page = 1, search = ""): Promise<VerificationLogsResponse> => {
    const q = new URLSearchParams({ page: String(page), search });
    return request<VerificationLogsResponse>("GET", "/api/v1/admin/verification-logs?" + q.toString());
  },

  // Games
  getGames: () =>
    request<any>("GET", "/api/v1/admin/games"),
  games: () =>
    request<any>("GET", "/api/v1/admin/games"),
  cancelGame: (id: string) =>
    request<any>("POST", "/api/v1/admin/games/" + encodeURIComponent(id) + "/cancel"),
};