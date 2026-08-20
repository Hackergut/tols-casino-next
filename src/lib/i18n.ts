/*
 * English dictionary for the platform.
 *
 * The product is English-only: every string lives here and is resolved by
 * `translate()`. Missing keys fall back to the literal key so a typo shows up
 * as a visible key rather than silently rendering empty. The `locale` cookie
 * and the `x-locale` header remain for compatibility but always resolve to
 * "en".
 */

export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
};

/**
 * The platform is English-only, so locale resolution always returns "en".
 * The cookie/header plumbing is preserved so existing sessions and the edge
 * proxy keep working unchanged.
 */
export function resolveLocale(_opts?: {
  cookie?: string | null;
  country?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  return DEFAULT_LOCALE;
}

// ── Starter dictionary. Extend per screen; missing keys fall back to English. ──
type Dict = Record<string, string>;
const STRINGS: Record<Locale, Dict> = {

  en: {
    "nav.lobby": "Lobby", "nav.games": "Games", "nav.live": "Live", "nav.wallet": "Wallet", "nav.chat": "Chat", "nav.rewards": "Rewards", "nav.menu": "Menu", "nav.search": "Search", "nav.casino": "Casino",
    "auth.login": "Login", "auth.register": "Register", "auth.signin": "Sign in", "common.play": "Play", "common.deposit": "Deposit", "common.withdraw": "Withdraw",
    "search.placeholder": "Search games...",
    "age.title": "Age verification", "age.subtitle": "You must be 18 or over to enter", "age.body": "TOLS Casino is real-money gambling and is restricted to adults. By entering you confirm you are of legal age in your jurisdiction and accept our terms.", "age.confirm": "I am {age} or older — Enter", "age.deny": "I am under 18", "age.footer": "Gambling can be addictive. Play responsibly.", "age.terms": "Terms", "age.responsible": "Responsible Gaming",
    "age.denied.title": "Access denied", "age.denied.body": "You must be 18 or over to use TOLS Casino. If you entered this by mistake, close this page and return when you are of legal age.",
    "cookies.title": "Cookies on TOLS", "cookies.body": "We use necessary cookies to run the casino and keep your session secure. With your permission we also use analytics and marketing cookies. Read our", "cookies.policy": "Cookie & Privacy Policy",
    "cookies.acceptAll": "Accept all", "cookies.rejectAll": "Reject non-essential", "cookies.customise": "Customise", "cookies.save": "Save choices",
    "cookies.necessary": "Strictly necessary", "cookies.necessary.desc": "Session, login, security and your compliance choices. Always on.",
    "cookies.analytics": "Analytics", "cookies.analytics.desc": "Anonymous usage statistics that help us improve the games.",
    "cookies.marketing": "Marketing", "cookies.marketing.desc": "Personalised bonuses and promotional measurement.",
    "geo.blocked.title": "Not available in your region", "geo.blocked.body": "TOLS Casino cannot accept players from your location ({country}) for licensing reasons. No account or funds are affected.", "geo.blocked.contact": "Contact support",
    "geo.vpn.title": "VPN or proxy detected.", "geo.vpn.body": "You can keep playing, but withdrawals may require identity verification. Using a VPN to bypass regional restrictions breaches our terms.",
    "common.dismiss": "Dismiss",
  }
};

// Shared casino shell vocabulary, kept in one place so screens stay consistent.
const PLATFORM_STRINGS: Record<Locale, Dict> = {

  en: {
    "common.back":"Back","common.carousel":"Carousel","common.goTo":"Go to {target}","common.previous":"Previous","common.next":"Next","common.close":"Close","common.loading":"Loading…","common.viewAll":"View all","common.showMore":"Show more","common.showLess":"Show less","common.spin":"Spin","common.enter":"Enter","common.new":"New","common.hot":"Hot","common.live":"Live",
    "nav.home":"Home","nav.originals":"Originals","nav.slots":"Slots","nav.liveCasino":"Live Casino","nav.virtual":"Virtual Games","nav.table":"Table Games","nav.recent":"Recent","nav.leaderboards":"Leaderboards","nav.settings":"Settings",
    "sidebar.personal":"Personal","sidebar.games":"Game Categories","sidebar.discover":"Discover",
    "header.notifications":"Notifications","header.community":"Community chat","header.openWallet":"Open wallet","header.signup":"Sign up","header.player":"Player","header.logout":"Logout","header.toggleMenu":"Toggle menu",
    "profile.vault":"Vault","profile.vip":"VIP","profile.language":"Language","profile.languageHint":"Automatically detected from your region. You can override it here.","profile.preferences":"Preferences","profile.account":"Account","profile.token":"Token","profile.affiliate":"Affiliate Program","profile.transactions":"Transactions","profile.redeem":"Redeem Code","profile.responsible":"Play Responsibly","profile.support":"Live Support",
    "search.noResults":"No games found",
    "promo.level-up.label":"Level Up!","promo.level-up.detail":"Reward at every tier","promo.clutch-up.label":"$20K Clutch Up","promo.clutch-up.detail":"Ends in 10 days","promo.weekly-race.label":"$100,000 Weekly Race","promo.weekly-race.detail":"Live leaderboard","promo.challenges.label":"Casino Challenges","promo.challenges.detail":"29 open","promo.affiliate.label":"Affiliate Program","promo.affiliate.detail":"Earn commission","home.gameShows":"Game Shows","home.latest":"Latest Releases","home.aboutTitle":"TOLS — Provably Fair Crypto Casino","home.aboutBody":"Every Original is settled by the server from a committed seed, your client seed and an increasing nonce. Rotate the seed to reveal it and independently verify every result.","home.aboutMath":"Game maths is server-enforced: standard Originals return {rtp}%, Blackjack 99.52%, Slots {slotsRtp}% and European Roulette 97.3%.","home.aboutSecurity":"Balances move in atomic database transactions and privileged actions are recorded in an audit trail.","home.noCategory":"No {category} in the catalogue yet","home.addedLater":"Games appear here once they are added to the library","home.weeklyRace":"$100,000 Weekly Race","home.resetsMonday":"Resets every Monday","home.wagered":"{amount} wagered","home.raceEmpty":"The leaderboard is warming up — place a bet to enter",
    "games.available":"{count} games available","games.recentHelp":"Games you have played recently","games.none":"No games available","games.notFound":"Game not found",
    "leader.title":"Player Leaderboards","leader.subtitle":"Real paid bets power every ranking, promotion and tournament score. Practice rounds never count.","leader.liveCompetition":"Live competition","leader.promotions":"Live promotions","leader.prizePool":"Prize pool","leader.endsIn":"Ends in","leader.yourRank":"Your rank","leader.playToRank":"Play to rank","leader.refresh":"Refresh leaderboards","leader.tournaments":"Tournaments","leader.betActivity":"Bet activity","leader.liveBets":"Live bets","leader.highRollers":"High rollers","leader.joined":"Tournament joined — paid bets now update your score live","leader.playOriginals":"Play Originals",
    "footer.support":"Support","footer.platform":"Platform","footer.policy":"Policy","footer.community":"Community","footer.help":"Help Center","footer.responsible":"Game Responsibly","footer.fair":"Provably Fair","footer.terms":"Terms of Service","footer.privacy":"Privacy Policy","footer.aml":"AML Policy","game.back":"Back to lobby","game.soundOn":"Mute","game.soundOff":"Unmute","game.quickPlay":"Quick play — skip result animations","game.provablyFair":"Provably Fair","game.placeBet":"Place a bet to see this round's commitment.","error.connection":"Connection lost","error.betNotSent":"Your bet was not sent.","error.tooMany":"Too many bets","error.wait":"Wait a few seconds and try again.","error.balance":"Insufficient balance","error.reduce":"Reduce the bet or make a deposit.","error.betFailed":"Bet failed","error.retry":"Try again.",
  }
};

/** Translate a key for the (single) locale, falling back to the key itself. */
export function translate(locale: Locale, key: string): string {
  return PLATFORM_STRINGS[locale]?.[key] ?? STRINGS[locale]?.[key] ?? PLATFORM_STRINGS.en[key] ?? STRINGS.en[key] ?? key;
}
