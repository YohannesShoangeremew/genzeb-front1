// Dev-only mock so the app can be browsed in a normal web browser without a
// real Telegram session. Enabled with VITE_DEV_MOCK_AUTH=1 (NEVER in prod).
//
// With this on, login is short-circuited to a fake user + wallet and no backend
// call is made. The UI is fully browsable and Practice/Demo mode (which is
// entirely client-side) is playable end-to-end. Real-money flows that need the
// backend (joining live games, deposits) will fail gracefully — that's expected.

import type { BingoCard, User, Wallet } from "@/types/api";
import { COLUMN_RANGES, LETTERS } from "@/lib/constants";

export const DEV_MOCK = import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_AUTH === "1";

/**
 * Generate a valid 5x5 bingo card from a card id, without the backend. Each
 * card id yields a stable card (seeded), so the preview matches the game.
 * Layout matches the backend: numbers[row][col], col 0..4 = B,I,N,G,O,
 * center (numbers[2][2]) = 0 (FREE).
 */
export function generateMockCard(id: number): BingoCard {
  let seed = id * 2654435761; // simple deterministic seed
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const numbers: number[][] = [[], [], [], [], []].map(() => [0, 0, 0, 0, 0]);
  LETTERS.forEach((letter, col) => {
    const [min, max] = COLUMN_RANGES[letter];
    const pool: number[] = [];
    for (let n = min; n <= max; n++) pool.push(n);
    // Fisher-Yates with the seeded RNG.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let row = 0; row < 5; row++) numbers[row][col] = pool[row];
  });
  numbers[2][2] = 0; // free center

  return { id, numbers };
}

export const mockUser: User = {
  id: "00000000-0000-0000-0000-000000000001",
  telegram_id: 123456789,
  first_name: "Dawit",
  last_name: "Tester",
  phone_number: "+251900000000",
  referal_code: "HAB123",
  role: "user",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockWallet: Wallet = {
  user_id: mockUser.id,
  balance: 500,
  demo_balance: 1000,
  updated_at: new Date().toISOString(),
};
