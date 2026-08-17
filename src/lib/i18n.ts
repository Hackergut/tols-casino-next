/*
 * Locale detection + light dictionary.
 *
 * The platform picks a language from the visitor's region: geo IP country
 * first (Vercel's x-vercel-ip-country), then the browser's Accept-Language,
 * then a default. An explicit choice stored in the `locale` cookie always wins.
 * Detection is done in middleware; this module holds the mapping and strings.
 */

export const LOCALES = ["en", "it", "es", "fr", "de", "pt", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English", it: "Italiano", es: "Español", fr: "Français", de: "Deutsch", pt: "Português", ru: "Русский",
};

// Country (ISO-3166 alpha-2) → language. Anything unmapped falls back to en.
const COUNTRY_LOCALE: Record<string, Locale> = {
  IT: "it", SM: "it", VA: "it",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es", EC: "es", UY: "es", PY: "es", BO: "es", GT: "es", CR: "es", DO: "es",
  FR: "fr", BE: "fr", LU: "fr", MC: "fr",
  DE: "de", AT: "de",
  PT: "pt", BR: "pt", AO: "pt", MZ: "pt",
  RU: "ru", BY: "ru", KZ: "ru", KG: "ru",
};

function isLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

export function localeFromCountry(country?: string | null): Locale | null {
  if (!country) return null;
  return COUNTRY_LOCALE[country.toUpperCase()] ?? null;
}

export function localeFromAcceptLanguage(header?: string | null): Locale | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const code = part.trim().split(";")[0].split("-")[0].toLowerCase();
    if (isLocale(code)) return code;
  }
  return null;
}

