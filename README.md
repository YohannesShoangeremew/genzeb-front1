# Habesha Bingo — Telegram Mini App

The player-facing **Telegram Mini App** for the Habesha Bingo backend
(`../bingo-backend`, Go). Real-money multiplayer bingo with a free practice
mode, bilingual UI (Amharic / English), live WebSocket gameplay, and a
neon/gradient theme designed to stand out from competitor bingo apps.

## Stack

React 18 · Vite · TypeScript · Tailwind CSS · Zustand · TanStack Query ·
React Router · Framer Motion · i18next · `@telegram-apps/sdk` · canvas-confetti.

## Getting started

```bash
cp .env.example .env.local      # set VITE_API_BASE + VITE_BOT_USERNAME
npm install
npm run dev                     # http://localhost:5173
```

The backend must be running and reachable at `VITE_API_BASE` (default
`http://localhost:8000`). From the backend repo: `docker compose up`.

### Developing outside Telegram

Telegram injects a signed `initData` blob that the backend verifies. In a normal
browser there is none, so set `VITE_DEV_TELEGRAM_SHIM=1` to inject a fake one.

> The fake initData is **unsigned**, so `POST /auth/telegram` will reject it.
> To exercise authenticated flows locally, capture a real `initData` from a
> Telegram session and store it: `localStorage.dev_init_data = "<initData>"`,
> then reload.

## Scripts

| Command           | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Vite dev server                       |
| `npm run build`   | Type-check + production build (`dist`)|
| `npm run preview` | Serve the production build            |
| `npm test`        | Run unit tests (bingo win-logic)      |
| `npm run lint`    | `tsc --noEmit`                        |

## How it maps to the backend

- **Auth** — `POST /api/v1/auth/telegram` `{init_data}` → `{token, user}`; JWT
  sent as `Authorization: Bearer` on all `/me/*` and game-action calls.
- **Lobby** — `GET /games` (no `type`, so no game is auto-created) polled for
  live player counts / prize pools per stake (G1–G7).
- **Join** — picking a card calls `GET /cards/:id` (preview) then
  `POST /games/:id/join {card_id}`. The bet is deducted from the **real**
  balance server-side.
- **Live game** — read-only WebSocket `…/api/v1/ws/game/:gameId`; events drive
  the board, ball call-out, countdown, and win/eliminated overlays. Claims go
  via `POST /games/:id/bingo {marked_numbers}` (positions 0–24, row-major).

### Practice / Demo mode

The backend game engine deducts only the **real** wallet balance — it has no
demo-play path. So Practice mode is a **fully client-side simulated game**
(`src/lib/localGame.ts`): real card data from `GET /cards/:id`, local number
draws, and local win-checking via `src/lib/bingo.ts`. It never contacts the
game endpoints and never touches the wallet. It exists purely to let new
players learn the game for free.

### Best-effort features

- **Leaderboard** and **daily streak** are client-side only — the backend has
  no endpoints for them. They are labeled as such and never fabricate other
  players' activity.

## Deploy

`npm run build` emits a static `dist/` deployable to Vercel / Railway / any
static host over HTTPS.

1. Deploy and note the HTTPS URL.
2. **Add that URL to the backend CORS allow-list** in
   `../bingo-backend/cmd/server/main.go` (`AllowOrigins`) and redeploy the API.
3. In @BotFather, set the Mini App / `web_app` button URL to the deployed app.
4. Set production env: `VITE_API_BASE` to the deployed API, `VITE_BOT_USERNAME`
   to your bot, and leave `VITE_DEV_TELEGRAM_SHIM` unset (or `0`).

## Project layout

```
src/
  lib/        telegram, api, ws, localGame, audio, bingo (+ test), constants, format
  store/      auth, wallet, settings (zustand)
  i18n/       en + am locales
  components/ ui/ · layout/ · bingo/ · lobby/
  screens/    Splash, NotRegistered, Lobby, CardSelect, GameRoom, Wallet, Profile,
              Referral, Leaderboard
```
