"use client";

import { CookieSettingsLink } from "@/components/compliance/CookieSettingsLink";
import { useLocale } from "@/lib/use-locale";

export function CasinoFooter({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const { t } = useLocale();
  const link = "text-xs text-muted-foreground transition-colors hover:text-lime";
  const heading = "mb-2 text-[10px] font-bold uppercase tracking-widest text-lime/60";
  return (
    <footer className="mt-auto border-t border-lime/10 bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {/* Support */}
          <div>
            <p className={heading}>{t("footer.support")}</p>
            <div className="flex flex-col gap-1.5">
              <button onClick={() => onNavigate?.("live-support")} className={link + " text-left"}>{t("profile.support")}</button>
              <a href="/help" className={link}>{t("footer.help")}</a>
              <a href="/responsible-gaming" className={link}>{t("footer.responsible")}</a>
            </div>
          </div>
          {/* Platform */}
          <div>
            <p className={heading}>{t("footer.platform")}</p>
            <div className="flex flex-col gap-1.5">
              <a href="/provably-fair" className={link}>{t("footer.fair")}</a>
              <button onClick={() => onNavigate?.("affiliate")} className={link + " text-left"}>{t("profile.affiliate")}</button>
              <button onClick={() => onNavigate?.("riscatta-codice")} className={link + " text-left"}>{t("profile.redeem")}</button>
              <button onClick={() => onNavigate?.("vip")} className={link + " text-left"}>VIP Program</button>
            </div>
          </div>
          {/* Policy */}
          <div>
            <p className={heading}>{t("footer.policy")}</p>
            <div className="flex flex-col gap-1.5">
              <a href="/terms" className={link}>{t("footer.terms")}</a>
              <a href="/privacy" className={link}>{t("footer.privacy")}</a>
              <a href="/responsible-gaming" className={link}>{t("footer.responsible")}</a>
              <a href="/aml" className={link}>{t("footer.aml")}</a>
              <CookieSettingsLink className={link + " text-left"} />
            </div>
          </div>
          {/* Community */}
          <div>
            <p className={heading}>{t("footer.community")}</p>
            <div className="flex flex-col gap-1.5">
              <a href="https://t.me/tolscasinobot" target="_blank" rel="noopener" className={link}>Telegram</a>
              <a href="https://x.com" target="_blank" rel="noopener" className={link}>X</a>
              <a href="https://instagram.com" target="_blank" rel="noopener" className={link}>Instagram</a>
              <a href="https://t.me/tolscasinobot" target="_blank" rel="noopener" className={link}>Forum</a>
            </div>
          </div>
        </div>
        <div className="mt-6 border-t border-lime/5 pt-4 text-center">
          <p className="text-xs text-muted-foreground/50">© 2026 TOLS Casino — Provably Fair · 18+ · {t("footer.responsible")}</p>
        </div>
      </div>
    </footer>
  );
}
