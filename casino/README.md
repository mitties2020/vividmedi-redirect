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
| `DEPOSIT_ADDRESSES` | JSON override for the deposit addresses |
| `ODDS_API_KEY` | The Odds API key (the-odds-api.com) — turns the sportsbook on |
| `ODDS_REGION` | Bookmaker region for market odds (default `au`) |
| `ODDS_TTL_MIN` | Refresh a league's odds at most every N minutes (default 360) |
| `ODDS_MAX_AGE_MIN` | Pause betting on a league whose odds are older than this (default 1440) |
| `ODDS_SPREADS` | `0` turns off handicap markets (halves credit use) |
| `SPORTS_MARGIN` | Margin added over the fair market price (default 0.06) |
| `SPORTS_MAX_STAKE` / `SPORTS_MAX_PAYOUT` | Per-bet limits in USD (default 500 / 5000) |
| `SPORTS_LEAGUES` | Optional comma list of league keys to offer instead of the defaults |

Without email settings, confirmation/reset links are written to the server log.

## Admin API (header `x-admin-token: <ADMIN_TOKEN>`)
- `POST /api/admin/deposit` `{ "email", "coin": "BTC", "amount": 0.01, "txid"?, "price"? }` — credit a confirmed deposit at the live USD rate (adds 1× wagering)
- `POST /api/admin/confirm` `{ "email" }` — confirm an account manually
- `GET /api/admin/withdrawals?status=pending` — list withdrawal requests
- `POST /api/admin/withdrawals/:id` `{ "status": "paid", "txid" }` or `{ "status": "rejected" }` (rejected refunds the balance)
- `GET /api/admin/sports` — open sports bets by match, credits left
- `POST /api/admin/sports/settle` `{ "eventId", "result": "home"|"away"|"draw"|"void", "homeScore"?, "awayScore"? }`

Sportsbook credit use: each league refresh costs 1 credit per market (2 with handicaps). The server spreads the
remaining monthly credits over the days left and keeps a small reserve, so on the free plan odds refresh less often
when the site is busy. Soccer and basketball bets settle automatically from final scores (2 credits per check);
tennis and cricket are settled on the admin page.

## Before taking real deposits
Insert operator, licence and restricted-jurisdiction details in the Terms (public/js/pages.js), connect deposit
addresses and payout processing, and add KYC/AML checks as your licence requires.
