# CareQuay Casino

Play-money crypto-style casino. Static site — no build step, no backend.

- **Crypto games:** Crash, Plinko, Limbo, Mines, Dice, Keno (~99% RTP; Keno ~97%)
- **Slots:** 20 original machines — Classic 3×3, Book, Tumble (pays anywhere), 243/1024 Ways, 10/20 Lines — all with simulated RTP ≈ 96%
- **Tables:** Blackjack (6 decks, S17, 3:2), European Roulette

Balances are play coins stored in the browser (`localStorage`). No deposits, withdrawals or real-money wagering.
Real-money operation would need a gambling licence, KYC/AML, a licensed payments/wallet provider and server-side game results;
online casino services also can't be offered to people in Australia under the Interactive Gambling Act 2001.

Open `index.html` locally, or deploy the folder as a static site (Render: publish path `casino`).
