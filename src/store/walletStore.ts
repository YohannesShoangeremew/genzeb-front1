import { create } from "zustand";
import type { Wallet } from "@/types/api";
import { api } from "@/lib/api";
import { DEV_MOCK, mockWallet } from "@/lib/devMock";

interface WalletState {
  wallet: Wallet | null;
  loading: boolean;
  balance: () => number;
  /** Play-only bonus: buys cards, never withdrawable. */
  bonus: number;
  bonusExpiry?: string;
  announcement: string;
  /**
   * What the player can actually spend on a card — cash PLUS bonus.
   *
   * The card picker must gate on this, not on cash alone. Bonus pays for cards
   * first, so someone holding 8 birr cash and 50 birr bonus can afford a
   * 10-birr card; checking only cash locks them out of the very thing the
   * bonus was given for.
   */
  spendable: () => number;
  refresh: () => Promise<void>;
}

export const useWallet = create<WalletState>((set, get) => ({
  wallet: null,
  loading: false,
  bonus: 0,
  announcement: "",

  balance: () => get().wallet?.balance ?? 0,
  spendable: () => (get().wallet?.balance ?? 0) + get().bonus,

  refresh: async () => {
    if (DEV_MOCK) {
      set({ wallet: mockWallet });
      return;
    }
    set({ loading: true });
    try {
      // Both in one refresh so the two figures can never disagree on screen.
      // A bonus failure must not blank the cash balance — bonus is the
      // optional extra, cash is what the game fundamentally runs on.
      const [wallet, bonusRes] = await Promise.all([
        api.myWallet(),
        api.myBonus().catch(() => null),
      ]);
      set({
        wallet,
        bonus: bonusRes?.bonus.amount ?? 0,
        bonusExpiry: bonusRes?.bonus.next_expiry,
        announcement: bonusRes?.announcement ?? "",
      });
    } finally {
      set({ loading: false });
    }
  },
}));
