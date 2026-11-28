/* CareQuay Casino — FAQ (shared by the app's Help page and the public /faq page). */
(function (root) {
  "use strict";
  const FAQ = [
    { cat: "Account", icon: "👤", items: [
      ["Do I need to verify my identity?", "No. CareQuay is a no-KYC casino: you sign up with an email address and password, and we don't ask for ID documents to deposit or withdraw. We may still ask questions or pause an account if we suspect fraud, under-age play or another breach of our terms."],
      ["Who can play?", "You must be 18 or over (or older if the law where you are says so) and online gambling must be legal where you are. The site isn't available in Australia, the United States, the United Kingdom, France, the Netherlands, Spain, Italy, Ontario, Curaçao or sanctioned countries. Using a VPN to get around this isn't allowed."],
      ["Can I have more than one account?", "No — one account per person. Duplicate accounts are closed and any bonus, cashback or referral earnings on them are cancelled."],
      ["I forgot my password. What do I do?", "On the login screen, tap “I forgot my password” and enter your email. You'll get a reset link that works for one hour."],
      ["Can I play for free?", "Yes. Every casino game and the sportsbook have a Fun mode with a $1,000 practice balance that you can reload any time. Fun money has no cash value and can't be withdrawn."],
    ] },
    { cat: "Deposits", icon: "🪙", items: [
      ["Which cryptocurrencies can I use?", "Bitcoin (BTC), Ethereum (ETH on the Ethereum network), Litecoin (LTC), BNB on BNB Smart Chain, and TRON (TRX)."],
      ["How do I deposit?", "Log in, open Wallet, choose a coin and copy your deposit address. Send the coin from your own wallet or exchange using the network shown. Your deposit is added to your real balance in US dollars at the live rate once it's received."],
      ["How long does a deposit take?", "It depends on the blockchain. TRON and Litecoin usually arrive within minutes; Bitcoin can take 10–60 minutes depending on network fees. You'll see it in your Wallet once it's credited, and you'll get a Telegram alert if you've connected the bot."],
      ["What if I send the wrong coin or use the wrong network?", "Coins sent on the wrong network or to the wrong address usually can't be recovered. Always check the coin and network before sending, and copy the address rather than typing it."],
      ["Why is my balance in US dollars?", "So you always know what you're playing with. Deposits are converted at the live market rate when they're credited, and withdrawals are converted back at the live rate when you request them."],
    ] },
    { cat: "Withdrawals", icon: "💸", items: [
      ["How fast are withdrawals?", "Withdrawals are usually processed in under 10 minutes. Occasionally they take longer — for example during network congestion, outside staffed hours, or when a payout needs a security check."],
      ["What are the withdrawal limits?", "The minimum withdrawal is $20 and the maximum is $10,000 in any rolling 24 hours. Larger amounts are paid in instalments — your Wallet shows how much you can withdraw right now."],
      ["Why can't I withdraw my deposit yet?", "Every deposit must be wagered once (1×) on real-money bets before it can be withdrawn. Your Wallet shows how much is left to wager. Cashback and referral earnings have no wagering requirement."],
      ["Can I withdraw to a different coin than I deposited?", "Yes. You can withdraw to any of the five supported coins, to your own wallet address."],
      ["Are there withdrawal fees?", "We don't charge a withdrawal fee, but the blockchain network fee may be deducted from the amount you receive."],
    ] },
    { cat: "Cashback & referrals", icon: "🎁", items: [
      ["How does the 20% cashback work?", "Every week (Sunday 22:00 UTC to Sunday 22:00 UTC) we add up your real-money bets minus your real-money winnings, across casino and sports. If that's a loss, 20% of it is paid to your real balance automatically, with no wagering requirement."],
      ["When does cashback arrive?", "It's calculated when the week ends at Sunday 22:00 UTC and appears the next time you open the site. The Bonuses page shows a countdown and what you'd get if the week ended now."],
      ["How does the referral program work?", "Open Invite friends to get your personal link. When someone signs up through it, you earn 10% of their weekly net real-money losses, paid to your real balance every Sunday with no wagering requirement. There's no limit on how many friends you can invite."],
      ["Can I refer my own second account?", "No. Self-referrals, duplicate accounts and spam are against the rules and earnings from them are cancelled."],
    ] },
    { cat: "Casino games", icon: "🎰", items: [
      ["What are the betting limits?", "Casino games take bets from $0.10 to $50 per spin, hand or round. Doubling or splitting in blackjack and side bets count as separate bets up to the same limit."],
      ["Are the games fair?", "Every result is decided on our server with a cryptographically secure random number generator before the animation starts. Each game's return to player (RTP) is shown under “How it works” in the game."],
      ["What happens if I lose connection mid-game?", "Your round is saved. Blackjack, Mines and other multi-step games pick up where you left off, and a Crash auto cash-out still happens even if you close the page."],
      ["What's the return to player (RTP)?", "Slots are about 94%. Crash, Dice, Limbo, Plinko and Mines are about 97%. Roulette is 97.3% (single zero), blackjack about 99.4% with basic strategy, Jacks or Better 97.3% with perfect play, and Keno about 95%."],
    ] },
    { cat: "Sportsbook", icon: "⚽", items: [
      ["Which sports can I bet on?", "Soccer (including the Premier League, La Liga, Serie A, Bundesliga, Ligue 1 and Champions League), basketball (NBA, NBL, EuroLeague), tennis (ATP and WTA tournaments when they're running) and cricket (Big Bash, Tests, ODIs and T20 internationals)."],
      ["Can I bet on a match that has started?", "No. The sportsbook is pre-match only — betting on each match closes just before it starts."],
      ["How are your odds set?", "We take the live market prices from major bookmakers, remove their margin to get each side's real chance, and add a small margin of our own. The percentage under each price is the market's estimated chance."],
      ["What does a handicap like −1.5 mean?", "The handicap is added to your team's score. −1.5 means your team must win by 2 or more; +1.5 means your team wins the bet if it wins, draws or loses by 1. A result exactly on a whole-number handicap (like −1) is refunded."],
      ["What are the sports betting limits?", "Stakes from $0.10 to $500 per bet, with a maximum return of $5,000 per bet."],
      ["When are sports bets settled?", "Soccer and basketball usually settle automatically within a few hours of the final whistle. Tennis and cricket are settled once the official result is confirmed. You'll get a Telegram alert when a bet settles if you've connected the bot."],
      ["What if a match is postponed or abandoned?", "If it isn't completed (or is postponed for more than 48 hours), bets are void and your stake is refunded."],
    ] },
    { cat: "Safety & support", icon: "🛡️", items: [
      ["How do I take a break or self-exclude?", "Email support@carequay.com and we'll close your account for the period you choose — at least 6 months, or permanently — and return any withdrawable balance. Free, confidential help is available from Gambling Help Online, GamCare, Gamblers Anonymous and the National Council on Problem Gambling."],
      ["How do I get Telegram alerts?", "Open Invite friends and tap Connect Telegram. Our bot will message you when a bet settles, a deposit is credited, a withdrawal is sent or you earn from referrals. Send /stop to the bot to turn alerts off."],
      ["How do I contact support?", "Email support@carequay.com from the email address on your account. Include any bet or transaction IDs so we can help faster."],
      ["How do I make a complaint?", "Email support@carequay.com from your account email address with what happened and any bet or transaction IDs. We aim to reply within 14 days."],
    ] },
  ];
  const api = { FAQ, all: () => FAQ.flatMap((c) => c.items) };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.CQFaq = api;
})(typeof window !== "undefined" ? window : globalThis);