/** Explicit cookie choice wins; otherwise region, then browser, then default. */
export function resolveLocale(opts: { cookie?: string | null; country?: string | null; acceptLanguage?: string | null }): Locale {
  if (isLocale(opts.cookie)) return opts.cookie;
  return localeFromCountry(opts.country) ?? localeFromAcceptLanguage(opts.acceptLanguage) ?? DEFAULT_LOCALE;
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
  },
  it: {
    "nav.lobby": "Lobby", "nav.games": "Giochi", "nav.live": "Live", "nav.wallet": "Portafoglio", "nav.chat": "Chat", "nav.rewards": "Premi", "nav.menu": "Menu", "nav.search": "Cerca", "nav.casino": "Casinò",
    "auth.login": "Accedi", "auth.register": "Registrati", "auth.signin": "Accedi", "common.play": "Gioca", "common.deposit": "Deposita", "common.withdraw": "Preleva",
    "search.placeholder": "Cerca giochi...",
    "age.title": "Verifica dell'età", "age.subtitle": "Devi avere almeno 18 anni per entrare", "age.body": "TOLS Casino è gioco d'azzardo con denaro reale ed è riservato agli adulti. Entrando confermi di avere l'età legale nella tua giurisdizione e di accettare i nostri termini.", "age.confirm": "Ho {age} anni o più — Entra", "age.deny": "Ho meno di 18 anni", "age.footer": "Il gioco può causare dipendenza. Gioca responsabilmente.", "age.terms": "Termini", "age.responsible": "Gioco Responsabile",
    "age.denied.title": "Accesso negato", "age.denied.body": "Devi avere almeno 18 anni per usare TOLS Casino. Se sei arrivato qui per errore, chiudi la pagina e torna quando avrai l'età legale.",
    "cookies.title": "Cookie su TOLS", "cookies.body": "Usiamo cookie necessari per far funzionare il casinò e proteggere la tua sessione. Con il tuo consenso usiamo anche cookie analitici e di marketing. Leggi la nostra", "cookies.policy": "Cookie & Privacy Policy",
    "cookies.acceptAll": "Accetta tutti", "cookies.rejectAll": "Rifiuta non essenziali", "cookies.customise": "Personalizza", "cookies.save": "Salva scelte",
    "cookies.necessary": "Strettamente necessari", "cookies.necessary.desc": "Sessione, accesso, sicurezza e le tue scelte di consenso. Sempre attivi.",
    "cookies.analytics": "Analitici", "cookies.analytics.desc": "Statistiche d'uso anonime che ci aiutano a migliorare i giochi.",
    "cookies.marketing": "Marketing", "cookies.marketing.desc": "Bonus personalizzati e misurazione delle promozioni.",
    "geo.blocked.title": "Non disponibile nella tua regione", "geo.blocked.body": "TOLS Casino non può accettare giocatori dalla tua posizione ({country}) per motivi di licenza. Nessun account o fondo è coinvolto.", "geo.blocked.contact": "Contatta il supporto",
    "geo.vpn.title": "VPN o proxy rilevato.", "geo.vpn.body": "Puoi continuare a giocare, ma i prelievi potrebbero richiedere la verifica dell'identità. Usare una VPN per aggirare le restrizioni regionali viola i nostri termini.",
    "common.dismiss": "Chiudi",
  },
  es: {
    "nav.lobby": "Lobby", "nav.games": "Juegos", "nav.live": "En vivo", "nav.wallet": "Cartera", "nav.chat": "Chat", "nav.rewards": "Premios", "nav.menu": "Menú", "nav.search": "Buscar", "nav.casino": "Casino",
    "auth.login": "Entrar", "auth.register": "Registrarse", "auth.signin": "Entrar", "common.play": "Jugar", "common.deposit": "Depositar", "common.withdraw": "Retirar",
    "search.placeholder": "Buscar juegos...",
    "age.title": "Verificación de edad", "age.subtitle": "Debes tener 18 años o más para entrar", "age.body": "TOLS Casino es juego con dinero real y está restringido a adultos. Al entrar confirmas que tienes la edad legal en tu jurisdicción y aceptas nuestros términos.", "age.confirm": "Tengo {age} años o más — Entrar", "age.deny": "Soy menor de 18", "age.footer": "El juego puede causar adicción. Juega con responsabilidad.", "age.terms": "Términos", "age.responsible": "Juego Responsable",
    "age.denied.title": "Acceso denegado", "age.denied.body": "Debes tener 18 años o más para usar TOLS Casino. Si has llegado aquí por error, cierra esta página y vuelve cuando tengas la edad legal.",
    "cookies.title": "Cookies en TOLS", "cookies.body": "Usamos cookies necesarias para operar el casino y proteger tu sesión. Con tu permiso también usamos cookies analíticas y de marketing. Lee nuestra", "cookies.policy": "Política de Cookies y Privacidad",
    "cookies.acceptAll": "Aceptar todas", "cookies.rejectAll": "Rechazar no esenciales", "cookies.customise": "Personalizar", "cookies.save": "Guardar opciones",
    "cookies.necessary": "Estrictamente necesarias", "cookies.necessary.desc": "Sesión, inicio de sesión, seguridad y tus opciones de consentimiento. Siempre activas.",
    "cookies.analytics": "Analíticas", "cookies.analytics.desc": "Estadísticas de uso anónimas que nos ayudan a mejorar los juegos.",
    "cookies.marketing": "Marketing", "cookies.marketing.desc": "Bonos personalizados y medición promocional.",
    "geo.blocked.title": "No disponible en tu región", "geo.blocked.body": "TOLS Casino no puede aceptar jugadores desde tu ubicación ({country}) por motivos de licencia. Ninguna cuenta ni fondo se ve afectado.", "geo.blocked.contact": "Contactar con soporte",
    "geo.vpn.title": "VPN o proxy detectado.", "geo.vpn.body": "Puedes seguir jugando, pero los retiros pueden requerir verificación de identidad. Usar una VPN para eludir restricciones regionales infringe nuestros términos.",
    "common.dismiss": "Cerrar",
  },
  fr: {
    "nav.lobby": "Lobby", "nav.games": "Jeux", "nav.live": "Live", "nav.wallet": "Portefeuille", "nav.chat": "Chat", "nav.rewards": "Récompenses", "nav.menu": "Menu", "nav.search": "Rechercher", "nav.casino": "Casino",
    "auth.login": "Connexion", "auth.register": "S'inscrire", "auth.signin": "Se connecter", "common.play": "Jouer", "common.deposit": "Déposer", "common.withdraw": "Retirer",
    "search.placeholder": "Rechercher des jeux...",
    "age.title": "Vérification de l'âge", "age.subtitle": "Vous devez avoir 18 ans ou plus pour entrer", "age.body": "TOLS Casino propose des jeux d'argent réels et est réservé aux adultes. En entrant, vous confirmez avoir l'âge légal dans votre juridiction et accepter nos conditions.", "age.confirm": "J'ai {age} ans ou plus — Entrer", "age.deny": "J'ai moins de 18 ans", "age.footer": "Le jeu peut créer une dépendance. Jouez de manière responsable.", "age.terms": "Conditions", "age.responsible": "Jeu Responsable",
    "age.denied.title": "Accès refusé", "age.denied.body": "Vous devez avoir 18 ans ou plus pour utiliser TOLS Casino. Si vous êtes arrivé ici par erreur, fermez cette page et revenez lorsque vous aurez l'âge légal.",
    "cookies.title": "Cookies sur TOLS", "cookies.body": "Nous utilisons des cookies nécessaires au fonctionnement du casino et à la sécurité de votre session. Avec votre accord, nous utilisons aussi des cookies analytiques et marketing. Consultez notre", "cookies.policy": "Politique de Cookies et Confidentialité",
    "cookies.acceptAll": "Tout accepter", "cookies.rejectAll": "Refuser le non-essentiel", "cookies.customise": "Personnaliser", "cookies.save": "Enregistrer",
    "cookies.necessary": "Strictement nécessaires", "cookies.necessary.desc": "Session, connexion, sécurité et vos choix de consentement. Toujours actifs.",
    "cookies.analytics": "Analytiques", "cookies.analytics.desc": "Statistiques d'usage anonymes qui nous aident à améliorer les jeux.",
    "cookies.marketing": "Marketing", "cookies.marketing.desc": "Bonus personnalisés et mesure promotionnelle.",
    "geo.blocked.title": "Non disponible dans votre région", "geo.blocked.body": "TOLS Casino ne peut pas accepter de joueurs depuis votre localisation ({country}) pour des raisons de licence. Aucun compte ni fonds n'est affecté.", "geo.blocked.contact": "Contacter le support",
    "geo.vpn.title": "VPN ou proxy détecté.", "geo.vpn.body": "Vous pouvez continuer à jouer, mais les retraits peuvent exiger une vérification d'identité. Utiliser un VPN pour contourner les restrictions régionales enfreint nos conditions.",
    "common.dismiss": "Fermer",
  },
  de: {
    "nav.lobby": "Lobby", "nav.games": "Spiele", "nav.live": "Live", "nav.wallet": "Wallet", "nav.chat": "Chat", "nav.rewards": "Prämien", "nav.menu": "Menü", "nav.search": "Suche", "nav.casino": "Casino",
    "auth.login": "Anmelden", "auth.register": "Registrieren", "auth.signin": "Anmelden", "common.play": "Spielen", "common.deposit": "Einzahlen", "common.withdraw": "Auszahlen",
    "search.placeholder": "Spiele suchen...",
    "age.title": "Altersverifizierung", "age.subtitle": "Sie müssen 18 Jahre oder älter sein", "age.body": "TOLS Casino ist Echtgeld-Glücksspiel und nur für Erwachsene. Mit dem Betreten bestätigen Sie, dass Sie in Ihrer Rechtsordnung volljährig sind und unsere Bedingungen akzeptieren.", "age.confirm": "Ich bin {age} oder älter — Eintreten", "age.deny": "Ich bin unter 18", "age.footer": "Glücksspiel kann süchtig machen. Spielen Sie verantwortungsbewusst.", "age.terms": "AGB", "age.responsible": "Verantwortungsvolles Spielen",
    "age.denied.title": "Zugriff verweigert", "age.denied.body": "Sie müssen 18 Jahre oder älter sein, um TOLS Casino zu nutzen. Falls Sie versehentlich hier gelandet sind, schließen Sie diese Seite und kehren Sie zurück, wenn Sie volljährig sind.",
    "cookies.title": "Cookies auf TOLS", "cookies.body": "Wir verwenden notwendige Cookies, um das Casino zu betreiben und Ihre Sitzung zu sichern. Mit Ihrer Erlaubnis nutzen wir auch Analyse- und Marketing-Cookies. Lesen Sie unsere", "cookies.policy": "Cookie- und Datenschutzrichtlinie",
    "cookies.acceptAll": "Alle akzeptieren", "cookies.rejectAll": "Nicht notwendige ablehnen", "cookies.customise": "Anpassen", "cookies.save": "Auswahl speichern",
    "cookies.necessary": "Unbedingt erforderlich", "cookies.necessary.desc": "Sitzung, Login, Sicherheit und Ihre Einwilligungen. Immer aktiv.",
    "cookies.analytics": "Analyse", "cookies.analytics.desc": "Anonyme Nutzungsstatistiken, die uns helfen, die Spiele zu verbessern.",
    "cookies.marketing": "Marketing", "cookies.marketing.desc": "Personalisierte Boni und Erfolgsmessung von Aktionen.",
    "geo.blocked.title": "In Ihrer Region nicht verfügbar", "geo.blocked.body": "TOLS Casino kann aus Lizenzgründen keine Spieler von Ihrem Standort ({country}) annehmen. Konten und Guthaben sind nicht betroffen.", "geo.blocked.contact": "Support kontaktieren",
    "geo.vpn.title": "VPN oder Proxy erkannt.", "geo.vpn.body": "Sie können weiterspielen, aber Auszahlungen können eine Identitätsprüfung erfordern. Ein VPN zur Umgehung regionaler Beschränkungen verstößt gegen unsere Bedingungen.",
    "common.dismiss": "Schließen",
  },
  pt: {
    "nav.lobby": "Lobby", "nav.games": "Jogos", "nav.live": "Ao vivo", "nav.wallet": "Carteira", "nav.chat": "Chat", "nav.rewards": "Recompensas", "nav.menu": "Menu", "nav.search": "Buscar", "nav.casino": "Cassino",
    "auth.login": "Entrar", "auth.register": "Registrar", "auth.signin": "Entrar", "common.play": "Jogar", "common.deposit": "Depositar", "common.withdraw": "Sacar",
    "search.placeholder": "Buscar jogos...",
    "age.title": "Verificação de idade", "age.subtitle": "Precisa de ter 18 anos ou mais para entrar", "age.body": "O TOLS Casino é jogo a dinheiro real e destina-se apenas a adultos. Ao entrar confirma que tem idade legal na sua jurisdição e aceita os nossos termos.", "age.confirm": "Tenho {age} anos ou mais — Entrar", "age.deny": "Tenho menos de 18", "age.footer": "O jogo pode causar dependência. Jogue com responsabilidade.", "age.terms": "Termos", "age.responsible": "Jogo Responsável",
    "age.denied.title": "Acesso negado", "age.denied.body": "Precisa de ter 18 anos ou mais para usar o TOLS Casino. Se chegou aqui por engano, feche esta página e volte quando tiver idade legal.",
    "cookies.title": "Cookies no TOLS", "cookies.body": "Usamos cookies necessários para operar o casino e proteger a sua sessão. Com a sua permissão usamos também cookies de análise e marketing. Leia a nossa", "cookies.policy": "Política de Cookies e Privacidade",
    "cookies.acceptAll": "Aceitar todos", "cookies.rejectAll": "Rejeitar não essenciais", "cookies.customise": "Personalizar", "cookies.save": "Guardar escolhas",
    "cookies.necessary": "Estritamente necessários", "cookies.necessary.desc": "Sessão, início de sessão, segurança e as suas escolhas de consentimento. Sempre ativos.",
    "cookies.analytics": "Análise", "cookies.analytics.desc": "Estatísticas de uso anónimas que nos ajudam a melhorar os jogos.",
    "cookies.marketing": "Marketing", "cookies.marketing.desc": "Bónus personalizados e medição promocional.",
    "geo.blocked.title": "Indisponível na sua região", "geo.blocked.body": "O TOLS Casino não pode aceitar jogadores da sua localização ({country}) por motivos de licenciamento. Nenhuma conta ou fundo é afetado.", "geo.blocked.contact": "Contactar o suporte",
    "geo.vpn.title": "VPN ou proxy detetado.", "geo.vpn.body": "Pode continuar a jogar, mas os levantamentos podem exigir verificação de identidade. Usar VPN para contornar restrições regionais viola os nossos termos.",
    "common.dismiss": "Fechar",
  },
  ru: {
    "nav.lobby": "Лобби", "nav.games": "Игры", "nav.live": "Лайв", "nav.wallet": "Кошелёк", "nav.chat": "Чат", "nav.rewards": "Награды", "nav.menu": "Меню", "nav.search": "Поиск", "nav.casino": "Казино",
    "auth.login": "Вход", "auth.register": "Регистрация", "auth.signin": "Войти", "common.play": "Играть", "common.deposit": "Депозит", "common.withdraw": "Вывод",
    "search.placeholder": "Поиск игр...",
    "age.title": "Проверка возраста", "age.subtitle": "Вход только для лиц 18 лет и старше", "age.body": "TOLS Casino — азартные игры на реальные деньги, доступные только совершеннолетним. Входя, вы подтверждаете, что достигли совершеннолетия в своей юрисдикции и принимаете наши условия.", "age.confirm": "Мне есть {age} — Войти", "age.deny": "Мне нет 18", "age.footer": "Азартные игры вызывают зависимость. Играйте ответственно.", "age.terms": "Условия", "age.responsible": "Ответственная игра",
    "age.denied.title": "Доступ запрещён", "age.denied.body": "Для использования TOLS Casino вам должно быть 18 лет или больше. Если вы попали сюда по ошибке, закройте страницу и вернитесь по достижении совершеннолетия.",
    "cookies.title": "Файлы cookie на TOLS", "cookies.body": "Мы используем необходимые cookie для работы казино и защиты вашей сессии. С вашего согласия мы также используем аналитические и маркетинговые cookie. Ознакомьтесь с нашей", "cookies.policy": "Политикой cookie и конфиденциальности",
    "cookies.acceptAll": "Принять все", "cookies.rejectAll": "Отклонить необязательные", "cookies.customise": "Настроить", "cookies.save": "Сохранить выбор",
    "cookies.necessary": "Строго необходимые", "cookies.necessary.desc": "Сессия, вход, безопасность и ваши согласия. Всегда включены.",
    "cookies.analytics": "Аналитика", "cookies.analytics.desc": "Анонимная статистика использования, помогающая улучшать игры.",
    "cookies.marketing": "Маркетинг", "cookies.marketing.desc": "Персональные бонусы и оценка эффективности промоакций.",
    "geo.blocked.title": "Недоступно в вашем регионе", "geo.blocked.body": "TOLS Casino не может принимать игроков из вашего местоположения ({country}) по лицензионным причинам. Счета и средства не затронуты.", "geo.blocked.contact": "Связаться с поддержкой",
    "geo.vpn.title": "Обнаружен VPN или прокси.", "geo.vpn.body": "Вы можете продолжать играть, но для вывода средств может потребоваться проверка личности. Использование VPN для обхода региональных ограничений нарушает наши условия.",
    "common.dismiss": "Закрыть",
  },
};

