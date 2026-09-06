import { create } from "zustand";
import { api, setToken, getToken, type User } from "@/lib/api";

const USER_KEY = "bingo_admin_user";

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  ready: boolean; // token + user restored from storage
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: loadUser(),
  ready: !!getToken(),

  login: async (phone, password) => {
    const { token, user } = await api.login(phone, password);
    if (user.role !== "admin") {
      throw new Error("This account is not an admin.");
    }
    setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, ready: true });
  },

  logout: () => {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    set({ user: null, ready: false });
  },
}));

export function isAuthed(): boolean {
  return !!getToken();
}
