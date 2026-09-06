import { create } from "zustand";
import type { User } from "@/types/api";
import { api, setAuthToken } from "@/lib/api";
import { getInitData } from "@/lib/telegram";
import { DEV_MOCK, mockUser } from "@/lib/devMock";

type AuthStatus = "idle" | "authenticating" | "authed" | "not_registered" | "error";

interface AuthState {
  status: AuthStatus;
  token: string | null;
  user: User | null;
  error: string | null;
  authenticate: () => Promise<void>;
  setUser: (u: User) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: "idle",
  token: null,
  user: null,
  error: null,

  authenticate: async () => {
    if (get().status === "authenticating") return;
    set({ status: "authenticating", error: null });

    // Dev: skip Telegram + backend and sign in as a mock user.
    if (DEV_MOCK) {
      set({ status: "authed", token: "dev-mock-token", user: mockUser });
      return;
    }

    const initData = getInitData();
    if (!initData) {
      set({ status: "error", error: "no_telegram" });
      return;
    }

    try {
      const { token, user } = await api.telegramLogin(initData);
      setAuthToken(token);
      set({ status: "authed", token, user });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("not registered")) {
        set({ status: "not_registered", error: msg });
      } else {
        set({ status: "error", error: msg || "auth_failed" });
      }
    }
  },

  setUser: (user) => set({ user }),

  logout: () => {
    setAuthToken(null);
    set({ status: "idle", token: null, user: null });
  },
}));