// Shared casino shell vocabulary. Keeping navigation and state labels here
// prevents individual screens from drifting between English and Italian.
const PLATFORM_STRINGS: Record<Locale, Dict> = {
  en: {
    "common.back":"Back","common.carousel":"Carousel","common.goTo":"Go to {target}","common.previous":"Previous","common.next":"Next","common.close":"Close","common.loading":"Loading…","common.viewAll":"View all","common.showMore":"Show more","common.showLess":"Show less","common.spin":"Spin","common.enter":"Enter","common.new":"New","common.hot":"Hot","common.live":"Live",
    "nav.home":"Home","nav.originals":"Originals","nav.slots":"Slots","nav.liveCasino":"Live Casino","nav.virtual":"Virtual Games","nav.table":"Table Games","nav.recent":"Recent","nav.leaderboards":"Leaderboards","nav.settings":"Settings",
    "header.notifications":"Notifications","header.community":"Community chat","header.openWallet":"Open wallet","header.signup":"Sign up","header.player":"Player","header.logout":"Logout","header.toggleMenu":"Toggle menu",
    "profile.vault":"Vault","profile.language":"Language","profile.languageHint":"Automatically detected from your region. You can override it here.","profile.preferences":"Preferences","profile.account":"Account","profile.token":"Token","profile.affiliate":"Affiliate Program","profile.transactions":"Transactions","profile.redeem":"Redeem Code","profile.responsible":"Play Responsibly","profile.support":"Live Support",
    "promo.level-up.label":"Level Up!","promo.level-up.detail":"Reward at every tier","promo.clutch-up.label":"$20K Clutch Up","promo.clutch-up.detail":"Ends in 10 days","promo.weekly-race.label":"$100,000 Weekly Race","promo.weekly-race.detail":"Live leaderboard","promo.challenges.label":"Casino Challenges","promo.challenges.detail":"29 open","promo.affiliate.label":"Affiliate Program","promo.affiliate.detail":"Earn commission","home.gameShows":"Game Shows","home.latest":"Latest Releases","home.aboutTitle":"TOLS — Provably Fair Crypto Casino","home.aboutBody":"Every Original is settled by the server from a committed seed, your client seed and an increasing nonce. Rotate the seed to reveal it and independently verify every result.","home.aboutMath":"Game maths is server-enforced: standard Originals return {rtp}%, Blackjack 99.52%, Slots {slotsRtp}% and European Roulette 97.3%.","home.aboutSecurity":"Balances move in atomic database transactions and privileged actions are recorded in an audit trail.","home.noCategory":"No {category} in the catalogue yet","home.addedLater":"Games appear here once they are added to the library","home.weeklyRace":"$100,000 Weekly Race","home.resetsMonday":"Resets every Monday","home.wagered":"{amount} wagered","home.raceEmpty":"The leaderboard is warming up — place a bet to enter",
    "games.available":"{count} games available","games.recentHelp":"Games you have played recently","games.none":"No games available","games.notFound":"Game not found",
    "leader.title":"Player Leaderboards","leader.subtitle":"Real paid bets power every ranking, promotion and tournament score. Practice rounds never count.","leader.liveCompetition":"Live competition","leader.promotions":"Live promotions","leader.prizePool":"Prize pool","leader.endsIn":"Ends in","leader.yourRank":"Your rank","leader.playToRank":"Play to rank","leader.refresh":"Refresh leaderboards","leader.tournaments":"Tournaments","leader.betActivity":"Bet activity","leader.liveBets":"Live bets","leader.highRollers":"High rollers","leader.joined":"Tournament joined — paid bets now update your score live","leader.playOriginals":"Play Originals",
    "footer.support":"Support","footer.platform":"Platform","footer.policy":"Policy","footer.community":"Community","footer.help":"Help Center","footer.responsible":"Game Responsibly","footer.fair":"Provably Fair","footer.terms":"Terms of Service","footer.privacy":"Privacy Policy","footer.aml":"AML Policy","game.back":"Back to lobby","game.soundOn":"Mute","game.soundOff":"Unmute","game.quickPlay":"Quick play — skip result animations","game.provablyFair":"Provably Fair","game.placeBet":"Place a bet to see this round's commitment.","error.connection":"Connection lost","error.betNotSent":"Your bet was not sent.","error.tooMany":"Too many bets","error.wait":"Wait a few seconds and try again.","error.balance":"Insufficient balance","error.reduce":"Reduce the bet or make a deposit.","error.betFailed":"Bet failed","error.retry":"Try again.",
  },
  it: {
    "common.back":"Indietro","common.carousel":"Carosello","common.goTo":"Vai a {target}","common.previous":"Precedente","common.next":"Successivo","common.close":"Chiudi","common.loading":"Caricamento…","common.viewAll":"Vedi tutti","common.showMore":"Mostra altro","common.showLess":"Mostra meno","common.spin":"Gira","common.enter":"Partecipa","common.new":"Nuovo","common.hot":"Popolare","common.live":"Live",
    "nav.home":"Home","nav.originals":"Originals","nav.slots":"Slot","nav.liveCasino":"Casinò Live","nav.virtual":"Giochi virtuali","nav.table":"Giochi da tavolo","nav.recent":"Recenti","nav.leaderboards":"Classifiche","nav.settings":"Impostazioni",
    "header.notifications":"Notifiche","header.community":"Chat della community","header.openWallet":"Apri portafoglio","header.signup":"Registrati","header.player":"Giocatore","header.logout":"Esci","header.toggleMenu":"Apri menu",
    "profile.vault":"Cassaforte","profile.language":"Lingua","profile.languageHint":"Rilevata automaticamente dalla tua regione. Puoi cambiarla qui.","profile.preferences":"Preferenze","profile.account":"Account","profile.token":"Token","profile.affiliate":"Programma affiliati","profile.transactions":"Transazioni","profile.redeem":"Riscatta codice","profile.responsible":"Gioca responsabilmente","profile.support":"Assistenza live",
    "promo.level-up.label":"Sali di livello!","promo.level-up.detail":"Premio a ogni livello","promo.clutch-up.label":"Clutch Up da $20K","promo.clutch-up.detail":"Termina tra 10 giorni","promo.weekly-race.label":"Gara settimanale da $100.000","promo.weekly-race.detail":"Classifica live","promo.challenges.label":"Sfide Casino","promo.challenges.detail":"29 aperte","promo.affiliate.label":"Programma affiliati","promo.affiliate.detail":"Guadagna commissioni","home.gameShows":"Game Show","home.latest":"Ultime uscite","home.aboutTitle":"TOLS — Crypto Casino Provably Fair","home.aboutBody":"Ogni Original viene regolato dal server usando un seed impegnato, il tuo client seed e un nonce crescente. Ruota il seed per rivelarlo e verificare ogni risultato.","home.aboutMath":"La matematica è applicata dal server: gli Originals standard restituiscono il {rtp}%, Blackjack il 99,52%, le Slot il {slotsRtp}% e la Roulette europea il 97,3%.","home.aboutSecurity":"I saldi si muovono con transazioni atomiche e ogni azione privilegiata viene registrata nell'audit trail.","home.noCategory":"Nessun gioco {category} nel catalogo","home.addedLater":"I giochi appariranno qui quando saranno aggiunti alla libreria","home.weeklyRace":"Gara settimanale da $100.000","home.resetsMonday":"Si azzera ogni lunedì","home.wagered":"{amount} puntati","home.raceEmpty":"La classifica è in preparazione — piazza una puntata per partecipare",
    "games.available":"{count} giochi disponibili","games.recentHelp":"Giochi utilizzati di recente","games.none":"Nessun gioco disponibile","games.notFound":"Gioco non trovato",
    "leader.title":"Classifiche giocatori","leader.subtitle":"Puntate reali alimentano classifiche, promozioni e tornei. Le partite demo non contano.","leader.liveCompetition":"Competizione live","leader.promotions":"Promozioni attive","leader.prizePool":"Montepremi","leader.endsIn":"Termina tra","leader.yourRank":"La tua posizione","leader.playToRank":"Gioca per classificarti","leader.refresh":"Aggiorna classifiche","leader.tournaments":"Tornei","leader.betActivity":"Attività puntate","leader.liveBets":"Puntate live","leader.highRollers":"High roller","leader.joined":"Iscrizione completata — le puntate reali aggiornano il punteggio","leader.playOriginals":"Gioca agli Originals",
    "footer.support":"Assistenza","footer.platform":"Piattaforma","footer.policy":"Normative","footer.community":"Community","footer.help":"Centro assistenza","footer.responsible":"Gioca responsabilmente","footer.fair":"Provably Fair","footer.terms":"Termini di servizio","footer.privacy":"Privacy Policy","footer.aml":"Normativa AML","game.back":"Torna alla lobby","game.soundOn":"Disattiva audio","game.soundOff":"Attiva audio","game.quickPlay":"Gioco rapido — salta le animazioni","game.provablyFair":"Provably Fair","game.placeBet":"Piazza una puntata per vedere l'impegno crittografico del round.","error.connection":"Connessione persa","error.betNotSent":"La puntata non è stata inviata.","error.tooMany":"Troppe puntate","error.wait":"Attendi qualche secondo e riprova.","error.balance":"Saldo insufficiente","error.reduce":"Riduci la puntata o effettua un deposito.","error.betFailed":"Puntata non riuscita","error.retry":"Riprova.",
  },
  es: { "common.back":"Volver","common.close":"Cerrar","common.loading":"Cargando…","common.viewAll":"Ver todo","common.showMore":"Mostrar más","common.showLess":"Mostrar menos","common.new":"Nuevo","common.hot":"Popular","common.live":"En vivo","nav.home":"Inicio","nav.originals":"Originales","nav.slots":"Slots","nav.liveCasino":"Casino en vivo","nav.table":"Juegos de mesa","nav.recent":"Recientes","nav.leaderboards":"Clasificaciones","nav.settings":"Ajustes","header.signup":"Registrarse","header.logout":"Salir","games.none":"No hay juegos disponibles","leader.title":"Clasificaciones de jugadores","common.play":"Jugar" },
  fr: { "common.back":"Retour","common.close":"Fermer","common.loading":"Chargement…","common.viewAll":"Tout voir","common.showMore":"Afficher plus","common.showLess":"Afficher moins","common.new":"Nouveau","common.hot":"Populaire","common.live":"Live","nav.home":"Accueil","nav.originals":"Originals","nav.slots":"Machines","nav.liveCasino":"Casino en direct","nav.table":"Jeux de table","nav.recent":"Récents","nav.leaderboards":"Classements","nav.settings":"Paramètres","header.signup":"S'inscrire","header.logout":"Déconnexion","games.none":"Aucun jeu disponible","leader.title":"Classements des joueurs","common.play":"Jouer" },
  de: { "common.back":"Zurück","common.close":"Schließen","common.loading":"Laden…","common.viewAll":"Alle anzeigen","common.showMore":"Mehr anzeigen","common.showLess":"Weniger anzeigen","common.new":"Neu","common.hot":"Beliebt","common.live":"Live","nav.home":"Start","nav.originals":"Originals","nav.slots":"Slots","nav.liveCasino":"Live-Casino","nav.table":"Tischspiele","nav.recent":"Zuletzt","nav.leaderboards":"Ranglisten","nav.settings":"Einstellungen","header.signup":"Registrieren","header.logout":"Abmelden","games.none":"Keine Spiele verfügbar","leader.title":"Spieler-Ranglisten","common.play":"Spielen" },
  pt: { "common.back":"Voltar","common.close":"Fechar","common.loading":"A carregar…","common.viewAll":"Ver todos","common.showMore":"Mostrar mais","common.showLess":"Mostrar menos","common.new":"Novo","common.hot":"Popular","common.live":"Ao vivo","nav.home":"Início","nav.originals":"Originals","nav.slots":"Slots","nav.liveCasino":"Casino ao vivo","nav.table":"Jogos de mesa","nav.recent":"Recentes","nav.leaderboards":"Classificações","nav.settings":"Definições","header.signup":"Registar","header.logout":"Sair","games.none":"Nenhum jogo disponível","leader.title":"Classificações de jogadores","common.play":"Jogar" },
  ru: { "common.back":"Назад","common.close":"Закрыть","common.loading":"Загрузка…","common.viewAll":"Показать все","common.showMore":"Показать больше","common.showLess":"Показать меньше","common.new":"Новое","common.hot":"Популярное","common.live":"Лайв","nav.home":"Главная","nav.originals":"Originals","nav.slots":"Слоты","nav.liveCasino":"Лайв-казино","nav.table":"Настольные игры","nav.recent":"Недавние","nav.leaderboards":"Рейтинги","nav.settings":"Настройки","header.signup":"Регистрация","header.logout":"Выйти","games.none":"Нет доступных игр","leader.title":"Рейтинг игроков","common.play":"Играть" },
};

/** Translate a key for a locale, falling back to English then the key itself. */
export function translate(locale: Locale, key: string): string {
  return PLATFORM_STRINGS[locale]?.[key] ?? STRINGS[locale]?.[key] ?? PLATFORM_STRINGS.en[key] ?? STRINGS.en[key] ?? key;
}
