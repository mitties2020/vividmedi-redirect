# CareQuay Casino

Node.js server (no framework) + static front end. Accounts with email confirmation and password reset,
fun and real-money (USD) balances, all game results decided server-side, 20-coin wallet with live prices,
withdrawal requests, 20% weekly cashback (Sunday 22:00 UTC).

## Run
    npm install
    DATABASE_URL=postgres://... node server.js      # without DATABASE_URL an in-memory store is used (testing only)

## Environment variables
| Name | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `APP_URL` | Public URL used in email links, e.g. `https://carequay-casino-app.onrender.com` |
| `NODE_ENV` | `production` (secure cookies, HSTS) |
| `ADMIN_TOKEN` | Secret (16+ chars) for the admin API |
| `RESEND_API_KEY` + `EMAIL_FROM` | Send emails through Resend, **or** |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Send through SMTP (e.g. Gmail app password: smtp.gmail.com, 465) |
| `MIN_WITHDRAW_USD` | Minimum withdrawal (default 20) |
| `DEPOSIT_ADDRESSES` | Reserved — deposit addresses are not wired up yet |

Without email settings, confirmation/reset links are written to the server log.

## Admin API (header `x-admin-token: <ADMIN_TOKEN>`)
- `POST /api/admin/deposit` `{ "email", "coin": "BTC", "amount": 0.01, "txid"?, "price"? }` — credit a confirmed deposit at the live USD rate (adds 1× wagering)
- `POST /api/admin/confirm` `{ "email" }` — confirm an account manually
- `GET /api/admin/withdrawals?status=pending` — list withdrawal requests
- `POST /api/admin/withdrawals/:id` `{ "status": "paid", "txid" }` or `{ "status": "rejected" }` (rejected refunds the balance)

## Before taking real deposits
Insert operator, licence and restricted-jurisdiction details in the Terms (public/js/pages.js), connect deposit
addresses and payout processing, and add KYC/AML checks as your licence requires.
