# Habesha Bingo — Admin Dashboard

React + Vite + Tailwind admin panel for the Bingo backend. Talks to the Go API's
`/admin/*` endpoints using an admin JWT.

## Features

- **Login** — admin signs in with Telegram ID + password (`POST /auth/login`); non-admins are rejected.
- **Dashboard** — pending deposits/withdrawals, total users/transactions, total wallet balance, house-cut revenue, games by type.
- **Transactions** — tabbed (pending deposits/withdrawals, all, completed, transfers, failed) with approve/reject/cancel actions.
- **Users** — searchable, paginated list with balance, role, and ban status; click through to detail.
- **User detail** — promote/demote admin, ban/unban, manual balance credit/debit (with reason).
- **Staff** — list current admins and demote.

## Develop

```bash
npm install
npm run dev          # http://localhost:5174
```

Set the backend URL in `.env.local`:

```
VITE_API_BASE=https://bingo-api-c6un.onrender.com
```

> The backend CORS allowlist must include this app's origin
> (`http://localhost:5174` for dev, and your Vercel URL in production).

## Build / deploy

```bash
npm run build        # outputs dist/
```

Deploy to Vercel as a separate project (framework preset: **Vite**). Set
`VITE_API_BASE` in the Vercel project env. `vercel.json` rewrites all routes to
`/` for client-side routing.

## Requirements on the backend

- An admin account exists (created via the secret-code-gated `POST /auth/create-admin`).
- Migration `012_add_user_banned.sql` has been applied (for ban/unban).
