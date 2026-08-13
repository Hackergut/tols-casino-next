// Sign-up bonus for web registration (fun-balance style — mirrors the
// Telegram welcome bonus). Shared by the register route (grants it) and the
// public promo endpoint (advertises it), so the sign-up prompt can never show
// an amount the backend doesn't actually honour. 0 disables it.
export const WEB_WELCOME_BONUS = Number(process.env.WEB_WELCOME_BONUS ?? 10) || 0;
